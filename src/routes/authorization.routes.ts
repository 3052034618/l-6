import { Router } from 'express';
import {
  createAuthRequest,
  getMyAuthRequests,
  getReceivedAuthRequests,
  getAuthRequestDetail,
  approveAuthRequest,
  rejectAuthRequest,
  revokeAuthRequest,
  getContracts,
  getContractDetail,
} from '../controllers/authorization.controller';
import { authMiddleware, requireProvider, requireConsumer } from '../middleware/auth.middleware';

const router = Router();

router.get('/requests/mine', authMiddleware, getMyAuthRequests);
router.get('/requests/received', authMiddleware, getReceivedAuthRequests);
router.get('/requests/:id', authMiddleware, getAuthRequestDetail);
router.post('/requests', authMiddleware, requireConsumer, createAuthRequest);
router.post('/requests/:id/approve', authMiddleware, requireProvider, approveAuthRequest);
router.post('/requests/:id/reject', authMiddleware, requireProvider, rejectAuthRequest);
router.post('/requests/:id/revoke', authMiddleware, requireProvider, revokeAuthRequest);

router.get('/contracts', authMiddleware, getContracts);
router.get('/contracts/:id', authMiddleware, getContractDetail);

export default router;
