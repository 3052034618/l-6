import { Router } from 'express';
import {
  login,
  register,
  getCurrentUser,
  updateProfile,
  changePassword,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/profile', authMiddleware, getCurrentUser);
router.put('/profile', authMiddleware, updateProfile);
router.put('/password', authMiddleware, changePassword);

export default router;
