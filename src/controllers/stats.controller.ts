import { Request, Response } from 'express';
import prisma from '../config/prisma';
import {
  success,
  error,
  forbidden,
  unauthorized,
} from '../utils/response';
import {
  ProductStatus,
  AuthorizationStatus,
  ContractStatus,
  DeliveryStatus,
  ReportStatus,
  UserRole,
} from '../types/enums';

export async function getPlatformOverview(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以查看平台统计');
      return;
    }

    const [
      totalUsers,
      totalProviders,
      totalConsumers,
      totalProducts,
      approvedProducts,
      pendingReviewProducts,
      frozenProducts,
      totalAuthRequests,
      pendingAuthRequests,
      approvedAuthRequests,
      totalContracts,
      activeContracts,
      totalDeliveries,
      completedDeliveries,
      totalReports,
      pendingReports,
      totalReviews,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.PROVIDER } }),
      prisma.user.count({ where: { role: UserRole.CONSUMER } }),
      prisma.dataProduct.count(),
      prisma.dataProduct.count({ where: { status: ProductStatus.APPROVED } }),
      prisma.dataProduct.count({ where: { status: ProductStatus.PENDING_REVIEW } }),
      prisma.dataProduct.count({ where: { status: ProductStatus.FROZEN } }),
      prisma.authorizationRequest.count(),
      prisma.authorizationRequest.count({ where: { status: AuthorizationStatus.PENDING } }),
      prisma.authorizationRequest.count({ where: { status: AuthorizationStatus.APPROVED } }),
      prisma.contract.count(),
      prisma.contract.count({ where: { status: { in: [ContractStatus.SIGNED, ContractStatus.EXECUTING] } } }),
      prisma.deliveryRecord.count(),
      prisma.deliveryRecord.count({ where: { status: DeliveryStatus.CONFIRMED } }),
      prisma.report.count(),
      prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      prisma.review.count({ where: { isDeleted: false } }),
    ]);

    const contracts = await prisma.contract.findMany({
      where: { status: { not: ContractStatus.DRAFT } },
      select: { price: true },
    });
    const totalTransactionAmount = contracts.reduce((sum, c) => sum + c.price, 0);

    success(res, {
      users: {
        total: totalUsers,
        providers: totalProviders,
        consumers: totalConsumers,
      },
      products: {
        total: totalProducts,
        approved: approvedProducts,
        pendingReview: pendingReviewProducts,
        frozen: frozenProducts,
      },
      authRequests: {
        total: totalAuthRequests,
        pending: pendingAuthRequests,
        approved: approvedAuthRequests,
      },
      contracts: {
        total: totalContracts,
        active: activeContracts,
        totalTransactionAmount,
      },
      deliveries: {
        total: totalDeliveries,
        completed: completedDeliveries,
      },
      reports: {
        total: totalReports,
        pending: pendingReports,
      },
      reviews: {
        total: totalReviews,
      },
    });
  } catch (err: any) {
    error(res, err.message || '获取平台概览失败');
  }
}

export async function getTradeStats(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以查看交易统计');
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyStats = [];
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const [contractCount, authCount] = await Promise.all([
        prisma.contract.count({
          where: {
            createdAt: {
              gte: currentDate,
              lt: nextDate,
            },
          },
        }),
        prisma.authorizationRequest.count({
          where: {
            createdAt: {
              gte: currentDate,
              lt: nextDate,
            },
          },
        }),
      ]);

      dailyStats.push({
        date: currentDate.toISOString().split('T')[0],
        contracts: contractCount,
        authRequests: authCount,
      });
    }

    const categoryStats = await prisma.dataProduct.groupBy({
      by: ['category'],
      where: { status: ProductStatus.APPROVED },
      _count: { id: true },
      _avg: { ratingAvg: true },
    });

    const industryStats = await prisma.dataProduct.groupBy({
      by: ['industry'],
      where: { status: ProductStatus.APPROVED },
      _count: { id: true },
    });

    const regionStats = await prisma.dataProduct.groupBy({
      by: ['region'],
      where: { status: ProductStatus.APPROVED },
      _count: { id: true },
    });

    success(res, {
      dailyStats,
      categoryStats: categoryStats.map((s) => ({
        category: s.category,
        count: s._count.id,
        avgRating: s._avg.ratingAvg || 0,
      })),
      industryStats: industryStats.map((s) => ({
        industry: s.industry,
        count: s._count.id,
      })),
      regionStats: regionStats.map((s) => ({
        region: s.region,
        count: s._count.id,
      })),
    });
  } catch (err: any) {
    error(res, err.message || '获取交易统计失败');
  }
}

