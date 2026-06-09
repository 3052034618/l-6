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
import { ProductStatus, UserRole, UpdateFrequency } from '../types/enums';
import { buildProductVisibilityWhere, isProductVisible, parseVisibleTo } from '../utils/visibility';

export async function getProducts(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const keyword = req.query.keyword as string;
    const category = req.query.category as string;
    const industry = req.query.industry as string;
    const region = req.query.region as string;
    const updateFrequency = req.query.updateFrequency as string;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as string || 'desc';
    const minPrice = req.query.minPrice as string;
    const maxPrice = req.query.maxPrice as string;

    const visibilityWhere = buildProductVisibilityWhere(req.user);
    const where: any = {
      ...visibilityWhere,
    };

    if (keyword) {
      const keywordCondition = {
        OR: [
          { title: { contains: keyword } },
          { description: { contains: keyword } },
          { tags: { contains: keyword } },
        ],
      };
      if (where.OR) {
        where.AND = [keywordCondition];
      } else {
        where.OR = keywordCondition.OR;
      }
    }

    if (category) where.category = category;
    if (industry) where.industry = industry;
    if (region) where.region = region;
    if (updateFrequency) where.updateFrequency = updateFrequency as UpdateFrequency;

    if (minPrice) where.price = { ...where.price, gte: parseFloat(minPrice) };
    if (maxPrice) where.price = { ...where.price, lte: parseFloat(maxPrice) };

    const skip = (page - 1) * pageSize;

    const [products, total] = await Promise.all([
      prisma.dataProduct.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          industry: true,
          region: true,
          updateFrequency: true,
          dataVolume: true,
          dataFormat: true,
          pricingModel: true,
          price: true,
          priceUnit: true,
          tags: true,
          ratingAvg: true,
          reviewCount: true,
          viewCount: true,
          provider: {
            select: {
              id: true,
              fullName: true,
              organization: true,
            },
          },
          publishedAt: true,
          createdAt: true,
        },
      }),
      prisma.dataProduct.count({ where }),
    ]);

    successWithPagination(res, products, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取产品列表失败');
  }
}

export async function getProductDetail(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            fullName: true,
            organization: true,
            avatar: true,
          },
        },
      },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (!isProductVisible({
      user: req.user,
      status: product.status,
      isPublic: product.isPublic,
      visibleTo: product.visibleTo,
      providerId: product.providerId,
    })) {
      notFound(res, '产品不存在');
      return;
    }

    await prisma.dataProduct.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    await prisma.productViewLog.create({
      data: {
        productId: id,
        viewerId: req.user?.userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    success(res, product);
  } catch (err: any) {
    error(res, err.message || '获取产品详情失败');
  }
}

export async function getProductSample(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        sampleData: true,
        samplePreview: true,
        dataFormat: true,
        status: true,
        isPublic: true,
        visibleTo: true,
        providerId: true,
      },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (!isProductVisible({
      user: req.user,
      status: product.status,
      isPublic: product.isPublic,
      visibleTo: product.visibleTo,
      providerId: product.providerId,
    })) {
      notFound(res, '产品不存在');
      return;
    }

    success(res, {
      id: product.id,
      title: product.title,
      sampleData: product.sampleData,
      samplePreview: product.samplePreview,
      dataFormat: product.dataFormat,
    });
  } catch (err: any) {
    error(res, err.message || '获取样例数据失败');
  }
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    if (req.user.role !== UserRole.PROVIDER && req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有数据提供方可以上架产品');
      return;
    }

    const {
      title,
      description,
      category,
      industry,
      region,
      updateFrequency,
      dataVolume,
      dataFormat,
      sampleData,
      samplePreview,
      pricingModel,
      price,
      priceUnit,
      tags,
      isPublic,
      visibleTo,
    } = req.body;

    if (!title || !description || !category || !industry || !region || !updateFrequency || !pricingModel || price === undefined) {
      badRequest(res, '必填字段不能为空');
      return;
    }

    const product = await prisma.dataProduct.create({
      data: {
        title,
        description,
        category,
        industry,
        region,
        updateFrequency: updateFrequency as UpdateFrequency,
        dataVolume,
        dataFormat,
        sampleData,
        samplePreview,
        pricingModel,
        price: parseFloat(price),
        priceUnit,
        tags: tags || [],
        isPublic: isPublic !== false,
        visibleTo: visibleTo || [],
        providerId: req.user.userId,
        status: ProductStatus.DRAFT,
      },
    });

    success(res, product, '产品创建成功');
  } catch (err: any) {
    error(res, err.message || '创建产品失败');
  }
}

