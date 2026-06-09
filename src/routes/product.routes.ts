import { Router } from 'express';
import {
  getProducts,
  getProductDetail,
  getProductSample,
  createProduct,
  submitForReview,
  updateProduct,
  deleteProduct,
  getMyProducts,
  reviewProduct,
  freezeProduct,
  unfreezeProduct,
  setProductVisibility,
  batchSetVisibility,
  getPendingReviewProducts,
  getProductCategories,
  getProductAuditLogs,
} from '../controllers/product.controller';
import { authMiddleware, optionalAuthMiddleware, requireAdmin, requireProvider } from '../middleware/auth.middleware';

const router = Router();

router.get('/categories', getProductCategories);
router.get('/', optionalAuthMiddleware, getProducts);
router.get('/mine', authMiddleware, getMyProducts);
router.get('/pending-review', authMiddleware, requireAdmin, getPendingReviewProducts);
router.get('/:id', optionalAuthMiddleware, getProductDetail);
router.get('/:id/sample', optionalAuthMiddleware, getProductSample);
router.get('/:id/audit-logs', authMiddleware, getProductAuditLogs);

router.post('/', authMiddleware, createProduct);
router.post('/:id/submit-review', authMiddleware, submitForReview);
router.put('/:id', authMiddleware, updateProduct);
router.delete('/:id', authMiddleware, deleteProduct);

router.post('/:id/review', authMiddleware, requireAdmin, reviewProduct);
router.post('/:id/freeze', authMiddleware, requireAdmin, freezeProduct);
router.post('/:id/unfreeze', authMiddleware, requireAdmin, unfreezeProduct);
router.put('/batch/visibility', authMiddleware, requireAdmin, batchSetVisibility);
router.put('/:id/visibility', authMiddleware, requireAdmin, setProductVisibility);

export default router;
