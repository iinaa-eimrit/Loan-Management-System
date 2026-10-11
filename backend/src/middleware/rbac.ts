import type { RequestHandler } from 'express';
import type { Role } from '../constants';
import { HttpError } from '../utils/HttpError';

export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new HttpError(401, 'Not authenticated');
    if (!allowed.includes(req.user.role)) {
      throw new HttpError(403, `Forbidden: requires role ${allowed.join(' or ')}`);
    }
    next();
  };
}