export async function getProviderStats(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const providerId = req.user.role === UserRole.PROVIDER ? req.user.userId : (req.query.providerId as string);

    if (!providerId) {
      forbidden(res, '请指定提供方ID');
      return;
    }

    if (req.user.role === UserRole.PROVIDER && req.user.userId !== providerId) {
      forbidden(res, '您只能查看自己的数据统计');
      return;
    }

    const [
      productCount,
      approvedProductCount,
      totalViewCount,
      authRequestCount,
      approvedAuthCount,
      contractCount,
      deliveryCount,
      reviewCount,
    ] = await Promise.all([
      prisma.dataProduct.count({ where: { providerId } }),
      prisma.dataProduct.count({ where: { providerId, status: ProductStatus.APPROVED } }),
      prisma.dataProduct.aggregate({
        where: { providerId },
        _sum: { viewCount: true },
      }),
      prisma.authorizationRequest.count({
        where: { product: { providerId } },
      }),
      prisma.authorizationRequest.count({
        where: { product: { providerId }, status: AuthorizationStatus.APPROVED },
      }),
      prisma.contract.count({
        where: { product: { providerId } },
      }),
      prisma.deliveryRecord.count({
        where: { product: { providerId } },
      }),
      prisma.review.count({
        where: { product: { providerId }, isDeleted: false },
      }),
    ]);

    const contracts = await prisma.contract.findMany({
      where: {
        product: { providerId },
        status: { not: ContractStatus.DRAFT },
      },
      select: { price: true },
    });
    const totalRevenue = contracts.reduce((sum, c) => sum + c.price, 0);

    const topProducts = await prisma.dataProduct.findMany({
      where: { providerId },
      orderBy: { viewCount: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        viewCount: true,
        reviewCount: true,
        ratingAvg: true,
      },
    });

    success(res, {
      products: {
        total: productCount,
        approved: approvedProductCount,
        totalViews: totalViewCount._sum.viewCount || 0,
      },
      authRequests: {
        total: authRequestCount,
        approved: approvedAuthCount,
      },
      contracts: {
        total: contractCount,
        totalRevenue,
      },
      deliveries: {
        total: deliveryCount,
      },
      reviews: {
        total: reviewCount,
      },
      topProducts,
    });
  } catch (err: any) {
    error(res, err.message || '获取提供方统计失败');
  }
}

