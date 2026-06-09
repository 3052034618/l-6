import { Response } from 'express';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  total?: number;
  page?: number;
  pageSize?: number;
}

export function success<T>(res: Response, data?: T, message = 'success'): Response<ApiResponse<T>> {
  return res.json({
    code: 0,
    message,
    data,
  });
}

export function successWithPagination<T>(
  res: Response,
  data: T,
  total: number,
  page: number,
  pageSize: number,
  message = 'success'
): Response<ApiResponse<T>> {
  return res.json({
    code: 0,
    message,
    data,
    total,
    page,
    pageSize,
  });
}

export function error(res: Response, message: string, code = 1): Response<ApiResponse> {
  return res.json({
    code,
    message,
  });
}

export function notFound(res: Response, message = '资源不存在'): Response<ApiResponse> {
  return res.status(404).json({
    code: 404,
    message,
  });
}

export function unauthorized(res: Response, message = '未授权访问'): Response<ApiResponse> {
  return res.status(401).json({
    code: 401,
    message,
  });
}

export function forbidden(res: Response, message = '权限不足'): Response<ApiResponse> {
  return res.status(403).json({
    code: 403,
    message,
  });
}

export function badRequest(res: Response, message = '请求参数错误'): Response<ApiResponse> {
  return res.status(400).json({
    code: 400,
    message,
  });
}
