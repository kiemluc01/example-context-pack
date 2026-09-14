import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { AuthUser } from './auth.types';
import { ALLOW_PENDING_PASSWORD, AllowPendingPasswordChange, CurrentUser, IS_PUBLIC, Public, ROLES, Roles } from './decorators';

class Routes {
  @Public()
  open() {}

  @Roles(Role.ADMIN, Role.HR)
  restricted() {}

  @AllowPendingPasswordChange()
  pending() {}

  withUser(@CurrentUser() _user: AuthUser) {}
}

describe('route decorators', () => {
  const reflector = new Reflector();

  it('store the metadata read by AuthGuard', () => {
    expect(reflector.get(IS_PUBLIC, Routes.prototype.open)).toBe(true);
    expect(reflector.get(ROLES, Routes.prototype.restricted)).toEqual([Role.ADMIN, Role.HR]);
    expect(reflector.get(ALLOW_PENDING_PASSWORD, Routes.prototype.pending)).toBe(true);
    expect(reflector.get(IS_PUBLIC, Routes.prototype.restricted)).toBeUndefined();
  });

  it('CurrentUser resolves the user attached to the request', () => {
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Routes, 'withUser') as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => unknown }
    >;
    const { factory } = Object.values(args)[0];
    const user: AuthUser = { id: 'u1', role: Role.HR, employeeId: 'e1', mustChangePassword: false };
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;

    expect(factory(undefined, ctx)).toBe(user);
  });
});