export async function getConsumerStats(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const consumerId = req.user.role === UserRole.CONSUMER ? req.user.userId : (req.query.consumerId as string);

    if (!consumerId) {
      forbidden(res, '请指定使用方ID');
      return;
    }

    if (req.user.role === UserRole.CONSUMER && req.user.userId !== consumerId) {
      forbidden(res, '您只能查看自己的数据统计');
      return;
    }

    const [
      authRequestCount,
      approvedAuthCount,
      contractCount,
      activeContractCount,
      deliveryCount,
      completedDeliveryCount,
      reviewCount,
    ] = await Promise.all([
      prisma.authorizationRequest.count({ where: { consumerId } }),
      prisma.authorizationRequest.count({ where: { consumerId, status: AuthorizationStatus.APPROVED } }),
      prisma.contract.count({ where: { consumerId } }),
      prisma.contract.count({
        where: {
          consumerId,
          status: { in: [ContractStatus.SIGNED, ContractStatus.EXECUTING] },
        },
      }),
      prisma.deliveryRecord.count({ where: { consumerId } }),
      prisma.deliveryRecord.count({ where: { consumerId, status: DeliveryStatus.CONFIRMED } }),
      prisma.review.count({ where: { userId: consumerId, isDeleted: false } }),
    ]);

    const contracts = await prisma.contract.findMany({
      where: {
        consumerId,
        status: { not: ContractStatus.DRAFT },
      },
      select: { price: true },
    });
    const totalSpent = contracts.reduce((sum, c) => sum + c.price, 0);

    success(res, {
      authRequests: {
        total: authRequestCount,
        approved: approvedAuthCount,
      },
      contracts: {
        total: contractCount,
        active: activeContractCount,
        totalSpent,
      },
      deliveries: {
        total: deliveryCount,
        completed: completedDeliveryCount,
      },
      reviews: {
        total: reviewCount,
      },
    });
  } catch (err: any) {
    error(res, err.message || '获取使用方统计失败');
  }
}

export async function getRecentActivities(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以查看最近活动');
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;

    const [
      recentProducts,
      recentAuthRequests,
      recentReports,
    ] = await Promise.all([
      prisma.dataProduct.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          provider: { select: { fullName: true, organization: true } },
        },
      }),
      prisma.authorizationRequest.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          purpose: true,
          createdAt: true,
          product: { select: { title: true } },
          consumer: { select: { fullName: true, organization: true } },
        },
      }),
      prisma.report.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          reportType: true,
          status: true,
          createdAt: true,
          product: { select: { title: true } },
          reporter: { select: { fullName: true } },
        },
      }),
    ]);

    success(res, {
      recentProducts,
      recentAuthRequests,
      recentReports,
    });
  } catch (err: any) {
    error(res, err.message || '获取最近活动失败');
  }
}

