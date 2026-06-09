import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { unauthorized, forbidden } from '../utils/response';
import { UserRole } from '../types/enums';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    unauthorized(res, '请提供有效的访问令牌');
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    unauthorized(res, '访问令牌无效或已过期');
  }
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    req.user = payload;
  } catch (err) {
    // token 无效也继续，按未登录处理
  }

  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized(res, '请先登录');
      return;
    }

    if (!roles.includes(req.user.role)) {
      forbidden(res, '您没有权限执行此操作');
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireProvider = requireRole(UserRole.PROVIDER, UserRole.ADMIN);
export const requireConsumer = requireRole(UserRole.CONSUMER, UserRole.ADMIN);
