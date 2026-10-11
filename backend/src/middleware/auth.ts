import type { RequestHandler } from 'express';
import { AUTH_COOKIE } from '../constants';
import { User } from '../models/User';
import { HttpError } from '../utils/HttpError';
import { verifyToken, type TokenPayload } from '../utils/tokens';

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  const token: string | undefined = req.cookies?.[AUTH_COOKIE] ?? bearer;

  if (!token) throw new HttpError(401, 'Not authenticated');

  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Session expired or invalid. Please log in again.');
  }

  const user = await User.findById(payload.sub).select('name email role').lean();
  if (!user) throw new HttpError(401, 'User no longer exists');

  req.user = { id: String(user._id), role: user.role, name: user.name, email: user.email };
  next();
};
