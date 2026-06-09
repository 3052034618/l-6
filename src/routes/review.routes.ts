import { Router } from 'express';
import {
  createReview,
  getProductReviews,
  getMyReviews,
  replyReview,
  deleteReview,
  createReport,
  getReports,
  getReportDetail,
  handleReport,
} from '../controllers/review.controller';
import { authMiddleware, requireAdmin, requireProvider } from '../middleware/auth.middleware';

const router = Router();

router.get('/reviews/mine', authMiddleware, getMyReviews);
router.get('/reviews/product/:productId', getProductReviews);
router.post('/reviews', authMiddleware, createReview);
router.post('/reviews/:id/reply', authMiddleware, requireProvider, replyReview);
router.delete('/reviews/:id', authMiddleware, deleteReview);

router.get('/reports', authMiddleware, getReports);
router.get('/reports/:id', authMiddleware, getReportDetail);
router.post('/reports', authMiddleware, createReport);
router.post('/reports/:id/handle', authMiddleware, requireAdmin, handleReport);

export default router;
