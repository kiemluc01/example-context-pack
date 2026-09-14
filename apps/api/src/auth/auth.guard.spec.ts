import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AUTH_COOKIE } from './auth.constants';
import { AuthGuard } from './auth.guard';
import type { AuthUser } from './auth.types';
import { ALLOW_PENDING_PASSWORD, IS_PUBLIC, ROLES } from './decorators';

const INVALID_SESSION = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn';

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    role: Role.HR as Role,
    employeeId: 'e1',
    mustChangePassword: false,
    sessionVersion: 2,
    employee: { deletedAt: null as Date | null },
    ...overrides,
  };
}

function setup(meta: Record<string, unknown> = {}) {
  const reflector = { getAllAndOverride: jest.fn((key: string) => meta[key]) };
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1', ver: 2 }) };
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(dbUser()) } };
  const req: { cookies?: Record<string, unknown>; user?: AuthUser } = { cookies: { [AUTH_COOKIE]: 'signed-token' } };
  const ctx = {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  const guard = new AuthGuard(reflector as unknown as Reflector, jwt as unknown as JwtService, prisma as unknown as PrismaService);
  return { guard, jwt, prisma, req, ctx };
}

describe('AuthGuard', () => {
  it('lets public routes through without a session', async () => {
    const { guard, jwt, req, ctx } = setup({ [IS_PUBLIC]: true });
    req.cookies = {};

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('requires the session cookie', async () => {
    const { guard, req, ctx } = setup();
    req.cookies = undefined;

    await expect(guard.canActivate(ctx)).rejects.toThrow(new UnauthorizedException('Bạn chưa đăng nhập'));
  });

  it('rejects a token that fails verification', async () => {
    const { guard, jwt, ctx } = setup();
    jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));

    await expect(guard.canActivate(ctx)).rejects.toThrow(new UnauthorizedException(INVALID_SESSION));
  });

  it.each([
    ['the user no longer exists', null],
    ['the employee was soft-deleted', dbUser({ employee: { deletedAt: new Date() } })],
    ['the session version was bumped', dbUser({ sessionVersion: 3 })],
  ])('rejects the session when %s', async (_label, user) => {
    const { guard, prisma, ctx } = setup();
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(guard.canActivate(ctx)).rejects.toThrow(new UnauthorizedException(INVALID_SESSION));
  });

  it('reloads the user and attaches it to the request', async () => {
    const { guard, jwt, prisma, req, ctx } = setup();

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(jwt.verifyAsync).toHaveBeenCalledWith('signed-token');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      include: { employee: { select: { deletedAt: true } } },
    });
    expect(req.user).toEqual({ id: 'u1', role: Role.HR, employeeId: 'e1', mustChangePassword: false });
  });

  it('blocks users with a temporary password unless the route allows it', async () => {
    const blocked = setup();
    blocked.prisma.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: true }));
    const err = await blocked.guard.canActivate(blocked.ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });

    const allowed = setup({ [ALLOW_PENDING_PASSWORD]: true });
    allowed.prisma.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: true }));
    await expect(allowed.guard.canActivate(allowed.ctx)).resolves.toBe(true);
  });

  it('enforces route roles', async () => {
    const adminOnly = setup({ [ROLES]: [Role.ADMIN] });
    await expect(adminOnly.guard.canActivate(adminOnly.ctx)).rejects.toThrow(
      new ForbiddenException('Bạn không có quyền thực hiện thao tác này'),
    );

    const staff = setup({ [ROLES]: [Role.ADMIN, Role.HR] });
    await expect(staff.guard.canActivate(staff.ctx)).resolves.toBe(true);
  });
});
