import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { AuthUser, SessionPayload } from './auth.types';
import { hashPassword, verifyPassword } from './password';

const CURRENT = 'Matkhau123';
const NEXT = 'MatKhauMoi456';
const WRONG = 'Sai123456';
const BAD_LOGIN = new UnauthorizedException('Email hoặc mật khẩu không đúng');

const employeeRow = { id: 'e1', code: 'NV0001', fullName: 'Nguyễn Văn An', email: 'an@congty.vn', deletedAt: null as Date | null };
const sessionUser = {
  id: 'u1',
  role: Role.EMPLOYEE,
  mustChangePassword: true,
  employee: { id: 'e1', code: 'NV0001', fullName: 'Nguyễn Văn An', email: 'an@congty.vn' },
};
const actor: AuthUser = { id: 'u1', role: Role.EMPLOYEE, employeeId: 'e1', mustChangePassword: true };

async function setup() {
  const user = {
    id: 'u1',
    employeeId: 'e1',
    role: Role.EMPLOYEE,
    mustChangePassword: true,
    sessionVersion: 3,
    passwordHash: await hashPassword(CURRENT),
  };
  const prisma = {
    employee: { findUnique: jest.fn() },
    user: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
  };
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const service = new AuthService(prisma as unknown as PrismaService, jwt);
  return { user, prisma, jwt, service };
}

describe('AuthService', () => {
  describe('login', () => {
    it('returns a token bound to the session version and the session user', async () => {
      const { user, prisma, jwt, service } = await setup();
      prisma.employee.findUnique.mockResolvedValue({ ...employeeRow, user });

      const result = await service.login({ email: 'an@congty.vn', password: CURRENT });

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({ where: { email: 'an@congty.vn' }, include: { user: true } });
      expect(result.user).toEqual(sessionUser);
      expect(await jwt.verifyAsync<SessionPayload>(result.token)).toMatchObject({ sub: 'u1', ver: 3 });
    });

    it('rejects a wrong password', async () => {
      const { user, prisma, service } = await setup();
      prisma.employee.findUnique.mockResolvedValue({ ...employeeRow, user });

      await expect(service.login({ email: 'an@congty.vn', password: WRONG })).rejects.toThrow(BAD_LOGIN);
    });

    it.each([
      ['an unknown email', () => null],
      ['a soft-deleted employee', (user: object) => ({ ...employeeRow, deletedAt: new Date(), user })],
      ['an employee without an account', () => ({ ...employeeRow, user: null })],
    ])('gives the same answer for %s', async (_label, found) => {
      const { user, prisma, service } = await setup();
      prisma.employee.findUnique.mockResolvedValue(found(user));

      await expect(service.login({ email: 'an@congty.vn', password: CURRENT })).rejects.toThrow(BAD_LOGIN);
    });
  });

  it('me loads the session user', async () => {
    const { user, prisma, service } = await setup();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ ...user, employee: employeeRow });

    await expect(service.me('u1')).resolves.toEqual(sessionUser);
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'u1' }, include: { employee: true } });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password', async () => {
      const { user, prisma, service } = await setup();
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);

      await expect(service.changePassword(actor, { currentPassword: WRONG, newPassword: NEXT })).rejects.toThrow(
        new BadRequestException('Mật khẩu hiện tại không đúng'),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects reusing the current password', async () => {
      const { user, prisma, service } = await setup();
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);

      await expect(service.changePassword(actor, { currentPassword: CURRENT, newPassword: CURRENT })).rejects.toThrow(
        new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại'),
      );
    });

    it('stores the new hash, clears the flag, revokes other sessions and issues a fresh token', async () => {
      const { user, prisma, jwt, service } = await setup();
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({ ...user, mustChangePassword: false, sessionVersion: 4, employee: employeeRow });

      const result = await service.changePassword(actor, { currentPassword: CURRENT, newPassword: NEXT });

      const { where, data } = prisma.user.update.mock.calls[0][0];
      expect(where).toEqual({ id: 'u1' });
      expect(data).toMatchObject({ mustChangePassword: false, sessionVersion: { increment: 1 } });
      expect(await verifyPassword(NEXT, data.passwordHash)).toBe(true);
      expect(result.user.mustChangePassword).toBe(false);
      expect(await jwt.verifyAsync<SessionPayload>(result.token)).toMatchObject({ sub: 'u1', ver: 4 });
    });
  });
});
