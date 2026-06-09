import { Request, Response } from 'express';
import prisma from '../config/prisma';
import {
  success,
  error,
  forbidden,
  unauthorized,
  badRequest,
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

    const hasProductFilter = industry || region;
    if (hasProductFilter && productIds.length === 0) {
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : (() => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d;
      })();
      const dailyData = [];
      const currentDate = new Date(start);
      while (currentDate <= end) {
        dailyData.push({
          date: currentDate.toISOString().split('T')[0],
          authRequests: 0,
          contracts: 0,
          deliveries: 0,
          confirmations: 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      success(res, {
        summary: {
          authRequests: { total: 0, pending: 0, approved: 0, rejected: 0 },
          contracts: { total: 0, signed: 0, executing: 0, completed: 0 },
          deliveries: { total: 0, pending: 0, inProgress: 0, delivered: 0, confirmed: 0 },
        },
        conversionRates: {
          authToContract: '0%',
          contractToDelivery: '0%',
          deliveryConfirm: '0%',
          overallConversion: '0%',
        },
        stages: [
          { stage: 'authRequest', name: '授权申请', count: 0, status: 'completed' },
          { stage: 'contract', name: '签订合同', count: 0, status: 'in-progress' },
          { stage: 'delivery', name: '交付数据', count: 0, status: 'pending' },
          { stage: 'confirmation', name: '确认收货', count: 0, status: 'pending' },
        ],
        dailyData,
        filters: {
          industry: industry || null,
          region: region || null,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        },
      });
      return;
    }

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

export async function getFunnelDetail(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以查看漏斗明细');
      return;
    }

    const { dimension } = req.params;
    const industry = req.query.industry as string;
    const region = req.query.region as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const days = parseInt(req.query.days as string) || 30;

    if (!['product', 'provider', 'consumerOrg'].includes(dimension)) {
      badRequest(res, '维度参数不正确：product/provider/consumerOrg');
      return;
    }

    const productWhere: any = {};
    if (industry) productWhere.industry = industry;
    if (region) productWhere.region = region;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const productsWithProvider = await prisma.dataProduct.findMany({
      where: productWhere,
      include: {
        provider: { select: { id: true, fullName: true, organization: true } },
      },
    });
    const productIds = productsWithProvider.map((p) => p.id);

    const hasProductFilter = industry || region;
    if (hasProductFilter && productIds.length === 0) {
      success(res, {
        dimension,
        items: [],
        totalItems: 0,
        filters: {
          industry: industry || null,
          region: region || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      });
      return;
    }

    const authWhere: any = {};
    if (productIds.length > 0) authWhere.productId = { in: productIds };
    if (Object.keys(dateFilter).length > 0) authWhere.createdAt = dateFilter;

    const contractWhere: any = {};
    if (productIds.length > 0) contractWhere.productId = { in: productIds };
    if (Object.keys(dateFilter).length > 0) contractWhere.createdAt = dateFilter;

    const deliveryWhere: any = {};
    if (productIds.length > 0) deliveryWhere.productId = { in: productIds };
    if (Object.keys(dateFilter).length > 0) deliveryWhere.createdAt = dateFilter;

    let items: any[] = [];

    if (dimension === 'product') {
      const [authByProduct, contractByProduct, deliveryByProduct, confirmedByProduct] = await Promise.all([
        prisma.authorizationRequest.groupBy({
          by: ['productId'],
          where: authWhere,
          _count: { id: true },
        }),
        prisma.contract.groupBy({
          by: ['productId'],
          where: contractWhere,
          _count: { id: true },
        }),
        prisma.deliveryRecord.groupBy({
          by: ['productId'],
          where: deliveryWhere,
          _count: { id: true },
        }),
        prisma.deliveryRecord.groupBy({
          by: ['productId'],
          where: { ...deliveryWhere, status: DeliveryStatus.CONFIRMED },
          _count: { id: true },
        }),
      ]);

      const authMap = new Map<string, number>();
      const contractMap = new Map<string, number>();
      const deliveryMap = new Map<string, number>();
      const confirmedMap = new Map<string, number>();
      authByProduct.forEach((a: any) => authMap.set(a.productId, a._count.id));
      contractByProduct.forEach((c: any) => contractMap.set(c.productId, c._count.id));
      deliveryByProduct.forEach((d: any) => deliveryMap.set(d.productId, d._count.id));
      confirmedByProduct.forEach((d: any) => confirmedMap.set(d.productId, d._count.id));

      items = productsWithProvider.map((p) => {
        const authCount = authMap.get(p.id) || 0;
        const contractCount = contractMap.get(p.id) || 0;
        const deliveryCount = deliveryMap.get(p.id) || 0;
        const confirmedCount = confirmedMap.get(p.id) || 0;
        return {
          key: p.id,
          name: p.title,
          category: p.category,
          industry: p.industry,
          region: p.region,
          stages: {
            authRequest: authCount,
            contract: contractCount,
            delivery: deliveryCount,
            confirmation: confirmedCount,
          },
          conversionRates: {
            authToContract: authCount > 0 ? ((contractCount / authCount) * 100).toFixed(1) + '%' : '0%',
            contractToDelivery: contractCount > 0 ? ((deliveryCount / contractCount) * 100).toFixed(1) + '%' : '0%',
            deliveryConfirm: deliveryCount > 0 ? ((confirmedCount / deliveryCount) * 100).toFixed(1) + '%' : '0%',
            overall: authCount > 0 ? ((confirmedCount / authCount) * 100).toFixed(1) + '%' : '0%',
          },
        };
      });
    } else if (dimension === 'provider') {
      const providerMap = new Map<string, any>();
      for (const product of productsWithProvider) {
        const providerId = product.providerId;
        if (!providerMap.has(providerId)) {
          providerMap.set(providerId, {
            key: providerId,
            name: product.provider?.organization || product.provider?.fullName || '未知提供方',
            contact: product.provider?.fullName,
            productCount: 0,
            stages: {
              authRequest: 0,
              contract: 0,
              delivery: 0,
              confirmation: 0,
            },
            conversionRates: {
              authToContract: '0%',
              contractToDelivery: '0%',
              deliveryConfirm: '0%',
              overall: '0%',
            },
          });
        }
        providerMap.get(providerId).productCount++;
      }

      const productIdsByProvider = new Map<string, string[]>();
      for (const product of productsWithProvider) {
        if (!productIdsByProvider.has(product.providerId)) {
          productIdsByProvider.set(product.providerId, []);
        }
        productIdsByProvider.get(product.providerId)!.push(product.id);
      }

      for (const [providerId, pids] of productIdsByProvider) {
        const [authCount, contractCount, deliveryCount, confirmedCount] = await Promise.all([
          prisma.authorizationRequest.count({
            where: { ...authWhere, productId: { in: pids } },
          }),
          prisma.contract.count({
            where: { ...contractWhere, productId: { in: pids } },
          }),
          prisma.deliveryRecord.count({
            where: { ...deliveryWhere, productId: { in: pids } },
          }),
          prisma.deliveryRecord.count({
            where: { ...deliveryWhere, productId: { in: pids }, status: DeliveryStatus.CONFIRMED },
          }),
        ]);
        const item = providerMap.get(providerId);
        item.stages.authRequest = authCount;
        item.stages.contract = contractCount;
        item.stages.delivery = deliveryCount;
        item.stages.confirmation = confirmedCount;
        item.conversionRates = {
          authToContract: authCount > 0 ? ((contractCount / authCount) * 100).toFixed(1) + '%' : '0%',
          contractToDelivery: contractCount > 0 ? ((deliveryCount / contractCount) * 100).toFixed(1) + '%' : '0%',
          deliveryConfirm: deliveryCount > 0 ? ((confirmedCount / deliveryCount) * 100).toFixed(1) + '%' : '0%',
          overall: authCount > 0 ? ((confirmedCount / authCount) * 100).toFixed(1) + '%' : '0%',
        };
      }

      items = Array.from(providerMap.values());
    } else if (dimension === 'consumerOrg') {
      const consumerWhere: any = {};
      if (Object.keys(dateFilter).length > 0) consumerWhere.createdAt = dateFilter;
      if (productIds.length > 0) consumerWhere.productId = { in: productIds };

      const consumers = await prisma.user.findMany({
        where: { role: UserRole.CONSUMER },
        select: { id: true, fullName: true, organization: true },
      });
      const consumerMap = new Map(consumers.map((c) => [c.id, c]));

      const orgsMap = new Map<string, any>();
      const [authByConsumer, contractByConsumer, deliveryByConsumer, confirmedByConsumer] = await Promise.all([
        prisma.authorizationRequest.groupBy({
          by: ['consumerId'],
          where: consumerWhere,
          _count: { id: true },
        }),
        prisma.contract.groupBy({
          by: ['consumerId'],
          where: consumerWhere,
          _count: { id: true },
        }),
        prisma.deliveryRecord.groupBy({
          by: ['consumerId'],
          where: deliveryWhere,
          _count: { id: true },
        }),
        prisma.deliveryRecord.groupBy({
          by: ['consumerId'],
          where: { ...deliveryWhere, status: DeliveryStatus.CONFIRMED },
          _count: { id: true },
        }),
      ]);

      for (const a of authByConsumer) {
        const consumer = consumerMap.get(a.consumerId);
        const org = consumer?.organization || '未知机构';
        if (!orgsMap.has(org)) {
          orgsMap.set(org, {
            key: org,
            name: org,
            consumerCount: 0,
            authRequest: 0,
            contract: 0,
            delivery: 0,
            confirmation: 0,
          });
        }
        orgsMap.get(org).authRequest += a._count.id;
      }
      for (const c of contractByConsumer) {
        const consumer = consumerMap.get(c.consumerId);
        const org = consumer?.organization || '未知机构';
        if (!orgsMap.has(org)) {
          orgsMap.set(org, {
            key: org,
            name: org,
            consumerCount: 0,
            authRequest: 0,
            contract: 0,
            delivery: 0,
            confirmation: 0,
          });
        }
        orgsMap.get(org).contract += c._count.id;
      }
      for (const d of deliveryByConsumer) {
        const consumer = consumerMap.get(d.consumerId);
        const org = consumer?.organization || '未知机构';
        if (!orgsMap.has(org)) {
          orgsMap.set(org, {
            key: org,
            name: org,
            consumerCount: 0,
            authRequest: 0,
            contract: 0,
            delivery: 0,
            confirmation: 0,
          });
        }
        orgsMap.get(org).delivery += d._count.id;
      }
      for (const d of confirmedByConsumer) {
        const consumer = consumerMap.get(d.consumerId);
        const org = consumer?.organization || '未知机构';
        if (!orgsMap.has(org)) {
          orgsMap.set(org, {
            key: org,
            name: org,
            consumerCount: 0,
            authRequest: 0,
            contract: 0,
            delivery: 0,
            confirmation: 0,
          });
        }
        orgsMap.get(org).confirmation += d._count.id;
      }

      for (const item of orgsMap.values()) {
        item.stages = {
          authRequest: item.authRequest,
          contract: item.contract,
          delivery: item.delivery,
          confirmation: item.confirmation,
        };
        const authCount = item.authRequest;
        const contractCount = item.contract;
        const deliveryCount = item.delivery;
        const confirmedCount = item.confirmation;
        item.conversionRates = {
          authToContract: authCount > 0 ? ((contractCount / authCount) * 100).toFixed(1) + '%' : '0%',
          contractToDelivery: contractCount > 0 ? ((deliveryCount / contractCount) * 100).toFixed(1) + '%' : '0%',
          deliveryConfirm: deliveryCount > 0 ? ((confirmedCount / deliveryCount) * 100).toFixed(1) + '%' : '0%',
          overall: authCount > 0 ? ((confirmedCount / authCount) * 100).toFixed(1) + '%' : '0%',
        };
      }

      items = Array.from(orgsMap.values());
    }

    items.sort((a, b) => b.stages.authRequest - a.stages.authRequest);

    success(res, {
      dimension,
      items,
      totalItems: items.length,
      filters: {
        industry: industry || null,
        region: region || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (err: any) {
    error(res, err.message || '获取漏斗明细失败');
  }
}
