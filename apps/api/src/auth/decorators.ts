import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { AuthUser, RequestWithUser } from './auth.types';

export const IS_PUBLIC = 'auth:isPublic';
export const ROLES = 'auth:roles';
export const ALLOW_PENDING_PASSWORD = 'auth:allowPendingPassword'; // metadata key, not a credential. context-pack-registry:allow-secret

/** Route needs no session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route is restricted to the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Route stays reachable while the user still has to replace a temporary password. */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<RequestWithUser>().user!,
);