export async function getTransactionProgress(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以查看交易进度');
      return;
    }

    const industry = req.query.industry as string;
    const region = req.query.region as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const days = parseInt(req.query.days as string) || 30;

    const productWhere: any = {};
    if (industry) productWhere.industry = industry;
    if (region) productWhere.region = region;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const products = await prisma.dataProduct.findMany({
      where: productWhere,
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);

    const authWhere: any = {};
    if (productIds.length > 0) authWhere.productId = { in: productIds };
    if (Object.keys(dateFilter).length > 0) authWhere.createdAt = dateFilter;

    const contractWhere: any = {};
    if (productIds.length > 0) contractWhere.productId = { in: productIds };
    if (Object.keys(dateFilter).length > 0) contractWhere.createdAt = dateFilter;

    const deliveryWhere: any = {};
    if (productIds.length > 0) deliveryWhere.productId = { in: productIds };
    if (Object.keys(dateFilter).length > 0) deliveryWhere.createdAt = dateFilter;

    const [
      totalAuthRequests,
      pendingAuthRequests,
      approvedAuthRequests,
      rejectedAuthRequests,
      totalContracts,
      signedContracts,
      executingContracts,
      completedContracts,
      totalDeliveries,
      pendingDeliveries,
      inProgressDeliveries,
      deliveredDeliveries,
      confirmedDeliveries,
    ] = await Promise.all([
      prisma.authorizationRequest.count({ where: authWhere }),
      prisma.authorizationRequest.count({ where: { ...authWhere, status: AuthorizationStatus.PENDING } }),
      prisma.authorizationRequest.count({ where: { ...authWhere, status: AuthorizationStatus.APPROVED } }),
      prisma.authorizationRequest.count({ where: { ...authWhere, status: AuthorizationStatus.REJECTED } }),
      prisma.contract.count({ where: contractWhere }),
      prisma.contract.count({ where: { ...contractWhere, status: ContractStatus.SIGNED } }),
      prisma.contract.count({ where: { ...contractWhere, status: ContractStatus.EXECUTING } }),
      prisma.contract.count({ where: { ...contractWhere, status: ContractStatus.COMPLETED } }),
      prisma.deliveryRecord.count({ where: deliveryWhere }),
      prisma.deliveryRecord.count({ where: { ...deliveryWhere, status: DeliveryStatus.PENDING } }),
      prisma.deliveryRecord.count({ where: { ...deliveryWhere, status: DeliveryStatus.IN_PROGRESS } }),
      prisma.deliveryRecord.count({ where: { ...deliveryWhere, status: DeliveryStatus.DELIVERED } }),
      prisma.deliveryRecord.count({ where: { ...deliveryWhere, status: DeliveryStatus.CONFIRMED } }),
    ]);

    const authToContractRate = totalAuthRequests > 0 ? (approvedAuthRequests / totalAuthRequests * 100).toFixed(1) : '0';
    const contractToDeliveryRate = totalContracts > 0 ? (totalDeliveries / totalContracts * 100).toFixed(1) : '0';
    const deliveryConfirmRate = totalDeliveries > 0 ? (confirmedDeliveries / totalDeliveries * 100).toFixed(1) : '0';
    const overallConversion = totalAuthRequests > 0 ? (confirmedDeliveries / totalAuthRequests * 100).toFixed(1) : '0';

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : (() => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d;
    })();

    const dailyData = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayAuthWhere = { ...authWhere, createdAt: { gte: dayStart, lte: dayEnd } };
      const dayContractWhere = { ...contractWhere, createdAt: { gte: dayStart, lte: dayEnd } };
      const dayDeliveryWhere = { ...deliveryWhere, createdAt: { gte: dayStart, lte: dayEnd } };
      const dayConfirmWhere = { ...deliveryWhere, confirmedAt: { gte: dayStart, lte: dayEnd } };

      const [dayAuth, dayContract, dayDelivery, dayConfirm] = await Promise.all([
        prisma.authorizationRequest.count({ where: dayAuthWhere }),
        prisma.contract.count({ where: dayContractWhere }),
        prisma.deliveryRecord.count({ where: dayDeliveryWhere }),
        prisma.deliveryRecord.count({ where: { ...dayConfirmWhere, status: DeliveryStatus.CONFIRMED } }),
      ]);

      dailyData.push({
        date: currentDate.toISOString().split('T')[0],
        authRequests: dayAuth,
        contracts: dayContract,
        deliveries: dayDelivery,
        confirmations: dayConfirm,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    success(res, {
      summary: {
        authRequests: {
          total: totalAuthRequests,
          pending: pendingAuthRequests,
          approved: approvedAuthRequests,
          rejected: rejectedAuthRequests,
        },
        contracts: {
          total: totalContracts,
          signed: signedContracts,
          executing: executingContracts,
          completed: completedContracts,
        },
        deliveries: {
          total: totalDeliveries,
          pending: pendingDeliveries,
          inProgress: inProgressDeliveries,
          delivered: deliveredDeliveries,
          confirmed: confirmedDeliveries,
        },
      },
      conversionRates: {
        authToContract: authToContractRate + '%',
        contractToDelivery: contractToDeliveryRate + '%',
        deliveryConfirm: deliveryConfirmRate + '%',
        overallConversion: overallConversion + '%',
      },
      stages: [
        { stage: 'authRequest', name: '授权申请', count: totalAuthRequests, status: 'completed' },
        { stage: 'contract', name: '签订合同', count: totalContracts, status: 'in-progress' },
        { stage: 'delivery', name: '交付数据', count: totalDeliveries, status: 'pending' },
        { stage: 'confirmation', name: '确认收货', count: confirmedDeliveries, status: 'pending' },
      ],
      dailyData,
      filters: {
        industry: industry || null,
        region: region || null,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      },
    });
  } catch (err: any) {
    error(res, err.message || '获取交易进度失败');
  }
}
