import { Router } from 'express';
import {
  getPlatformOverview,
  getTradeStats,
  getProviderStats,
  getConsumerStats,
  getRecentActivities,
  getTransactionProgress,
  getFunnelDetail,
  getTimeoutOrders,
  exportTimeoutOrdersByProvider,
} from '../controllers/stats.controller';
import { authMiddleware, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/overview', authMiddleware, requireAdmin, getPlatformOverview);
router.get('/trade', authMiddleware, requireAdmin, getTradeStats);
router.get('/transaction-progress', authMiddleware, requireAdmin, getTransactionProgress);
router.get('/funnel/:dimension', authMiddleware, requireAdmin, getFunnelDetail);
router.get('/timeout/export/provider', authMiddleware, requireAdmin, exportTimeoutOrdersByProvider);
router.get('/timeout/:dimension', authMiddleware, requireAdmin, getTimeoutOrders);
router.get('/provider', authMiddleware, getProviderStats);
router.get('/consumer', authMiddleware, getConsumerStats);
router.get('/activities', authMiddleware, requireAdmin, getRecentActivities);

export default router;
