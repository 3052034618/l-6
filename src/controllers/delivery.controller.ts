import { Request, Response } from 'express';
import prisma from '../config/prisma';
import {
  success,
  successWithPagination,
  error,
  notFound,
  forbidden,
  badRequest,
  unauthorized,
} from '../utils/response';
import { DeliveryStatus, UserRole, ContractStatus } from '../types/enums';
import { createHash, randomBytes } from 'crypto';

export async function createDelivery(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    if (req.user.role !== UserRole.PROVIDER && req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有数据提供方可以创建交付记录');
      return;
    }

    const { contractId, dataSize, deliveryUrl, deliveryNote } = req.body;

    if (!contractId) {
      badRequest(res, '合同ID不能为空');
      return;
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { product: true },
    });

    if (!contract) {
      notFound(res, '合同不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== contract.product.providerId
    ) {
      forbidden(res, '您没有权限操作此合同的交付');
      return;
    }

    if (contract.status !== ContractStatus.SIGNED && contract.status !== ContractStatus.EXECUTING) {
      badRequest(res, '合同状态不允许交付');
      return;
    }

    const batchNo = `DEL${Date.now()}${Math.floor(Math.random() * 10000)}`;

    const delivery = await prisma.deliveryRecord.create({
      data: {
        contractId,
        productId: contract.productId,
        consumerId: contract.consumerId,
        batchNo,
        status: DeliveryStatus.IN_PROGRESS,
        dataSize,
        deliveryUrl,
        deliveryNote,
      },
    });

    if (contract.status === ContractStatus.SIGNED) {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.EXECUTING },
      });
    }

    success(res, delivery, '交付记录创建成功');
  } catch (err: any) {
    error(res, err.message || '创建交付记录失败');
  }
}

export async function getDeliveryList(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;
    const contractId = req.query.contractId as string;
    const productId = req.query.productId as string;

    const where: any = {};

    if (status) {
      where.status = status as DeliveryStatus;
    }

    if (contractId) {
      where.contractId = contractId;
    }

    if (productId) {
      where.productId = productId;
    }

    if (req.user.role === UserRole.CONSUMER) {
      where.consumerId = req.user.userId;
    } else if (req.user.role === UserRole.PROVIDER) {
      where.product = {
        providerId: req.user.userId,
      };
    }

    const skip = (page - 1) * pageSize;

    const [deliveries, total] = await Promise.all([
      prisma.deliveryRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              category: true,
            },
          },
          contract: {
            select: {
              id: true,
              contractNo: true,
            },
          },
          consumer: {
            select: {
              id: true,
              fullName: true,
              organization: true,
            },
          },
        },
      }),
      prisma.deliveryRecord.count({ where }),
    ]);

    successWithPagination(res, deliveries, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取交付记录失败');
  }
}

export async function getDeliveryDetail(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const delivery = await prisma.deliveryRecord.findUnique({
      where: { id },
      include: {
        product: true,
        contract: true,
        consumer: {
          select: {
            id: true,
            fullName: true,
            organization: true,
            email: true,
          },
        },
        proof: true,
      },
    });

    if (!delivery) {
      notFound(res, '交付记录不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== delivery.consumerId &&
      req.user.userId !== delivery.product.providerId
    ) {
      forbidden(res, '您没有权限查看此交付记录');
      return;
    }

    success(res, delivery);
  } catch (err: any) {
    error(res, err.message || '获取交付详情失败');
  }
}

export async function confirmDelivery(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const delivery = await prisma.deliveryRecord.findUnique({
      where: { id },
      include: { product: true, contract: true },
    });

    if (!delivery) {
      notFound(res, '交付记录不存在');
      return;
    }

    if (req.user.userId !== delivery.consumerId && req.user.role !== UserRole.ADMIN) {
      forbidden(res, '您没有权限确认此交付');
      return;
    }

    if (delivery.status !== DeliveryStatus.DELIVERED) {
      badRequest(res, '只有已交付状态的记录才能确认收货');
      return;
    }

    const proofHash = generateProofHash(delivery.id, delivery.batchNo, Date.now());
    const confirmedAt = new Date();
    const userId = req.user.userId;
    const userOrg = req.user.organization || '';

    const proofContent = {
      deliveryId: delivery.id,
      batchNo: delivery.batchNo,
      status: 'CONFIRMED',
      product: {
        id: delivery.productId,
        title: delivery.product.title,
        category: delivery.product.category,
        industry: delivery.product.industry,
        region: delivery.product.region,
      },
      contract: {
        id: delivery.contractId,
        contractNo: delivery.contract?.contractNo,
        price: delivery.contract?.price,
        startDate: delivery.contract?.startDate,
        endDate: delivery.contract?.endDate,
      },
      consumer: {
        id: delivery.consumerId,
        confirmedBy: userId,
        organization: userOrg,
      },
      confirmedAt: confirmedAt.toISOString(),
      dataSize: delivery.dataSize,
    };

    const auditTrail = JSON.stringify([
      { action: 'DELIVERY_CREATED', timestamp: delivery.createdAt.toISOString(), actor: 'PROVIDER', status: 'PENDING' },
      { action: 'DELIVERY_IN_PROGRESS', timestamp: delivery.createdAt.toISOString(), actor: 'PROVIDER', status: 'IN_PROGRESS' },
      { action: 'DELIVERY_DELIVERED', timestamp: delivery.deliveredAt?.toISOString() || '', actor: 'PROVIDER', status: 'DELIVERED' },
      { action: 'DELIVERY_CONFIRMED', timestamp: confirmedAt.toISOString(), actor: 'CONSUMER', status: 'CONFIRMED' },
    ]);

    const updatedDelivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryRecord.update({
        where: { id },
        data: {
          status: DeliveryStatus.CONFIRMED,
          confirmedAt,
          proofHash,
          proofData: JSON.stringify(proofContent),
        },
      });

      await tx.deliveryProof.create({
        data: {
          deliveryId: id,
          proofType: 'CONSUMPTION_CONFIRMATION',
          proofHash,
          proofContent: JSON.stringify(proofContent),
          timestamp: confirmedAt,
          auditor: userId,
          auditTrail: auditTrail,
        },
      });

      return updated;
    });

    success(res, updatedDelivery, '交付确认成功，已生成审计凭证');
  } catch (err: any) {
    error(res, err.message || '确认交付失败');
  }
}

