import type { Role } from '@prisma/client';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  role: Role;
  employeeId: string;
  mustChangePassword: boolean;
}

/** JWT claims: user id and the session version it was issued for. */
export interface SessionPayload {
  sub: string;
  ver: number;
}

export interface RequestWithUser extends Request {
  user?: AuthUser;
}
