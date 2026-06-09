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
import { UserRole, ProductStatus } from '../types/enums';

export async function createReview(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    if (req.user.role !== UserRole.CONSUMER && req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有数据使用方可以发表评价');
      return;
    }

    const { productId, rating, content } = req.body;

    if (!productId || !rating || !content) {
      badRequest(res, '必填字段不能为空');
      return;
    }

    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 5) {
      badRequest(res, '评分必须在1-5之间');
      return;
    }

    const product = await prisma.dataProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      notFound(res, '产品不存在');
      return;
    }

    const hasDelivery = await prisma.deliveryRecord.findFirst({
      where: {
        productId,
        consumerId: req.user.userId,
        status: 'CONFIRMED',
      },
    });

    if (!hasDelivery && req.user.role !== UserRole.ADMIN) {
      badRequest(res, '您需要先使用该产品才能评价');
      return;
    }

    const existingReview = await prisma.review.findFirst({
      where: {
        productId,
        userId: req.user.userId,
        isDeleted: false,
      },
    });

    if (existingReview) {
      badRequest(res, '您已经评价过该产品');
      return;
    }

    const userId = req.user.userId;

    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          productId,
          userId,
          rating: ratingNum,
          content,
        },
      });

      const reviews = await tx.review.findMany({
        where: { productId, isDeleted: false },
        select: { rating: true },
      });

      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      await tx.dataProduct.update({
        where: { id: productId },
        data: {
          ratingAvg: parseFloat(avgRating.toFixed(1)),
          reviewCount: reviews.length,
        },
      });

      return newReview;
    });

    success(res, review, '评价发表成功');
  } catch (err: any) {
    error(res, err.message || '发表评价失败');
  }
}

export async function getProductReviews(req: Request, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const rating = req.query.rating as string;

    const where: any = {
      productId,
      isDeleted: false,
    };

    if (rating) {
      where.rating = parseInt(rating);
    }

    const skip = (page - 1) * pageSize;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    successWithPagination(res, reviews, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取评价列表失败');
  }
}

export async function getMyReviews(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const where: any = {
      userId: req.user.userId,
      isDeleted: false,
    };

    const skip = (page - 1) * pageSize;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
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
        },
      }),
      prisma.review.count({ where }),
    ]);

    successWithPagination(res, reviews, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取我的评价失败');
  }
}

export async function replyReview(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;
    const { reply } = req.body;

    if (!reply) {
      badRequest(res, '回复内容不能为空');
      return;
    }

    const review = await prisma.review.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!review) {
      notFound(res, '评价不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== review.product.providerId
    ) {
      forbidden(res, '您没有权限回复此评价');
      return;
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        reply,
        repliedAt: new Date(),
      },
    });

    success(res, updatedReview, '回复成功');
  } catch (err: any) {
    error(res, err.message || '回复评价失败');
  }
}

export async function deleteReview(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!review) {
      notFound(res, '评价不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== review.userId
    ) {
      forbidden(res, '您没有权限删除此评价');
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id },
        data: { isDeleted: true },
      });

      const reviews = await tx.review.findMany({
        where: { productId: review.productId, isDeleted: false },
        select: { rating: true },
      });

      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      await tx.dataProduct.update({
        where: { id: review.productId },
        data: {
          ratingAvg: parseFloat(avgRating.toFixed(1)),
          reviewCount: reviews.length,
        },
      });
    });

    success(res, null, '评价已删除');
  } catch (err: any) {
    error(res, err.message || '删除评价失败');
  }
}

export async function createReport(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { productId, reportType, title, description, evidence } = req.body;

    if (!productId || !reportType || !title || !description) {
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

    if (product.providerId === req.user.userId) {
      badRequest(res, '不能举报自己的产品');
      return;
    }

    const report = await prisma.report.create({
      data: {
        productId,
        reporterId: req.user.userId,
        reportType,
        title,
        description,
        evidence,
      },
    });

    success(res, report, '举报提交成功');
  } catch (err: any) {
    error(res, err.message || '提交举报失败');
  }
}

export async function getReports(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;
    const reportType = req.query.reportType as string;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (reportType) {
      where.reportType = reportType;
    }

    if (req.user.role === UserRole.CONSUMER || req.user.role === UserRole.PROVIDER) {
      where.reporterId = req.user.userId;
    } else if (req.user.role !== UserRole.ADMIN) {
      forbidden(res);
      return;
    }

    const skip = (page - 1) * pageSize;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
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
          reporter: {
            select: {
              id: true,
              fullName: true,
              organization: true,
            },
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    successWithPagination(res, reports, total, page, pageSize);
  } catch (err: any) {
    error(res, err.message || '获取举报列表失败');
  }
}

export async function getReportDetail(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        product: true,
        reporter: {
          select: {
            id: true,
            fullName: true,
            organization: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      notFound(res, '举报记录不存在');
      return;
    }

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.userId !== report.reporterId
    ) {
      forbidden(res, '您没有权限查看此举报');
      return;
    }

    success(res, report);
  } catch (err: any) {
    error(res, err.message || '获取举报详情失败');
  }
}

export async function handleReport(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      forbidden(res, '只有管理员可以处理举报');
      return;
    }

    const { id } = req.params;
    const { resolved, handleNote, freezeProduct } = req.body;

    const report = await prisma.report.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!report) {
      notFound(res, '举报记录不存在');
      return;
    }

    if (report.status !== 'PENDING' && report.status !== 'PROCESSING') {
      badRequest(res, '该举报已处理');
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id },
        data: {
          status: resolved ? 'RESOLVED' : 'DISMISSED',
          handlerId: req.user!.userId,
          handleNote,
          handledAt: new Date(),
        },
      });

      if (freezeProduct && report.product.status !== ProductStatus.FROZEN) {
        await tx.dataProduct.update({
          where: { id: report.productId },
          data: {
            status: ProductStatus.FROZEN,
            frozenReason: `因举报冻结: ${handleNote || '违规'}`,
          },
        });

        await tx.productAuditLog.create({
          data: {
            productId: report.productId,
            action: 'FREEZE_FROM_REPORT',
            oldStatus: report.product.status,
            newStatus: ProductStatus.FROZEN,
            operator: req.user!.userId,
            note: `举报ID: ${id}, ${handleNote || '违规冻结'}`,
          },
        });
      }
    });

    success(res, null, '举报处理完成');
  } catch (err: any) {
    error(res, err.message || '处理举报失败');
  }
}
