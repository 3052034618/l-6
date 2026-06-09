import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '../types/enums';

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(
    payload as object,
    config.jwtSecret as string,
    { expiresIn: config.jwtExpiresIn as any }
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret as string) as JwtPayload;
}

