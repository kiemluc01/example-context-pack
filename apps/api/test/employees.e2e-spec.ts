import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { existsSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Agent,
  JPG_BYTES,
  PASSWORD,
  PNG_BYTES,
  createEmployeeWithAccount,
  createTestApp,
  employeeData,
  login,
  resetDatabase,
} from './helpers';

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  code: 'nv-100',
  fullName: '  Nguyễn Văn An ',
  email: 'An.Nguyen@CongTy.vn',
  phone: '0912 345 678',
  dateOfBirth: '1995-06-20',
  gender: 'MALE',
  department: 'Kỹ thuật',
  position: 'Lập trình viên',
  hireDate: '2024-03-01',
  status: 'PROBATION',
  salary: 15000000,
  nationalId: '001095012345',
  ...overrides,
});

describe('Employees (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Awaited<ReturnType<typeof createEmployeeWithAccount>>;
  let hr: Awaited<ReturnType<typeof createEmployeeWithAccount>>;
  let staff: Awaited<ReturnType<typeof createEmployeeWithAccount>>;
  let asAdmin: Agent;
  let asHr: Agent;
  let asStaff: Agent;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await createEmployeeWithAccount(prisma, Role.ADMIN, { employee: { department: 'Ban Giám đốc' } });
    hr = await createEmployeeWithAccount(prisma, Role.HR, { employee: { department: 'Nhân sự', salary: 20000000 } });
    staff = await createEmployeeWithAccount(prisma, Role.EMPLOYEE, {
      employee: { salary: 12000000, nationalId: '001090000001' },
    });
    [asAdmin, asHr, asStaff] = await Promise.all([login(app, admin.email), login(app, hr.email), login(app, staff.email)]);
  });

  describe('access by role', () => {
    it('EMPLOYEE cannot list, view, create, update or delete other records', async () => {
      await asStaff.get('/api/employees').expect(403);
      await asStaff.get('/api/employees/filter-options').expect(403);
      await asStaff.get(`/api/employees/${hr.id}`).expect(403);
      await asStaff.get(`/api/employees/${staff.id}`).expect(403);
      await asStaff.post('/api/employees').send(validPayload()).expect(403);
      await asStaff.patch(`/api/employees/${staff.id}`).send({ salary: 99000000 }).expect(403);
      await asStaff.delete(`/api/employees/${hr.id}`).expect(403);
      expect((await prisma.employee.findUniqueOrThrow({ where: { id: staff.id } })).salary?.toNumber()).toBe(12000000);
    });

    it('EMPLOYEE sees their own profile including salary and national ID', async () => {
      const res = await asStaff.get('/api/employees/me').expect(200);
      expect(res.body).toMatchObject({ id: staff.id, salary: 12000000, nationalId: '001090000001', account: { role: 'EMPLOYEE' } });
    });

    it('list rows never expose salary, national ID or password hashes', async () => {
      const res = await asHr.get('/api/employees').expect(200);
      expect(res.body.total).toBe(3);
      for (const item of res.body.items) {
        expect(item).not.toHaveProperty('salary');
        expect(item).not.toHaveProperty('nationalId');
      }
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    });
  });

  describe('create', () => {
    it('normalizes and stores a valid employee', async () => {
      const res = await asHr.post('/api/employees').send(validPayload()).expect(201);

      expect(res.body.tempPassword).toBeNull();
      expect(res.body.employee).toMatchObject({
        code: 'NV-100',
        fullName: 'Nguyễn Văn An',
        email: 'an.nguyen@congty.vn',
        phone: '0912345678',
        dateOfBirth: '1995-06-20',
        hireDate: '2024-03-01',
        status: 'PROBATION',
        salary: 15000000,
        nationalId: '001095012345',
        account: null,
        deletedAt: null,
      });
    });

    it('defaults status to ACTIVE and accepts blank optional fields as empty', async () => {
      const res = await asHr
        .post('/api/employees')
        .send(validPayload({ status: undefined, phone: '', nationalId: '', dateOfBirth: '', gender: null, salary: null }))
        .expect(201);
      expect(res.body.employee).toMatchObject({ status: 'ACTIVE', phone: null, nationalId: null, dateOfBirth: null, gender: null, salary: null });
    });

    it('reports every missing required field', async () => {
      const res = await asHr.post('/api/employees').send({}).expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Mã nhân viên'),
          'Họ tên bắt buộc, tối đa 100 ký tự',
          'Email không hợp lệ',
          'Phòng ban bắt buộc, tối đa 100 ký tự',
          'Chức vụ bắt buộc, tối đa 100 ký tự',
          'Ngày không hợp lệ (định dạng YYYY-MM-DD)',
        ]),
      );
    });

    it.each([
      ['phone', { phone: '12345' }, 'Số điện thoại'],
      ['national ID', { nationalId: '12345678901' }, 'CCCD'],
      ['impossible date', { hireDate: '2024-02-30' }, 'Ngày không hợp lệ'],
      ['code with spaces', { code: 'NV 01' }, 'Mã nhân viên'],
      ['negative salary', { salary: -1 }, 'Lương'],
      ['fractional salary', { salary: 1.5 }, 'Lương'],
      ['RESIGNED status', { status: 'RESIGNED' }, 'Trạng thái'],
      ['unknown gender', { gender: 'X' }, 'Giới tính'],
      ['too long name', { fullName: 'a'.repeat(101) }, 'Họ tên'],
    ])('rejects invalid %s', async (_label, overrides, expected) => {
      const res = await asHr.post('/api/employees').send(validPayload(overrides)).expect(400);
      expect(res.body.message.join(' ')).toContain(expected);
    });

    it('rejects unknown fields and a date of birth that is not in the past', async () => {
      await asHr.post('/api/employees').send(validPayload({ isAdmin: true })).expect(400);
      const res = await asHr.post('/api/employees').send(validPayload({ dateOfBirth: '2999-01-01' })).expect(400);
      expect(res.body.message).toBe('Ngày sinh phải trước ngày hôm nay');
    });

    it.each([
      ['code', { code: 'nv-100', email: 'other@test.vn', nationalId: '' }, 'Mã nhân viên đã tồn tại'],
      ['email', { code: 'NV-200', email: 'AN.NGUYEN@congty.vn', nationalId: '' }, 'Email đã được dùng'],
      ['national ID', { code: 'NV-200', email: 'other@test.vn' }, 'Số CCCD đã tồn tại'],
    ])('returns 409 for a duplicate %s', async (_label, overrides, expected) => {
      await asHr.post('/api/employees').send(validPayload()).expect(201);
      const res = await asHr.post('/api/employees').send(validPayload(overrides)).expect(409);
      expect(res.body.message).toContain(expected);
    });

    it('treats the email of a resigned employee as taken', async () => {
      await prisma.employee.create({ data: employeeData({ email: 'cu@test.vn', deletedAt: new Date(), status: 'RESIGNED' }) });
      await asHr.post('/api/employees').send(validPayload({ email: 'cu@test.vn' })).expect(409);
    });

    it('creates an EMPLOYEE account with a one-time temporary password', async () => {
      const res = await asHr.post('/api/employees').send(validPayload({ createAccount: true })).expect(201);

      expect(res.body.tempPassword).toMatch(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{12}$/);
      expect(res.body.employee.account).toEqual({ role: 'EMPLOYEE', mustChangePassword: true });

      const newcomer = await login(app, 'an.nguyen@congty.vn', res.body.tempPassword);
      const blocked = await newcomer.get('/api/employees/me').expect(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('HR cannot grant HR or ADMIN accounts and nothing is created', async () => {
      for (const accountRole of ['HR', 'ADMIN']) {
        await asHr.post('/api/employees').send(validPayload({ createAccount: true, accountRole })).expect(403);
      }
      expect(await prisma.employee.count({ where: { email: 'an.nguyen@congty.vn' } })).toBe(0);
    });

    it('ADMIN can grant an HR account', async () => {
      const res = await asAdmin.post('/api/employees').send(validPayload({ createAccount: true, accountRole: 'HR' })).expect(201);
      expect(res.body.employee.account.role).toBe('HR');
    });
  });

  describe('update', () => {
    it('HR updates an employee, clears optional fields and keeps untouched ones', async () => {
      const res = await asHr
        .patch(`/api/employees/${staff.id}`)
        .send({ position: 'Trưởng nhóm', salary: 18000000, nationalId: null, phone: '' })
        .expect(200);
      expect(res.body).toMatchObject({ position: 'Trưởng nhóm', salary: 18000000, nationalId: null, phone: null, email: staff.email });
    });

    it('rejects null for required fields and RESIGNED as status', async () => {
      await asHr.patch(`/api/employees/${staff.id}`).send({ fullName: null }).expect(400);
      await asHr.patch(`/api/employees/${staff.id}`).send({ status: 'RESIGNED' }).expect(400);
    });

    it('returns 409 when the new email belongs to someone else', async () => {
      const res = await asHr.patch(`/api/employees/${staff.id}`).send({ email: hr.email }).expect(409);
      expect(res.body.message).toContain('Email đã được dùng');
    });

    it('HR cannot edit records holding HR or ADMIN accounts, including their own; ADMIN can', async () => {
      await asHr.patch(`/api/employees/${hr.id}`).send({ salary: 99000000 }).expect(403);
      await asHr.patch(`/api/employees/${admin.id}`).send({ position: 'X' }).expect(403);
      await asAdmin.patch(`/api/employees/${hr.id}`).send({ salary: 21000000 }).expect(200);
    });

    it('returns 404 for unknown or malformed ids and 409 for resigned employees', async () => {
      await asHr.patch('/api/employees/00000000-0000-4000-8000-000000000000').send({ position: 'X' }).expect(404);
      await asHr.get('/api/employees/not-a-uuid').expect(404);
      await prisma.employee.update({ where: { id: staff.id }, data: { deletedAt: new Date(), status: 'RESIGNED' } });
      await asHr.patch(`/api/employees/${staff.id}`).send({ position: 'X' }).expect(409);
    });
  });

  describe('soft delete and restore', () => {
    it('marks the employee resigned, hides them by default and keeps the row', async () => {
      await asHr.delete(`/api/employees/${staff.id}`).expect(204);

      const row = await prisma.employee.findUniqueOrThrow({ where: { id: staff.id }, include: { user: true } });
      expect(row.status).toBe('RESIGNED');
      expect(row.deletedAt).toBeInstanceOf(Date);
      expect(row.user).not.toBeNull();

      const active = await asHr.get('/api/employees').expect(200);
      expect(active.body.items.map((e: { id: string }) => e.id)).not.toContain(staff.id);
      const resigned = await asHr.get('/api/employees?status=RESIGNED').expect(200);
      expect(resigned.body.items.map((e: { id: string }) => e.id)).toEqual([staff.id]);
      const detail = await asHr.get(`/api/employees/${staff.id}`).expect(200);
      expect(detail.body.status).toBe('RESIGNED');
    });

    it('locks the account of the deleted employee and unlocks it on restore', async () => {
      await asHr.delete(`/api/employees/${staff.id}`).expect(204);
      await asStaff.get('/api/employees/me').expect(401);
      await request(app.getHttpServer()).post('/api/auth/login').send({ email: staff.email, password: PASSWORD }).expect(401);

      const restored = await asHr.post(`/api/employees/${staff.id}/restore`).expect(200);

      expect(restored.body).toMatchObject({ status: 'ACTIVE', deletedAt: null });
      await login(app, staff.email);
    });

    it('rejects deleting twice, restoring an active employee and deleting yourself', async () => {
      await asHr.post(`/api/employees/${staff.id}/restore`).expect(409);
      await asHr.delete(`/api/employees/${staff.id}`).expect(204);
      await asHr.delete(`/api/employees/${staff.id}`).expect(409);
      const self = await asAdmin.delete(`/api/employees/${admin.id}`).expect(400);
      expect(self.body.message).toBe('Bạn không thể tự xóa hồ sơ của mình');
    });

    it('only ADMIN can delete or restore records holding HR or ADMIN accounts', async () => {
      await asHr.delete(`/api/employees/${admin.id}`).expect(403);
      await asAdmin.delete(`/api/employees/${hr.id}`).expect(204);
      await asAdmin.post(`/api/employees/${hr.id}/restore`).expect(200);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await prisma.employee.createMany({
        data: [
          employeeData({ code: 'KD01', fullName: 'Trần Thị Bích', email: 'bich@test.vn', phone: '0987000111', department: 'Kinh doanh', position: 'Nhân viên kinh doanh', status: 'ACTIVE' }),
          employeeData({ code: 'KD02', fullName: 'Lê Văn Cường', email: 'cuong@test.vn', department: 'Kinh doanh', position: 'Trưởng phòng', status: 'ON_LEAVE' }),
          employeeData({ code: 'KT09', fullName: 'Phạm Minh Anh', email: 'anh@test.vn', department: 'Kỹ thuật', position: 'Lập trình viên', status: 'PROBATION' }),
          employeeData({ code: 'OLD1', fullName: 'Trần Văn Cũ', email: 'cu@test.vn', department: 'Kinh doanh', position: 'Trưởng phòng', status: 'RESIGNED', deletedAt: new Date() }),
        ],
      });
    });

    const codes = (res: request.Response) => res.body.items.map((e: { code: string }) => e.code);

    it.each([
      ['name, case-insensitive with Vietnamese letters', 'TRẦN THỊ', ['KD01']],
      ['email fragment', 'CUONG@', ['KD02']],
      ['code fragment', 'kt0', ['KT09']],
      ['phone fragment', '000111', ['KD01']],
    ])('searches by %s', async (_label, q, expected) => {
      const res = await asHr.get('/api/employees').query({ q }).expect(200);
      expect(codes(res)).toEqual(expected);
    });

    it('returns all active employees for a blank keyword', async () => {
      const res = await asHr.get('/api/employees').query({ q: '   ' }).expect(200);
      expect(res.body.total).toBe(6);
    });

    it('combines department, position and status filters', async () => {
      const byDept = await asHr.get('/api/employees').query({ department: 'Kinh doanh' }).expect(200);
      expect(codes(byDept).sort()).toEqual(['KD01', 'KD02']);
      const combined = await asHr.get('/api/employees').query({ department: 'Kinh doanh', position: 'Trưởng phòng', status: 'ON_LEAVE' }).expect(200);
      expect(codes(combined)).toEqual(['KD02']);
    });

    it('sorts by a whitelisted column in both directions', async () => {
      const asc = await asHr.get('/api/employees').query({ sortBy: 'code', sortOrder: 'asc', department: 'Kinh doanh' }).expect(200);
      expect(codes(asc)).toEqual(['KD01', 'KD02']);
      const desc = await asHr.get('/api/employees').query({ sortBy: 'code', sortOrder: 'desc', department: 'Kinh doanh' }).expect(200);
      expect(codes(desc)).toEqual(['KD02', 'KD01']);
      await asHr.get('/api/employees').query({ sortBy: 'salary' }).expect(400);
    });

    it('paginates on the server with a default page size of 20', async () => {
      const defaults = await asHr.get('/api/employees').expect(200);
      expect(defaults.body).toMatchObject({ page: 1, pageSize: 20, total: 6 });

      const page1 = await asHr.get('/api/employees').query({ sortBy: 'code', sortOrder: 'asc', pageSize: 4, page: 1 }).expect(200);
      const page2 = await asHr.get('/api/employees').query({ sortBy: 'code', sortOrder: 'asc', pageSize: 4, page: 2 }).expect(200);
      expect(page1.body.items).toHaveLength(4);
      expect(page2.body.items).toHaveLength(2);
      expect(new Set([...codes(page1), ...codes(page2)]).size).toBe(6);

      await asHr.get('/api/employees').query({ pageSize: 101 }).expect(400);
      await asHr.get('/api/employees').query({ page: 0 }).expect(400);
    });

    it('lists distinct departments and positions of active employees', async () => {
      const res = await asHr.get('/api/employees/filter-options').expect(200);
      expect(res.body.departments).toEqual(['Ban Giám đốc', 'Kinh doanh', 'Kỹ thuật', 'Nhân sự']);
      expect(res.body.positions).toEqual(['Lập trình viên', 'Nhân viên kinh doanh', 'Trưởng phòng']);
    });
  });

  describe('accounts', () => {
    it('creates an account for an existing employee once', async () => {
      const plain = await prisma.employee.create({ data: employeeData() });

      const res = await asHr.post(`/api/employees/${plain.id}/account`).send({ role: 'EMPLOYEE' }).expect(201);

      expect(res.body.employee.account).toEqual({ role: 'EMPLOYEE', mustChangePassword: true });
      await login(app, plain.email, res.body.tempPassword);
      await asHr.post(`/api/employees/${plain.id}/account`).send({ role: 'EMPLOYEE' }).expect(409);
      await asHr.post(`/api/employees/${plain.id}/account`).send({ role: 'BOSS' }).expect(400);
    });

    it('HR cannot create HR accounts for existing employees', async () => {
      const plain = await prisma.employee.create({ data: employeeData() });
      await asHr.post(`/api/employees/${plain.id}/account`).send({ role: 'HR' }).expect(403);
      expect(await prisma.user.count({ where: { employeeId: plain.id } })).toBe(0);
    });

    it('resets a password: old password and sessions stop working, a change is required', async () => {
      const res = await asHr.post(`/api/employees/${staff.id}/account/reset-password`).expect(200);

      await asStaff.get('/api/auth/me').expect(401);
      await request(app.getHttpServer()).post('/api/auth/login').send({ email: staff.email, password: PASSWORD }).expect(401);
      const fresh = await login(app, staff.email, res.body.tempPassword);
      expect((await fresh.get('/api/auth/me').expect(200)).body.mustChangePassword).toBe(true);
    });

    it('guards password resets', async () => {
      await asHr.post(`/api/employees/${admin.id}/account/reset-password`).expect(403);
      await asHr.post(`/api/employees/${hr.id}/account/reset-password`).expect(400);
      const plain = await prisma.employee.create({ data: employeeData() });
      await asHr.post(`/api/employees/${plain.id}/account/reset-password`).expect(404);
      await asAdmin.post(`/api/employees/${hr.id}/account/reset-password`).expect(200);
    });

    it('only ADMIN changes roles, never their own', async () => {
      await asHr.patch(`/api/employees/${staff.id}/account`).send({ role: 'HR' }).expect(403);
      const self = await asAdmin.patch(`/api/employees/${admin.id}/account`).send({ role: 'EMPLOYEE' }).expect(400);
      expect(self.body.message).toBe('Bạn không thể tự đổi vai trò của mình');

      const res = await asAdmin.patch(`/api/employees/${staff.id}/account`).send({ role: 'HR' }).expect(200);

      expect(res.body.account.role).toBe('HR');
      await asStaff.get('/api/employees').expect(200);
    });
  });

  describe('avatar', () => {
    const uploadDir = () => path.join(process.env.UPLOAD_DIR!, 'avatars');

    it('stores an image, serves it with its detected type and replaces the old file', async () => {
      const first = await asHr.put(`/api/employees/${staff.id}/avatar`).attach('file', PNG_BYTES, 'a.png').expect(200);
      expect(first.body.hasAvatar).toBe(true);
      const firstFile = (await prisma.employee.findUniqueOrThrow({ where: { id: staff.id } })).avatarPath!;

      const img = await asHr.get(`/api/employees/${staff.id}/avatar`).buffer(true).expect(200);
      expect(img.headers['content-type']).toBe('image/png');
      expect(Buffer.compare(img.body as Buffer, PNG_BYTES)).toBe(0);

      await asHr.put(`/api/employees/${staff.id}/avatar`).attach('file', JPG_BYTES, { filename: 'b.png', contentType: 'image/png' }).expect(200);
      const second = (await prisma.employee.findUniqueOrThrow({ where: { id: staff.id } })).avatarPath!;
      expect(second).toMatch(/\.jpg$/);
      expect(existsSync(path.join(uploadDir(), firstFile))).toBe(false);
      expect(existsSync(path.join(uploadDir(), second))).toBe(true);
    });

    it('rejects files that are not images, empty requests and files over 2 MB', async () => {
      const fake = await asHr
        .put(`/api/employees/${staff.id}/avatar`)
        .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' })
        .expect(400);
      expect(fake.body.message).toBe('Ảnh phải là JPG, PNG hoặc WEBP');
      await asHr.put(`/api/employees/${staff.id}/avatar`).expect(400);
      const big = Buffer.concat([PNG_BYTES, Buffer.alloc(2 * 1024 * 1024)]);
      await asHr.put(`/api/employees/${staff.id}/avatar`).attach('file', big, 'big.png').expect(413);
    });

    it('lets an employee fetch only their own avatar', async () => {
      await asHr.put(`/api/employees/${staff.id}/avatar`).attach('file', PNG_BYTES, 'a.png').expect(200);
      await asAdmin.put(`/api/employees/${hr.id}/avatar`).attach('file', PNG_BYTES, 'a.png').expect(200);

      await asStaff.get(`/api/employees/${staff.id}/avatar`).expect(200);
      await asStaff.get(`/api/employees/${hr.id}/avatar`).expect(403);
      await asStaff.put(`/api/employees/${staff.id}/avatar`).attach('file', PNG_BYTES, 'a.png').expect(403);
      await asHr.get(`/api/employees/${admin.id}/avatar`).expect(404);
    });
  });
});
