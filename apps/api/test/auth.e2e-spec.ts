import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  NEW_PASSWORD,
  PASSWORD,
  WRONG_PASSWORD,
  createEmployeeWithAccount,
  createTestApp,
  employeeData,
  login,
  resetDatabase,
} from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const http = () => request(app.getHttpServer());

  describe('login', () => {
    it('accepts valid credentials case-insensitively and sets an httpOnly SameSite cookie', async () => {
      const hr = await createEmployeeWithAccount(prisma, Role.HR);

      const res = await http().post('/api/auth/login').send({ email: ` ${hr.email.toUpperCase()} `, password: PASSWORD }).expect(200);

      expect(res.body).toEqual({
        id: hr.user!.id,
        role: 'HR',
        mustChangePassword: false,
        employee: { id: hr.id, code: hr.code, fullName: hr.fullName, email: hr.email },
      });
      const cookie = ([] as string[]).concat(res.headers['set-cookie'])[0];
      expect(cookie).toMatch(/^access_token=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
    });

    it('returns the same 401 message for a wrong password and an unknown email', async () => {
      const emp = await createEmployeeWithAccount(prisma, Role.EMPLOYEE);

      const wrong = await http().post('/api/auth/login').send({ email: emp.email, password: WRONG_PASSWORD }).expect(401);
      const unknown = await http().post('/api/auth/login').send({ email: 'khongco@test.vn', password: PASSWORD }).expect(401);

      expect(wrong.body.message).toBe('Email hoặc mật khẩu không đúng');
      expect(unknown.body.message).toBe(wrong.body.message);
      expect(wrong.headers['set-cookie']).toBeUndefined();
    });

    it('rejects a soft-deleted employee and an employee without an account', async () => {
      const emp = await createEmployeeWithAccount(prisma, Role.EMPLOYEE);
      await prisma.employee.update({ where: { id: emp.id }, data: { deletedAt: new Date(), status: 'RESIGNED' } });
      const noAccount = await prisma.employee.create({ data: employeeData() });

      await http().post('/api/auth/login').send({ email: emp.email, password: PASSWORD }).expect(401);
      await http().post('/api/auth/login').send({ email: noAccount.email, password: PASSWORD }).expect(401);
    });

    it('validates the payload', async () => {
      const res = await http().post('/api/auth/login').send({ email: 'khong-phai-email', password: '' }).expect(400);
      expect(res.body.message).toEqual(expect.arrayContaining(['Email không hợp lệ', 'Vui lòng nhập mật khẩu']));
    });

    it('throttles repeated attempts from the same client', async () => {
      const previous = process.env.LOGIN_RATE_LIMIT;
      process.env.LOGIN_RATE_LIMIT = '3';
      const isolated = await createTestApp(); // fresh throttler storage
      try {
        const attempt = () =>
          request(isolated.app.getHttpServer()).post('/api/auth/login').send({ email: 'x@test.vn', password: WRONG_PASSWORD });
        for (let i = 0; i < 3; i++) await attempt().expect(401);
        await attempt().expect(429);
      } finally {
        process.env.LOGIN_RATE_LIMIT = previous;
        await isolated.app.close();
      }
    });
  });

  describe('session', () => {
    it('requires a session on protected routes', async () => {
      await http().get('/api/auth/me').expect(401);
      await http().get('/api/employees').expect(401);
      await http().get('/api/employees/me').expect(401);
    });

    it('rejects a forged token', async () => {
      await http().get('/api/auth/me').set('Cookie', 'access_token=eyJhbGciOiJIUzI1NiJ9.e30.invalid').expect(401);
    });

    it('logout clears the cookie', async () => {
      const emp = await createEmployeeWithAccount(prisma, Role.EMPLOYEE);
      const agent = await login(app, emp.email);
      await agent.get('/api/auth/me').expect(200);

      await agent.post('/api/auth/logout').expect(204);

      await agent.get('/api/auth/me').expect(401);
    });

    it('locks an active session as soon as the employee is soft-deleted', async () => {
      const emp = await createEmployeeWithAccount(prisma, Role.EMPLOYEE);
      const agent = await login(app, emp.email);

      await prisma.employee.update({ where: { id: emp.id }, data: { deletedAt: new Date(), status: 'RESIGNED' } });

      await agent.get('/api/auth/me').expect(401);
    });

    it('applies role changes on the next request', async () => {
      const hr = await createEmployeeWithAccount(prisma, Role.HR);
      const agent = await login(app, hr.email);
      await agent.get('/api/employees').expect(200);

      await prisma.user.update({ where: { id: hr.user!.id }, data: { role: Role.EMPLOYEE } });

      await agent.get('/api/employees').expect(403);
    });
  });

  describe('password change', () => {
    it('blocks every other route until a temporary password is replaced', async () => {
      const emp = await createEmployeeWithAccount(prisma, Role.EMPLOYEE, { mustChangePassword: true });
      const agent = await login(app, emp.email);

      const blocked = await agent.get('/api/employees/me').expect(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.body.mustChangePassword).toBe(true);

      const changed = await agent
        .post('/api/auth/change-password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);

      expect(changed.body.mustChangePassword).toBe(false);
      await agent.get('/api/employees/me').expect(200);
      await http().post('/api/auth/login').send({ email: emp.email, password: NEW_PASSWORD }).expect(200);
      await http().post('/api/auth/login').send({ email: emp.email, password: PASSWORD }).expect(401);
    });

    it('rejects a wrong current password, a weak password and reusing the current one', async () => {
      const emp = await createEmployeeWithAccount(prisma, Role.EMPLOYEE);
      const agent = await login(app, emp.email);

      const wrong = await agent.post('/api/auth/change-password').send({ currentPassword: WRONG_PASSWORD, newPassword: NEW_PASSWORD }).expect(400);
      expect(wrong.body.message).toBe('Mật khẩu hiện tại không đúng');

      for (const weak of ['short1', 'chicochuthoi', '1234567890', 'a1'.repeat(40)]) {
        const res = await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: weak }).expect(400);
        expect(res.body.message).toEqual(['Mật khẩu phải từ 8–72 ký tự, gồm cả chữ và số']);
      }

      const same = await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: PASSWORD }).expect(400);
      expect(same.body.message).toBe('Mật khẩu mới phải khác mật khẩu hiện tại');
    });

    it('signs out other sessions but keeps the current one', async () => {
      const emp = await createEmployeeWithAccount(prisma, Role.EMPLOYEE);
      const current = await login(app, emp.email);
      const other = await login(app, emp.email);

      await current.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD }).expect(200);

      await current.get('/api/auth/me').expect(200);
      await other.get('/api/auth/me').expect(401);
    });
  });
});
