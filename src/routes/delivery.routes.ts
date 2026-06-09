import { Router } from 'express';
import {
  createDelivery,
  getDeliveryList,
  getDeliveryDetail,
  confirmDelivery,
  markDelivered,
  markDeliveryFailed,
  getDeliveryProof,
  verifyDeliveryProof,
} from '../controllers/delivery.controller';
import { authMiddleware, requireProvider } from '../middleware/auth.middleware';

const router = Router();

router.get('/verify/:proofHash', verifyDeliveryProof);
router.get('/', authMiddleware, getDeliveryList);
router.get('/:id', authMiddleware, getDeliveryDetail);
router.get('/:id/proof', authMiddleware, getDeliveryProof);
router.post('/', authMiddleware, requireProvider, createDelivery);
router.post('/:id/deliver', authMiddleware, requireProvider, markDelivered);
router.post('/:id/fail', authMiddleware, requireProvider, markDeliveryFailed);
router.post('/:id/confirm', authMiddleware, confirmDelivery);

export default router;
