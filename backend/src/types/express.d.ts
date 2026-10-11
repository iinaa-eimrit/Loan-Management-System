import type { Role } from '../constants';

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