export async function submitForReview(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (product.providerId !== req.user.userId && req.user.role !== UserRole.ADMIN) {
      forbidden(res, '您没有权限操作此产品');
      return;
    }

    if (product.status !== ProductStatus.DRAFT && product.status !== ProductStatus.REJECTED) {
      badRequest(res, '只有草稿或已拒绝状态的产品可以提交审核');
      return;
    }

    const updatedProduct = await prisma.dataProduct.update({
      where: { id },
      data: {
        status: ProductStatus.PENDING_REVIEW,
      },
    });

    await prisma.productAuditLog.create({
      data: {
        productId: id,
        action: 'SUBMIT_REVIEW',
        oldStatus: product.status,
        newStatus: ProductStatus.PENDING_REVIEW,
        operator: req.user.userId,
        note: '提交审核',
      },
    });

    success(res, updatedProduct, '已提交审核');
  } catch (err: any) {
    error(res, err.message || '提交审核失败');
  }
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (product.providerId !== req.user.userId && req.user.role !== UserRole.ADMIN) {
      forbidden(res, '您没有权限修改此产品');
      return;
    }

    const {
      title,
      description,
      category,
      industry,
      region,
      updateFrequency,
      dataVolume,
      dataFormat,
      sampleData,
      samplePreview,
      pricingModel,
      price,
      priceUnit,
      tags,
      isPublic,
      visibleTo,
    } = req.body;

    const updatedProduct = await prisma.dataProduct.update({
      where: { id },
      data: {
        title,
        description,
        category,
        industry,
        region,
        updateFrequency: updateFrequency ? (updateFrequency as UpdateFrequency) : undefined,
        dataVolume,
        dataFormat,
        sampleData,
        samplePreview,
        pricingModel,
        price: price !== undefined ? parseFloat(price) : undefined,
        priceUnit,
        tags,
        isPublic,
        visibleTo,
      },
    });

    success(res, updatedProduct, '产品更新成功');
  } catch (err: any) {
    error(res, err.message || '更新产品失败');
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (product.providerId !== req.user.userId && req.user.role !== UserRole.ADMIN) {
      forbidden(res, '您没有权限删除此产品');
      return;
    }

    await prisma.dataProduct.delete({ where: { id } });

    success(res, null, '产品删除成功');
  } catch (err: any) {
    error(res, err.message || '删除产品失败');
  }
}

export async function getMyProducts(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;

    const where: any = {
      providerId: req.user.userId,
    };

    if (status) {
      where.status = status as ProductStatus;
    }

    const skip = (page - 1) * pageSize;

    const [products, total] = await Promise.all([
      prisma.dataProduct.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dataProduct.count({ where }),
    ]);

    successWithPagination(res, products, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取我的产品失败');
  }
}

export async function reviewProduct(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以审核产品');
      return;
    }

    const { id } = req.params;
    const { approved, reason } = req.body;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (product.status !== ProductStatus.PENDING_REVIEW) {
      badRequest(res, '只有待审核状态的产品可以审核');
      return;
    }

    const newStatus = approved ? ProductStatus.APPROVED : ProductStatus.REJECTED;

    const updatedProduct = await prisma.dataProduct.update({
      where: { id },
      data: {
        status: newStatus,
        rejectReason: approved ? null : reason,
        publishedAt: approved ? new Date() : null,
      },
    });

    await prisma.productAuditLog.create({
      data: {
        productId: id,
        action: approved ? 'APPROVE' : 'REJECT',
        oldStatus: product.status,
        newStatus: newStatus,
        operator: req.user.userId,
        note: reason || (approved ? '审核通过' : '审核拒绝'),
      },
    });

    success(res, updatedProduct, approved ? '审核通过' : '审核拒绝');
  } catch (err: any) {
    error(res, err.message || '审核操作失败');
  }
}

