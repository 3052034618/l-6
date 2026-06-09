import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[Error]', err.message, err.stack);

  if (err.name === 'PrismaClientKnownRequestError') {
    error(res, '数据库操作异常', 500);
    return;
  }

  error(res, err.message || '服务器内部错误', 500);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 404,
    message: `接口 ${req.method} ${req.path} 不存在`,
  });
}
