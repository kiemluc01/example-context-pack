import { Role } from '@prisma/client';
import { canGrantRole, canManageTarget } from './access';

describe('canManageTarget', () => {
  it.each([
    [Role.ADMIN, null, true],
    [Role.ADMIN, Role.ADMIN, true],
    [Role.ADMIN, Role.HR, true],
    [Role.HR, null, true],
    [Role.HR, undefined, true],
    [Role.HR, Role.EMPLOYEE, true],
    [Role.HR, Role.HR, false],
    [Role.HR, Role.ADMIN, false],
    [Role.EMPLOYEE, null, false],
    [Role.EMPLOYEE, Role.EMPLOYEE, false],
  ])('%s managing a record with account %s -> %s', (actor, target, expected) => {
    expect(canManageTarget(actor, target)).toBe(expected);
  });
});

describe('canGrantRole', () => {
  it.each([
    [Role.ADMIN, Role.ADMIN, true],
    [Role.ADMIN, Role.HR, true],
    [Role.ADMIN, Role.EMPLOYEE, true],
    [Role.HR, Role.EMPLOYEE, true],
    [Role.HR, Role.HR, false],
    [Role.HR, Role.ADMIN, false],
    [Role.EMPLOYEE, Role.EMPLOYEE, false],
  ])('%s granting %s -> %s', (actor, role, expected) => {
    expect(canGrantRole(actor, role)).toBe(expected);
  });
});
