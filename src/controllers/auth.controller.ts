import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { success, error, unauthorized, badRequest } from '../utils/response';
import { generateToken } from '../utils/jwt';
import { comparePassword, hashPassword } from '../utils/password';
import { UserRole } from '../types/enums';

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      badRequest(res, '用户名和密码不能为空');
      return;
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      unauthorized(res, '用户名或密码错误');
      return;
    }

    if (!user.isActive) {
      unauthorized(res, '账户已被禁用，请联系管理员');
      return;
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      unauthorized(res, '用户名或密码错误');
      return;
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as UserRole,
      organization: user.organization,
    });

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
        organization: user.organization,
        phone: user.phone,
        avatar: user.avatar,
      },
    }, '登录成功');
  } catch (err: any) {
    error(res, err.message || '登录失败');
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { username, email, password, fullName, role, organization, phone } = req.body;

    if (!username || !email || !password || !fullName || !role) {
      badRequest(res, '必填字段不能为空');
      return;
    }

    if (!Object.values(UserRole).includes(role as UserRole)) {
      badRequest(res, '无效的用户角色');
      return;
    }

    if (role === UserRole.ADMIN) {
      badRequest(res, '不允许注册管理员账户');
      return;
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      badRequest(res, '用户名或邮箱已存在');
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        fullName,
        role: role as UserRole,
        organization,
        phone,
      },
    });

    const token = generateToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as UserRole,
      organization: user.organization,
    });

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
        organization: user.organization,
        phone: user.phone,
      },
    }, '注册成功');
  } catch (err: any) {
    error(res, err.message || '注册失败');
  }
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      unauthorized(res, '用户不存在');
      return;
    }

    success(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      organization: user.organization,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    error(res, err.message || '获取用户信息失败');
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { fullName, email, phone, organization, avatar } = req.body;

    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: req.user.userId },
        },
      });

      if (existingUser) {
        badRequest(res, '邮箱已被使用');
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        fullName,
        email,
        phone,
        organization,
        avatar,
      },
    });

    success(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      organization: user.organization,
      phone: user.phone,
      avatar: user.avatar,
    }, '更新成功');
  } catch (err: any) {
    error(res, err.message || '更新失败');
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      badRequest(res, '原密码和新密码不能为空');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      unauthorized(res, '用户不存在');
      return;
    }

    const isOldPasswordValid = await comparePassword(oldPassword, user.password);

    if (!isOldPasswordValid) {
      badRequest(res, '原密码错误');
      return;
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashedNewPassword },
    });

    success(res, null, '密码修改成功');
  } catch (err: any) {
    error(res, err.message || '修改密码失败');
  }
}
