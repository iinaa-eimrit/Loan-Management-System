import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import { env, isProd } from '../config/env';
import type { Role } from '../constants';

export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
}

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
  maxAge: env.JWT_EXPIRES_IN_SECONDS * 1000,
};
