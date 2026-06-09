import { JwtPayload } from './jwt';
import { ProductStatus, UserRole } from '../types/enums';

export interface ProductVisibilityContext {
  user?: JwtPayload;
  status?: string;
  isPublic?: boolean;
  visibleTo?: string | null;
  providerId?: string;
}

export function parseVisibleTo(visibleTo: string | null | undefined): string[] {
  if (!visibleTo) return [];
  try {
    const parsed = JSON.parse(visibleTo);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isProductVisible(ctx: ProductVisibilityContext): boolean {
  const { user, status, isPublic, visibleTo, providerId } = ctx;

  if (status !== ProductStatus.APPROVED) {
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;
    if (user.role === UserRole.PROVIDER && user.userId === providerId) return true;
    return false;
  }

  if (!user) {
    return isPublic === true;
  }

  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.PROVIDER && user.userId === providerId) return true;

  if (isPublic === true) return true;

  if (user.role === UserRole.CONSUMER) {
    const visibleOrgList = parseVisibleTo(visibleTo);
    if (user.organization && visibleOrgList.includes(user.organization)) {
      return true;
    }
  }

  return false;
}

export function buildProductVisibilityWhere(user?: JwtPayload): any {
  if (!user) {
    return {
      status: ProductStatus.APPROVED,
      isPublic: true,
    };
  }

  if (user.role === UserRole.ADMIN) {
    return {};
  }

  if (user.role === UserRole.PROVIDER) {
    return {
      OR: [
        { status: ProductStatus.APPROVED, isPublic: true },
        { providerId: user.userId },
      ],
    };
  }

  if (user.role === UserRole.CONSUMER) {
    const userOrg = user.organization || '';
    return {
      status: ProductStatus.APPROVED,
      OR: [
        { isPublic: true },
        {
          isPublic: false,
          visibleTo: {
            contains: userOrg,
          },
        },
      ],
    };
  }

  return {
    status: ProductStatus.APPROVED,
    isPublic: true,
  };
}
