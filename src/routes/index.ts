import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import authorizationRoutes from './authorization.routes';
import deliveryRoutes from './delivery.routes';
import reviewRoutes from './review.routes';
import statsRoutes from './stats.routes';
import { apiDocs } from '../config/api-docs';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    code: 0,
    message: 'OK',
    data: {
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

router.get('/docs', (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: apiDocs,
  });
});

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/authz', authorizationRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/', reviewRoutes);
router.use('/stats', statsRoutes);

export default router;
