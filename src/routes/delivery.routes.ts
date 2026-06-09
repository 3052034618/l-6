import { Router } from 'express';
import {
  createDelivery,
  getDeliveryList,
  getDeliveryDetail,
  confirmDelivery,
  markDelivered,
  markDeliveryFailed,
  reviewDeliveryFailed,
  getDeliveryProof,
  verifyDeliveryProof,
} from '../controllers/delivery.controller';
import { authMiddleware, requireAdmin, requireProvider } from '../middleware/auth.middleware';

const router = Router();

router.get('/verify/:proofHash', verifyDeliveryProof);
router.get('/', authMiddleware, getDeliveryList);
router.get('/:id', authMiddleware, getDeliveryDetail);
router.get('/:id/proof', authMiddleware, getDeliveryProof);
router.post('/', authMiddleware, requireProvider, createDelivery);
router.post('/:id/deliver', authMiddleware, requireProvider, markDelivered);
router.post('/:id/fail', authMiddleware, requireProvider, markDeliveryFailed);
router.post('/:id/review-failed', authMiddleware, requireAdmin, reviewDeliveryFailed);
router.post('/:id/confirm', authMiddleware, confirmDelivery);

export default router;
