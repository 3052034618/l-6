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
import {
  AuthorizationStatus,
  ContractStatus,
  UserRole,
  ProductStatus,
} from '../types/enums';
import { v4 as uuidv4 } from 'uuid';

export async function createAuthRequest(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    if (req.user.role !== UserRole.CONSUMER && req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有数据使用方可以提交授权申请');
      return;
    }

    const { productId, purpose, usageScope, duration } = req.body;

    if (!productId || !purpose || !usageScope || !duration) {
      badRequest(res, '必填字段不能为空');
      return;
    }

    const product = await prisma.dataProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (product.status !== ProductStatus.APPROVED) {
      badRequest(res, '该产品不可申请授权');
      return;
    }

    const existingRequest = await prisma.authorizationRequest.findFirst({
      where: {
        productId,
        consumerId: req.user.userId,
        status: {
          in: [AuthorizationStatus.PENDING, AuthorizationStatus.APPROVED],
        },
      },
    });

    if (existingRequest) {
      if (existingRequest.status === AuthorizationStatus.PENDING) {
        badRequest(res, '您已有待审批的授权申请');
        return;
      }
      if (existingRequest.status === AuthorizationStatus.APPROVED) {
        badRequest(res, '您已获得该产品的授权');
        return;
      }
    }

    const authRequest = await prisma.authorizationRequest.create({
      data: {
        productId,
        consumerId: req.user.userId,
        purpose,
        usageScope,
        duration: parseInt(duration),
        status: AuthorizationStatus.PENDING,
      },
    });

    success(res, authRequest, '授权申请提交成功');
  } catch (err: any) {
    error(res, err.message || '提交授权申请失败');
  }
}

export async function getMyAuthRequests(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;

    const where: any = {
      consumerId: req.user.userId,
    };

    if (status) {
      where.status = status as AuthorizationStatus;
    }

    const skip = (page - 1) * pageSize;

    const [requests, total] = await Promise.all([
      prisma.authorizationRequest.findMany({
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
              pricingModel: true,
              price: true,
              priceUnit: true,
              provider: {
                select: {
                  id: true,
                  fullName: true,
                  organization: true,
                },
              },
            },
          },
        },
      }),
      prisma.authorizationRequest.count({ where }),
    ]);

    successWithPagination(res, requests, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取授权申请列表失败');
  }
}

