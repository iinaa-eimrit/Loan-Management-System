import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User';
import { AUTH_COOKIE } from '../constants';
import { HttpError } from '../utils/HttpError';
import { signToken, authCookieOptions } from '../utils/tokens';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

const BCRYPT_ROUNDS = 10;

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

function publicUser(u: { _id: unknown; name: string; email: string; role: string }) {
  return { id: String(u._id), name: u.name, email: u.email, role: u.role };
}

// POST /api/auth/signup
authRouter.post('/signup', async (req, res) => {
  const { name, email, password } = signupSchema.parse(req.body);

  if (await User.exists({ email })) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email, passwordHash, role: 'borrower' });

  res.cookie(AUTH_COOKIE, signToken({ sub: String(user._id), role: user.role }), authCookieOptions);
  res.status(201).json({ user: publicUser(user) });
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) {
    throw new HttpError(401, 'Invalid email or password');
  }

  res.cookie(AUTH_COOKIE, signToken({ sub: String(user._id), role: user.role }), authCookieOptions);
  res.json({ user: publicUser(user) });
});

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  const { maxAge: _ignored, ...opts } = authCookieOptions;
  res.clearCookie(AUTH_COOKIE, opts);
  res.json({ ok: true });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
