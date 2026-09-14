import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AUTH_COOKIE, SESSION_TTL_SECONDS } from './auth.constants';
import { AuthController } from './auth.controller';
import type { AuthService, SessionUser } from './auth.service';
import type { AuthUser } from './auth.types';
import { ALLOW_PENDING_PASSWORD, IS_PUBLIC } from './decorators';

const sessionUser: SessionUser = {
  id: 'u1',
  role: Role.HR,
  mustChangePassword: false,
  employee: { id: 'e1', code: 'HR001', fullName: 'Trần Thị Hà', email: 'ha@congty.vn' },
};
const actor: AuthUser = { id: 'u1', role: Role.HR, employeeId: 'e1', mustChangePassword: false };
const CURRENT = 'Matkhau123';
const NEXT = 'MatKhauMoi456';

function setup() {
  const service = { login: jest.fn(), me: jest.fn(), changePassword: jest.fn() };
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };
  const controller = new AuthController(service as unknown as AuthService);
  return { service, res, response: res as unknown as Response, controller };
}

describe('AuthController', () => {
  it('login sets an httpOnly session cookie and returns the user', async () => {
    const { service, res, response, controller } = setup();
    service.login.mockResolvedValue({ token: 'signed', user: sessionUser });
    const dto = { email: 'ha@congty.vn', password: CURRENT };

    await expect(controller.login(dto, response)).resolves.toBe(sessionUser);

    expect(service.login).toHaveBeenCalledWith(dto);
    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE, 'signed', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  });

  it('logout clears the session cookie with the same options', () => {
    const { res, response, controller } = setup();

    controller.logout(response);

    expect(res.clearCookie).toHaveBeenCalledWith(AUTH_COOKIE, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
  });

  it('me returns the current session user', async () => {
    const { service, controller } = setup();
    service.me.mockResolvedValue(sessionUser);

    await expect(controller.me(actor)).resolves.toBe(sessionUser);
    expect(service.me).toHaveBeenCalledWith('u1');
  });

  it('changePassword replaces the session cookie with a fresh token', async () => {
    const { service, res, response, controller } = setup();
    service.changePassword.mockResolvedValue({ token: 'fresh', user: sessionUser });
    const dto = { currentPassword: CURRENT, newPassword: NEXT };

    await expect(controller.changePassword(actor, dto, response)).resolves.toBe(sessionUser);

    expect(service.changePassword).toHaveBeenCalledWith(actor, dto);
    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE, 'fresh', expect.objectContaining({ maxAge: SESSION_TTL_SECONDS * 1000 }));
  });

  it('keeps login and logout public and lets pending-password users reach me and change-password', () => {
    const reflector = new Reflector();
    const proto = AuthController.prototype;

    expect(reflector.get(IS_PUBLIC, proto.login)).toBe(true);
    expect(reflector.get(IS_PUBLIC, proto.logout)).toBe(true);
    expect(reflector.get(IS_PUBLIC, proto.me)).toBeUndefined();
    expect(reflector.get(ALLOW_PENDING_PASSWORD, proto.me)).toBe(true);
    expect(reflector.get(ALLOW_PENDING_PASSWORD, proto.changePassword)).toBe(true);
  });
});
