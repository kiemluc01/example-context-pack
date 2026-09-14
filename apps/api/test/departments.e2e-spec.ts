import { INestApplication } from '@nestjs/common';
import { Department, Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { Agent, createDepartment, createEmployeeWithAccount, createTestApp, employeeData, login, resetDatabase } from './helpers';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const codes = (res: request.Response) => res.body.items.map((d: { code: string }) => d.code);

describe('Departments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let kt: Department;
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
    kt = await createDepartment(prisma, { code: 'KT', name: 'Kỹ thuật' });
    const admin = await createEmployeeWithAccount(prisma, Role.ADMIN);
    hr = await createEmployeeWithAccount(prisma, Role.HR);
    staff = await createEmployeeWithAccount(prisma, Role.EMPLOYEE, { employee: { departmentId: kt.id } });
    [asAdmin, asHr, asStaff] = await Promise.all([login(app, admin.email), login(app, hr.email), login(app, staff.email)]);
  });

  describe('access by role', () => {
    it('EMPLOYEE cannot view or change departments', async () => {
      await asStaff.get('/api/departments').expect(403);
      await asStaff.get('/api/departments/options').expect(403);
      await asStaff.get(`/api/departments/${kt.id}`).expect(403);
      await asStaff.post('/api/departments').send({ code: 'X', name: 'X' }).expect(403);
      await asStaff.patch(`/api/departments/${kt.id}`).send({ name: 'X' }).expect(403);
      await asStaff.delete(`/api/departments/${kt.id}`).expect(403);
      await asStaff.post(`/api/departments/${kt.id}/restore`).expect(403);
    });

    it('HR can view departments but only ADMIN changes them', async () => {
      await asHr.get('/api/departments').expect(200);
      await asHr.get('/api/departments/options').expect(200);
      await asHr.get(`/api/departments/${kt.id}`).expect(200);

      const empty = await createDepartment(prisma);
      await asHr.post('/api/departments').send({ code: 'MKT', name: 'Marketing' }).expect(403);
      await asHr.patch(`/api/departments/${kt.id}`).send({ name: 'Đổi tên' }).expect(403);
      await asHr.delete(`/api/departments/${empty.id}`).expect(403);
      await prisma.department.update({ where: { id: empty.id }, data: { deletedAt: new Date() } });
      await asHr.post(`/api/departments/${empty.id}/restore`).expect(403);

      expect(await prisma.department.count({ where: { code: 'MKT' } })).toBe(0);
      expect((await prisma.department.findUniqueOrThrow({ where: { id: kt.id } })).name).toBe('Kỹ thuật');
      expect((await prisma.department.findUniqueOrThrow({ where: { id: empty.id } })).deletedAt).not.toBeNull();
    });
  });

  describe('create', () => {
    it('normalizes and stores a department under a parent or at the top level', async () => {
      const res = await asAdmin.post('/api/departments').send({ code: ' kd-01 ', name: '  Kinh doanh ', parentId: kt.id }).expect(201);
      expect(res.body).toMatchObject({
        code: 'KD-01',
        name: 'Kinh doanh',
        parent: { id: kt.id, code: 'KT', name: 'Kỹ thuật' },
        manager: null,
        employeeCount: 0,
        deletedAt: null,
      });

      const top = await asAdmin.post('/api/departments').send({ code: 'MKT', name: 'Marketing', parentId: null }).expect(201);
      expect(top.body.parent).toBeNull();
    });

    it('reports invalid fields and rejects unknown ones, including a manager on create', async () => {
      const res = await asAdmin.post('/api/departments').send({}).expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('Mã phòng ban'), 'Tên phòng ban bắt buộc, tối đa 100 ký tự']),
      );
      await asAdmin.post('/api/departments').send({ code: 'KD 01', name: 'Kinh doanh' }).expect(400);
      await asAdmin.post('/api/departments').send({ code: 'KD', name: 'a'.repeat(101) }).expect(400);
      await asAdmin.post('/api/departments').send({ code: 'KD', name: 'Kinh doanh', parentId: 'kt' }).expect(400);
      await asAdmin.post('/api/departments').send({ code: 'KD', name: 'Kinh doanh', managerId: staff.id }).expect(400);
      expect(await prisma.department.count({ where: { code: 'KD' } })).toBe(0);
    });

    it('returns 409 for a duplicate code or name, including deleted departments', async () => {
      const dupCode = await asAdmin.post('/api/departments').send({ code: 'kt', name: 'Khác' }).expect(409);
      expect(dupCode.body.message).toBe('Mã phòng ban đã tồn tại');

      await createDepartment(prisma, { name: 'Phòng cũ', deletedAt: new Date() });
      const dupName = await asAdmin.post('/api/departments').send({ code: 'NEW', name: 'Phòng cũ' }).expect(409);
      expect(dupName.body.message).toBe('Tên phòng ban đã tồn tại (kể cả phòng ban đã xóa)');
    });

    it('rejects a missing or deleted parent', async () => {
      const missing = await asAdmin.post('/api/departments').send({ code: 'A', name: 'A', parentId: MISSING_ID }).expect(400);
      expect(missing.body.message).toBe('Phòng ban cha không tồn tại hoặc đã bị xóa');

      const old = await createDepartment(prisma, { deletedAt: new Date() });
      await asAdmin.post('/api/departments').send({ code: 'A', name: 'A', parentId: old.id }).expect(400);
    });
  });

  describe('update', () => {
    it('renames, re-parents and detaches a department', async () => {
      const parent = await createDepartment(prisma, { code: 'BGD', name: 'Ban Giám đốc' });

      const moved = await asAdmin.patch(`/api/departments/${kt.id}`).send({ name: 'Công nghệ', parentId: parent.id }).expect(200);
      expect(moved.body).toMatchObject({ code: 'KT', name: 'Công nghệ', parent: { id: parent.id }, employeeCount: 1 });

      const detached = await asAdmin.patch(`/api/departments/${kt.id}`).send({ parentId: null }).expect(200);
      expect(detached.body.parent).toBeNull();
      await asAdmin.patch(`/api/departments/${kt.id}`).send({ name: null }).expect(400);
    });

    it('rejects the department itself or one of its descendants as parent', async () => {
      const child = await createDepartment(prisma, { parentId: kt.id });
      const grandchild = await createDepartment(prisma, { parentId: child.id });

      for (const parentId of [kt.id, grandchild.id]) {
        const res = await asAdmin.patch(`/api/departments/${kt.id}`).send({ parentId }).expect(400);
        expect(res.body.message).toBe('Không thể chọn chính phòng ban này hoặc phòng ban con của nó làm phòng ban cha');
      }
      await asAdmin.patch(`/api/departments/${grandchild.id}`).send({ parentId: kt.id }).expect(200);
    });

    it('accepts only an active employee of the department as manager', async () => {
      const res = await asAdmin.patch(`/api/departments/${kt.id}`).send({ managerId: staff.id }).expect(200);
      expect(res.body.manager).toEqual({ id: staff.id, code: staff.code, fullName: staff.fullName });

      const outsider = await asAdmin.patch(`/api/departments/${kt.id}`).send({ managerId: hr.id }).expect(400);
      expect(outsider.body.message).toBe('Trưởng phòng phải là nhân viên đang làm việc thuộc phòng ban này');
      const resigned = await prisma.employee.create({ data: employeeData(kt.id, { deletedAt: new Date(), status: 'RESIGNED' }) });
      await asAdmin.patch(`/api/departments/${kt.id}`).send({ managerId: resigned.id }).expect(400);
      await asAdmin.patch(`/api/departments/${kt.id}`).send({ managerId: MISSING_ID }).expect(400);

      const cleared = await asAdmin.patch(`/api/departments/${kt.id}`).send({ managerId: null }).expect(200);
      expect(cleared.body.manager).toBeNull();
    });

    it('clears the manager when that employee resigns or moves to another department', async () => {
      const other = await createDepartment(prisma);
      await asAdmin.patch(`/api/departments/${kt.id}`).send({ managerId: staff.id }).expect(200);

      await asHr.delete(`/api/employees/${staff.id}`).expect(204);
      expect((await asHr.get(`/api/departments/${kt.id}`).expect(200)).body.manager).toBeNull();

      await asHr.post(`/api/employees/${staff.id}/restore`).expect(200);
      await asAdmin.patch(`/api/departments/${kt.id}`).send({ managerId: staff.id }).expect(200);
      await asHr.patch(`/api/employees/${staff.id}`).send({ departmentId: other.id }).expect(200);
      expect((await asHr.get(`/api/departments/${kt.id}`).expect(200)).body.manager).toBeNull();
    });

    it('returns 404 for unknown or malformed ids and 409 for a deleted department', async () => {
      await asAdmin.patch(`/api/departments/${MISSING_ID}`).send({ name: 'X' }).expect(404);
      await asHr.get('/api/departments/not-a-uuid').expect(404);

      const old = await createDepartment(prisma, { deletedAt: new Date() });
      const res = await asAdmin.patch(`/api/departments/${old.id}`).send({ name: 'X' }).expect(409);
      expect(res.body.message).toBe('Phòng ban đã bị xóa, hãy khôi phục trước');
    });
  });

  describe('soft delete and restore', () => {
    it('hides a deleted department from the list and options, keeps the row and restores it', async () => {
      const empty = await createDepartment(prisma, { code: 'MKT', name: 'Marketing' });

      await asAdmin.delete(`/api/departments/${empty.id}`).expect(204);

      expect((await prisma.department.findUniqueOrThrow({ where: { id: empty.id } })).deletedAt).toBeInstanceOf(Date);
      expect(codes(await asHr.get('/api/departments').expect(200))).not.toContain('MKT');
      const options = await asHr.get('/api/departments/options').expect(200);
      expect(options.body.map((d: { code: string }) => d.code)).not.toContain('MKT');
      expect(codes(await asHr.get('/api/departments').query({ status: 'DELETED' }).expect(200))).toEqual(['MKT']);

      const restored = await asAdmin.post(`/api/departments/${empty.id}/restore`).expect(200);
      expect(restored.body).toMatchObject({ code: 'MKT', deletedAt: null });
    });

    it('refuses to delete while active employees or sub-departments remain', async () => {
      const busy = await asAdmin.delete(`/api/departments/${kt.id}`).expect(409);
      expect(busy.body.message).toBe('Phòng ban còn 1 nhân viên đang làm việc, hãy chuyển họ sang phòng ban khác trước');

      const onlyResigned = await createDepartment(prisma);
      await prisma.employee.create({ data: employeeData(onlyResigned.id, { deletedAt: new Date(), status: 'RESIGNED' }) });
      const child = await createDepartment(prisma, { parentId: onlyResigned.id });
      const withChild = await asAdmin.delete(`/api/departments/${onlyResigned.id}`).expect(409);
      expect(withChild.body.message).toBe('Phòng ban còn 1 phòng ban con, hãy xóa hoặc chuyển chúng sang phòng ban khác trước');

      await asAdmin.delete(`/api/departments/${child.id}`).expect(204);
      await asAdmin.delete(`/api/departments/${onlyResigned.id}`).expect(204);
    });

    it('rejects deleting twice, restoring an active department and restoring under a deleted parent', async () => {
      const parent = await createDepartment(prisma);
      const child = await createDepartment(prisma, { parentId: parent.id });

      await asAdmin.post(`/api/departments/${child.id}/restore`).expect(409);
      await asAdmin.delete(`/api/departments/${child.id}`).expect(204);
      await asAdmin.delete(`/api/departments/${child.id}`).expect(409);
      await asAdmin.delete(`/api/departments/${parent.id}`).expect(204);

      const res = await asAdmin.post(`/api/departments/${child.id}/restore`).expect(409);
      expect(res.body.message).toBe('Phòng ban cha đã bị xóa, hãy khôi phục phòng ban cha trước');
      await asAdmin.post(`/api/departments/${parent.id}/restore`).expect(200);
      await asAdmin.post(`/api/departments/${child.id}/restore`).expect(200);
    });
  });

  describe('list', () => {
    let kd: Department;

    beforeEach(async () => {
      kd = await createDepartment(prisma, { code: 'KD', name: 'Kinh doanh' });
      await createDepartment(prisma, { code: 'MKT', name: 'Marketing', parentId: kd.id });
      await createDepartment(prisma, { code: 'KTOAN', name: 'Kế toán' });
      await createDepartment(prisma, { code: 'OLD', name: 'Phòng Kinh doanh cũ', deletedAt: new Date() });
      await prisma.employee.createMany({
        data: [employeeData(kd.id), employeeData(kd.id), employeeData(kd.id, { deletedAt: new Date(), status: 'RESIGNED' })],
      });
    });

    it.each([
      ['name, case-insensitive', 'KINH', ['KD']],
      ['code fragment', 'toa', ['KTOAN']],
    ])('searches by %s', async (_label, q, expected) => {
      expect(codes(await asHr.get('/api/departments').query({ q }).expect(200))).toEqual(expected);
    });

    it('filters by parent and shows parent, manager and the active employee count', async () => {
      const head = await prisma.employee.findFirstOrThrow({ where: { departmentId: kd.id, deletedAt: null } });
      await prisma.department.update({ where: { id: kd.id }, data: { managerId: head.id } });

      const children = await asHr.get('/api/departments').query({ parentId: kd.id }).expect(200);
      expect(codes(children)).toEqual(['MKT']);
      expect(children.body.items[0].parent).toEqual({ id: kd.id, code: 'KD', name: 'Kinh doanh' });

      const res = await asHr.get('/api/departments').query({ q: 'kinh' }).expect(200);
      expect(res.body.items[0]).toMatchObject({ code: 'KD', employeeCount: 2, manager: { id: head.id, code: head.code } });
    });

    it('sorts by a whitelisted column and paginates on the server', async () => {
      const asc = await asHr.get('/api/departments').query({ q: 'K', sortBy: 'code', sortOrder: 'asc' }).expect(200);
      expect(codes(asc)).toEqual(['KD', 'KT', 'KTOAN', 'MKT']);
      const desc = await asHr.get('/api/departments').query({ q: 'K', sortBy: 'code', sortOrder: 'desc' }).expect(200);
      expect(codes(desc)).toEqual(['MKT', 'KTOAN', 'KT', 'KD']);

      const page2 = await asHr.get('/api/departments').query({ q: 'K', sortBy: 'code', sortOrder: 'asc', pageSize: 3, page: 2 }).expect(200);
      expect(page2.body).toMatchObject({ total: 4, page: 2, pageSize: 3 });
      expect(codes(page2)).toEqual(['MKT']);

      expect((await asHr.get('/api/departments').expect(200)).body).toMatchObject({ page: 1, pageSize: 20 });
    });

    it('rejects invalid query values', async () => {
      await asHr.get('/api/departments').query({ sortBy: 'employeeCount' }).expect(400);
      await asHr.get('/api/departments').query({ status: 'ALL' }).expect(400);
      await asHr.get('/api/departments').query({ pageSize: 101 }).expect(400);
      await asHr.get('/api/departments').query({ parentId: 'kd' }).expect(400);
    });

    it('lists every active department as an option', async () => {
      const res = await asHr.get('/api/departments/options').expect(200);

      expect(res.body).toHaveLength(6);
      expect(res.body).toContainEqual({ id: kd.id, code: 'KD', name: 'Kinh doanh' });
      expect(res.body.map((d: { code: string }) => d.code)).not.toContain('OLD');
    });
  });
});