export async function getReceivedAuthRequests(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    if (req.user.role !== UserRole.PROVIDER && req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有数据提供方可以查看收到的授权申请');
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;
    const productId = req.query.productId as string;

    const where: any = {};

    if (status) {
      where.status = status as AuthorizationStatus;
    }

    if (productId) {
      where.productId = productId;
    }

    if (req.user.role === UserRole.PROVIDER) {
      where.product = {
        providerId: req.user.userId,
      };
    }

    const skip = (page - 1) * pageSize;

    const [requests, total] = await Promise.all([
      prisma.authorizationRequest.findMany({
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
          consumer: {
            select: {
              id: true,
              fullName: true,
              organization: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      prisma.authorizationRequest.count({ where }),
    ]);

    successWithPagination(res, requests, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取收到的授权申请失败');
  }
}

export async function getAuthRequestDetail(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const authRequest = await prisma.authorizationRequest.findUnique({
      where: { id },
      include: {
        product: true,
        consumer: {
          select: {
            id: true,
            fullName: true,
            organization: true,
            email: true,
            phone: true,
          },
        },
        contract: true,
      },
    });

    if (!authRequest) {
      notFound(res, '授权申请不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== authRequest.consumerId &&
      req.user.userId !== authRequest.product.providerId
    ) {
      forbidden(res, '您没有权限查看此申请');
      return;
    }

    success(res, authRequest);
  } catch (err: any) {
    error(res, err.message || '获取授权申请详情失败');
  }
}

export async function approveAuthRequest(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;
    const { approveNote } = req.body;

    const authRequest = await prisma.authorizationRequest.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!authRequest) {
      notFound(res, '授权申请不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== authRequest.product.providerId
    ) {
      forbidden(res, '您没有权限审批此申请');
      return;
    }

    if (authRequest.status !== AuthorizationStatus.PENDING) {
      badRequest(res, '只有待审批的申请可以操作');
      return;
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + authRequest.duration);

    const contractNo = `CT${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const approverId = req.user.userId;

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.authorizationRequest.update({
        where: { id },
        data: {
          status: AuthorizationStatus.APPROVED,
          approverId,
          approveNote,
          approvedAt: new Date(),
        },
      });

      await tx.contract.create({
        data: {
          contractNo,
          productId: authRequest.productId,
          consumerId: authRequest.consumerId,
          authRequestId: id,
          status: ContractStatus.SIGNED,
          price: authRequest.product.price,
          startDate,
          endDate,
          terms: approveNote || '授权合同',
          signedAt: new Date(),
        },
      });

      return updated;
    });

    success(res, updatedRequest, '授权审批通过');
  } catch (err: any) {
    error(res, err.message || '审批操作失败');
  }
}

export async function rejectAuthRequest(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;
    const { rejectReason } = req.body;

    const authRequest = await prisma.authorizationRequest.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!authRequest) {
      notFound(res, '授权申请不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== authRequest.product.providerId
    ) {
      forbidden(res, '您没有权限审批此申请');
      return;
    }

    if (authRequest.status !== AuthorizationStatus.PENDING) {
      badRequest(res, '只有待审批的申请可以操作');
      return;
    }

    const updatedRequest = await prisma.authorizationRequest.update({
      where: { id },
      data: {
        status: AuthorizationStatus.REJECTED,
        approverId: req.user.userId,
        rejectReason,
        rejectedAt: new Date(),
      },
    });

    success(res, updatedRequest, '授权申请已拒绝');
  } catch (err: any) {
    error(res, err.message || '拒绝操作失败');
  }
}

export async function revokeAuthRequest(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;

    const authRequest = await prisma.authorizationRequest.findUnique({
      where: { id },
      include: { product: true, contract: true },
    });

    if (!authRequest) {
      notFound(res, '授权申请不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== authRequest.product.providerId
    ) {
      forbidden(res, '您没有权限撤销授权');
      return;
    }

    if (authRequest.status !== AuthorizationStatus.APPROVED) {
      badRequest(res, '只有已通过的授权可以撤销');
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.authorizationRequest.update({
        where: { id },
        data: {
          status: AuthorizationStatus.REVOKED,
          rejectReason: reason,
        },
      });

      if (authRequest.contract) {
        await tx.contract.update({
          where: { id: authRequest.contract.id },
          data: {
            status: ContractStatus.TERMINATED,
            terminatedAt: new Date(),
            terminateReason: reason,
          },
        });
      }
    });

    success(res, null, '授权已撤销');
  } catch (err: any) {
    error(res, err.message || '撤销授权失败');
  }
}

export async function getContracts(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;

    const where: any = {};

    if (status) {
      where.status = status as ContractStatus;
    }

    if (req.user.role === UserRole.CONSUMER) {
      where.consumerId = req.user.userId;
    } else if (req.user.role === UserRole.PROVIDER) {
      where.product = {
        providerId: req.user.userId,
      };
    }

    const skip = (page - 1) * pageSize;

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
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
          consumer: {
            select: {
              id: true,
              fullName: true,
              organization: true,
            },
          },
        },
      }),
      prisma.contract.count({ where }),
    ]);

    successWithPagination(res, contracts, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取合同列表失败');
  }
}

export async function getContractDetail(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        product: true,
        consumer: {
          select: {
            id: true,
            fullName: true,
            organization: true,
            email: true,
            phone: true,
          },
        },
        authRequest: true,
        deliveryRecords: true,
      },
    });

    if (!contract) {
      notFound(res, '合同不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== contract.consumerId &&
      req.user.userId !== contract.product.providerId
    ) {
      forbidden(res, '您没有权限查看此合同');
      return;
    }

    success(res, contract);
  } catch (err: any) {
    error(res, err.message || '获取合同详情失败');
  }
}
