import { Role } from '@prisma/client';

/**
 * HR manages plain employees only. Records that hold an HR or Admin account
 * (including HR's own record, e.g. their salary) are managed by Admin.
 */
export function canManageTarget(actorRole: Role, targetAccountRole: Role | null | undefined): boolean {
  if (actorRole === Role.ADMIN) return true;
  if (actorRole === Role.HR) return !targetAccountRole || targetAccountRole === Role.EMPLOYEE;
  return false;
}

/** Only Admin may hand out HR or Admin accounts. */
export function canGrantRole(actorRole: Role, role: Role): boolean {
  if (actorRole === Role.ADMIN) return true;
  return actorRole === Role.HR && role === Role.EMPLOYEE;
}