export async function markDelivered(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const delivery = await prisma.deliveryRecord.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!delivery) {
      notFound(res, '交付记录不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== delivery.product.providerId
    ) {
      forbidden(res, '您没有权限操作此交付');
      return;
    }

    if (delivery.status !== DeliveryStatus.IN_PROGRESS && delivery.status !== DeliveryStatus.PENDING) {
      badRequest(res, '当前状态不允许标记已交付');
      return;
    }

    const updatedDelivery = await prisma.deliveryRecord.update({
      where: { id },
      data: {
        status: DeliveryStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });

    success(res, updatedDelivery, '已标记为已交付');
  } catch (err: any) {
    error(res, err.message || '操作失败');
  }
}

export async function getDeliveryProof(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const delivery = await prisma.deliveryRecord.findUnique({
      where: { id },
      include: {
        product: { select: { providerId: true, title: true, category: true, industry: true, region: true } },
        contract: { select: { contractNo: true, price: true, startDate: true, endDate: true } },
        consumer: { select: { fullName: true, organization: true } },
        proof: true,
      },
    });

    if (!delivery) {
      notFound(res, '交付记录不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== delivery.consumerId &&
      req.user.userId !== delivery.product.providerId
    ) {
      forbidden(res, '您没有权限查看此交付凭证');
      return;
    }

    if (!delivery.proof || delivery.status !== DeliveryStatus.CONFIRMED) {
      notFound(res, '暂无交付凭证，请先确认收货');
      return;
    }

    let proofContent: any = {};
    let auditTrail: any[] = [];
    try {
      proofContent = JSON.parse(delivery.proof.proofContent);
    } catch {}
    try {
      auditTrail = JSON.parse(delivery.proof.auditTrail);
    } catch {}

    success(res, {
      id: delivery.proof.id,
      proofType: delivery.proof.proofType,
      proofHash: delivery.proof.proofHash,
      timestamp: delivery.proof.timestamp,
      auditor: delivery.proof.auditor,
      auditTrail,
      proofContent,
      delivery: {
        id: delivery.id,
        batchNo: delivery.batchNo,
        status: delivery.status,
        dataSize: delivery.dataSize,
        deliveredAt: delivery.deliveredAt,
        confirmedAt: delivery.confirmedAt,
        product: {
          id: delivery.productId,
          title: delivery.product.title,
          category: delivery.product.category,
          industry: delivery.product.industry,
          region: delivery.product.region,
        },
        contract: {
          id: delivery.contractId,
          contractNo: delivery.contract?.contractNo,
          price: delivery.contract?.price,
          startDate: delivery.contract?.startDate,
          endDate: delivery.contract?.endDate,
        },
        consumer: {
          id: delivery.consumerId,
          fullName: delivery.consumer.fullName,
          organization: delivery.consumer.organization,
        },
      },
    });
  } catch (err: any) {
    error(res, err.message || '获取交付凭证失败');
  }
}

export async function verifyDeliveryProof(req: Request, res: Response): Promise<void> {
  try {
    const { proofHash } = req.params;

    const proof = await prisma.deliveryProof.findFirst({
      where: { proofHash },
      include: {
        delivery: {
          include: {
            product: { select: { title: true } },
            consumer: { select: { fullName: true, organization: true } },
          },
        },
      },
    });

    if (!proof) {
      notFound(res, '凭证不存在或无效');
      return;
    }

    success(res, {
      valid: true,
      proof: {
        id: proof.id,
        proofType: proof.proofType,
        proofHash: proof.proofHash,
        timestamp: proof.timestamp,
        auditor: proof.auditor,
        auditTrail: proof.auditTrail,
      },
      delivery: {
        id: proof.delivery.id,
        batchNo: proof.delivery.batchNo,
        status: proof.delivery.status,
        productTitle: proof.delivery.product.title,
        consumerName: proof.delivery.consumer.fullName,
        consumerOrg: proof.delivery.consumer.organization,
        deliveredAt: proof.delivery.deliveredAt,
        confirmedAt: proof.delivery.confirmedAt,
      },
    });
  } catch (err: any) {
    error(res, err.message || '验证凭证失败');
  }
}

function generateProofHash(deliveryId: string, batchNo: string, timestamp: number): string {
  const data = `${deliveryId}:${batchNo}:${timestamp}:${randomBytes(16).toString('hex')}`;
  return createHash('sha256').update(data).digest('hex');
}

function generateAuditTrail(delivery: any, userId: string): string {
  const trail = [
    { action: 'DELIVERY_CREATED', timestamp: delivery.createdAt, actor: 'system' },
    { action: 'DELIVERY_IN_PROGRESS', timestamp: delivery.createdAt, actor: 'provider' },
    { action: 'DELIVERY_CONFIRMED', timestamp: new Date().toISOString(), actor: userId },
  ];
  return JSON.stringify(trail);
}