export async function freezeProduct(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以冻结产品');
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (product.status === ProductStatus.FROZEN) {
      badRequest(res, '产品已处于冻结状态');
      return;
    }

    const updatedProduct = await prisma.dataProduct.update({
      where: { id },
      data: {
        status: ProductStatus.FROZEN,
        frozenReason: reason,
      },
    });

    await prisma.productAuditLog.create({
      data: {
        productId: id,
        action: 'FREEZE',
        oldStatus: product.status,
        newStatus: ProductStatus.FROZEN,
        operator: req.user.userId,
        note: reason || '产品冻结',
      },
    });

    success(res, updatedProduct, '产品已冻结');
  } catch (err: any) {
    error(res, err.message || '冻结产品失败');
  }
}

export async function unfreezeProduct(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以解冻产品');
      return;
    }

    const { id } = req.params;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (product.status !== ProductStatus.FROZEN) {
      badRequest(res, '产品未处于冻结状态');
      return;
    }

    const updatedProduct = await prisma.dataProduct.update({
      where: { id },
      data: {
        status: ProductStatus.APPROVED,
        frozenReason: null,
      },
    });

    await prisma.productAuditLog.create({
      data: {
        productId: id,
        action: 'UNFREEZE',
        oldStatus: product.status,
        newStatus: ProductStatus.APPROVED,
        operator: req.user.userId,
        note: '产品解冻',
      },
    });

    success(res, updatedProduct, '产品已解冻');
  } catch (err: any) {
    error(res, err.message || '解冻产品失败');
  }
}

export async function setProductVisibility(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以配置可见范围');
      return;
    }

    const { id } = req.params;
    const { isPublic, visibleTo } = req.body;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    const updatedProduct = await prisma.dataProduct.update({
      where: { id },
      data: {
        isPublic: isPublic !== undefined ? isPublic : product.isPublic,
        visibleTo: visibleTo || product.visibleTo,
      },
    });

    success(res, updatedProduct, '可见范围配置成功');
  } catch (err: any) {
    error(res, err.message || '配置可见范围失败');
  }
}

export async function getPendingReviewProducts(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以查看待审核列表');
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const skip = (page - 1) * pageSize;

    const [products, total] = await Promise.all([
      prisma.dataProduct.findMany({
        where: { status: ProductStatus.PENDING_REVIEW },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
        include: {
          provider: {
            select: {
              id: true,
              fullName: true,
              organization: true,
            },
          },
        },
      }),
      prisma.dataProduct.count({ where: { status: ProductStatus.PENDING_REVIEW } }),
    ]);

    successWithPagination(res, products, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取待审核列表失败');
  }
}

export async function getProductCategories(req: Request, res: Response): Promise<void> {
  try {
    const products = await prisma.dataProduct.findMany({
      where: { status: ProductStatus.APPROVED },
      select: { category: true, industry: true, region: true },
      distinct: ['category', 'industry', 'region'],
    });

    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
    const industries = [...new Set(products.map((p) => p.industry).filter(Boolean))];
    const regions = [...new Set(products.map((p) => p.region).filter(Boolean))];
    const frequencies = Object.values(UpdateFrequency);

    success(res, {
      categories,
      industries,
      regions,
      frequencies,
    });
  } catch (err: any) {
    error(res, err.message || '获取筛选条件失败');
  }
}

export async function getProductAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const product = await prisma.dataProduct.findUnique({
      where: { id },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    if (req.user) {
      if (req.user.role !== UserRole.ADMIN && req.user.userId !== product.providerId) {
        forbidden(res, '您没有权限查看审核记录');
        return;
      }
    } else {
      forbidden(res);
      return;
    }

    const logs = await prisma.productAuditLog.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
    });

    success(res, logs);
  } catch (err: any) {
    error(res, err.message || '获取审核记录失败');
  }
}
