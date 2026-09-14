import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Department, EmployeeStatus, Prisma, Role, User } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PASSWORD_RULE, verifyPassword } from '../auth/password';
import { departmentOptionsQuery } from '../departments/department.serializer';
import type { PrismaService } from '../prisma/prisma.service';
import type { AvatarStorage } from './avatar-storage';
import type { EmployeeWithRelations } from './employee.serializer';
import type { CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from './employees.dto';
import { EmployeesService } from './employees.service';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);

const actor = (role: Role, employeeId = 'actor-e'): AuthUser => ({ id: `actor-${role}`, role, employeeId, mustChangePassword: false });

function account(role: Role): User {
  return {
    id: 'u1',
    employeeId: 'e1',
    passwordHash: 'hash',
    role,
    mustChangePassword: false,
    sessionVersion: 0,
    createdAt: new Date('2024-01-15T08:00:00.000Z'),
    updatedAt: new Date('2024-01-15T08:00:00.000Z'),
  };
}

function department(overrides: Partial<Department> = {}): Department {
  return {
    id: 'd1',
    code: 'KT',
    name: 'Kỹ thuật',
    parentId: null,
    managerId: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function row(overrides: Partial<EmployeeWithRelations> = {}): EmployeeWithRelations {
  return {
    id: 'e1',
    code: 'NV0001',
    fullName: 'Nguyễn Văn An',
    email: 'an@congty.vn',
    phone: null,
    dateOfBirth: null,
    gender: null,
    departmentId: 'd1',
    department: department(),
    position: 'Lập trình viên',
    hireDate: new Date('2024-01-15T00:00:00.000Z'),
    status: EmployeeStatus.ACTIVE,
    salary: null,
    nationalId: null,
    avatarPath: null,
    createdAt: new Date('2024-01-15T08:00:00.000Z'),
    updatedAt: new Date('2024-01-15T08:00:00.000Z'),
    deletedAt: null,
    user: null,
    ...overrides,
  };
}

const createDto = (overrides: Partial<CreateEmployeeDto> = {}) =>
  ({
    code: 'NV0001',
    fullName: 'Nguyễn Văn An',
    email: 'an@congty.vn',
    phone: null,
    departmentId: 'd1',
    position: 'Lập trình viên',
    hireDate: '2024-01-15',
    dateOfBirth: '1990-05-20',
    ...overrides,
  }) as CreateEmployeeDto;

const p2002 = (target: unknown) =>
  new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test', meta: { target } });

function setup() {
  const prisma = {
    $transaction: jest.fn(),
    employee: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    user: { create: jest.fn(), update: jest.fn() },
    department: { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue({ deletedAt: null }), updateMany: jest.fn() },
  };
  // Batch transactions resolve their operations; interactive ones run the callback against the same client.
  prisma.$transaction.mockImplementation((arg: unknown) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg as unknown[])));
  const avatars = {
    save: jest.fn(),
    remove: jest.fn(),
    resolve: jest.fn((name: string) => `/uploads/avatars/${name}`),
    mimeOf: jest.fn(() => 'image/png'),
  };
  const service = new EmployeesService(prisma as unknown as PrismaService, avatars as unknown as AvatarStorage);
  return { prisma, avatars, service };
}

describe('EmployeesService', () => {
  describe('list and lookups', () => {
    it('pages the list and hides private fields', async () => {
      const { prisma, service } = setup();
      prisma.employee.count.mockResolvedValue(25);
      prisma.employee.findMany.mockResolvedValue([row({ salary: new Prisma.Decimal(1) })]);
      const query = { page: 2, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' } as ListEmployeesQueryDto;

      const result = await service.list(query);

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10, include: { user: true, department: true } }),
      );
      expect(result).toMatchObject({ total: 25, page: 2, pageSize: 10, items: [{ id: 'e1', code: 'NV0001', department: { id: 'd1', name: 'Kỹ thuật' } }] });
      expect(result.items[0]).not.toHaveProperty('salary');
    });

    it('returns active departments and distinct positions', async () => {
      const { prisma, service } = setup();
      prisma.department.findMany.mockResolvedValue([{ id: 'd1', code: 'KT', name: 'Kỹ thuật' }]);
      prisma.employee.findMany.mockResolvedValue([{ position: 'Lập trình viên' }]);

      await expect(service.filterOptions()).resolves.toEqual({
        departments: [{ id: 'd1', code: 'KT', name: 'Kỹ thuật' }],
        positions: ['Lập trình viên'],
      });
      expect(prisma.department.findMany).toHaveBeenCalledWith(departmentOptionsQuery);
    });

    it('reports a missing employee', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(new NotFoundException('Không tìm thấy nhân viên'));
    });
  });

  describe('create', () => {
    it('creates an employee without an account and converts dates', async () => {
      const { prisma, service } = setup();
      prisma.employee.create.mockResolvedValue(row());

      const result = await service.create(createDto({ createAccount: false }), actor(Role.HR));

      const { data } = prisma.employee.create.mock.calls[0][0];
      expect(data).toMatchObject({ code: 'NV0001', departmentId: 'd1', phone: null, hireDate: new Date('2024-01-15T00:00:00.000Z'), dateOfBirth: new Date('1990-05-20T00:00:00.000Z') });
      expect(data).not.toHaveProperty('createAccount');
      expect(data.user).toBeUndefined();
      expect(result.tempPassword).toBeNull();
    });

    it('creates a login account with a temporary password that must be changed', async () => {
      const { prisma, service } = setup();
      prisma.employee.create.mockResolvedValue(row({ user: account(Role.EMPLOYEE) }));

      const result = await service.create(createDto({ createAccount: true }), actor(Role.HR));

      const { data } = prisma.employee.create.mock.calls[0][0];
      expect(result.tempPassword).toMatch(PASSWORD_RULE);
      expect(data.user.create).toMatchObject({ role: Role.EMPLOYEE, mustChangePassword: true });
      expect(await verifyPassword(result.tempPassword!, data.user.create.passwordHash)).toBe(true);
    });

    it('does not let HR grant an HR account', async () => {
      const { prisma, service } = setup();

      await expect(service.create(createDto({ createAccount: true, accountRole: Role.HR }), actor(Role.HR))).rejects.toThrow(
        new ForbiddenException('Chỉ Admin được cấp tài khoản HR hoặc Admin'),
      );
      expect(prisma.employee.create).not.toHaveBeenCalled();
    });

    it('rejects a birth date that is not in the past', async () => {
      const { service } = setup();

      await expect(service.create(createDto({ dateOfBirth: '2999-01-01' }), actor(Role.HR))).rejects.toThrow(
        new BadRequestException('Ngày sinh phải trước ngày hôm nay'),
      );
    });

    it('rejects a missing or deleted department', async () => {
      const { prisma, service } = setup();
      for (const found of [null, { deletedAt: new Date() }]) {
        prisma.department.findUnique.mockResolvedValueOnce(found);
        await expect(service.create(createDto(), actor(Role.HR))).rejects.toThrow(
          new BadRequestException('Phòng ban không tồn tại hoặc đã bị xóa'),
        );
      }
      expect(prisma.department.findUnique).toHaveBeenCalledWith({ where: { id: 'd1' }, select: { deletedAt: true } });
      expect(prisma.employee.create).not.toHaveBeenCalled();
    });

    it('maps unique violations to a 409', async () => {
      const { prisma, service } = setup();
      prisma.employee.create.mockRejectedValue(p2002(['code']));

      await expect(service.create(createDto(), actor(Role.HR))).rejects.toThrow(new ConflictException('Mã nhân viên đã tồn tại'));
    });
  });

  describe('update', () => {
    it('writes only the provided fields and keeps null to clear values', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row());
      prisma.employee.update.mockResolvedValue(row({ fullName: 'Nguyễn Văn Bình' }));
      const dto = { fullName: 'Nguyễn Văn Bình', dateOfBirth: null, phone: undefined } as UpdateEmployeeDto;

      const result = await service.update('e1', dto, actor(Role.HR));

      expect(prisma.employee.update.mock.calls[0][0].data).toEqual({ fullName: 'Nguyễn Văn Bình', dateOfBirth: null });
      expect(prisma.department.findUnique).not.toHaveBeenCalled();
      expect(prisma.department.updateMany).not.toHaveBeenCalled();
      expect(result.fullName).toBe('Nguyễn Văn Bình');
    });

    it('moves the employee to another active department and removes their head role in the old one', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row());
      prisma.employee.update.mockResolvedValue(row({ departmentId: 'd2', department: department({ id: 'd2', code: 'NS', name: 'Nhân sự' }) }));

      const result = await service.update('e1', { departmentId: 'd2' } as UpdateEmployeeDto, actor(Role.HR));

      expect(prisma.department.findUnique).toHaveBeenCalledWith({ where: { id: 'd2' }, select: { deletedAt: true } });
      expect(prisma.employee.update.mock.calls[0][0].data).toEqual({ departmentId: 'd2' });
      expect(prisma.department.updateMany).toHaveBeenCalledWith({ where: { managerId: 'e1' }, data: { managerId: null } });
      expect(result.department).toEqual({ id: 'd2', code: 'NS', name: 'Nhân sự' });
    });

    it('keeps the head role when the department is unchanged and refuses a deleted target department', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row());
      prisma.employee.update.mockResolvedValue(row());

      await service.update('e1', { departmentId: 'd1' } as UpdateEmployeeDto, actor(Role.HR));
      expect(prisma.department.findUnique).not.toHaveBeenCalled();
      expect(prisma.department.updateMany).not.toHaveBeenCalled();

      prisma.department.findUnique.mockResolvedValueOnce({ deletedAt: new Date() });
      await expect(service.update('e1', { departmentId: 'd2' } as UpdateEmployeeDto, actor(Role.HR))).rejects.toThrow(
        new BadRequestException('Phòng ban không tồn tại hoặc đã bị xóa'),
      );
      expect(prisma.employee.update).toHaveBeenCalledTimes(1);
    });

    it('maps unique violations raised inside the transaction to a 409', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row());
      prisma.employee.update.mockRejectedValue(p2002(['email']));

      await expect(service.update('e1', { email: 'x@y.vn' } as UpdateEmployeeDto, actor(Role.HR))).rejects.toThrow(
        new ConflictException('Email đã được dùng cho nhân viên khác (kể cả nhân viên đã nghỉ)'),
      );
    });

    it('refuses to edit a resigned employee', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ deletedAt: new Date() }));

      await expect(service.update('e1', {} as UpdateEmployeeDto, actor(Role.ADMIN))).rejects.toThrow(
        new ConflictException('Nhân viên đã nghỉ việc, hãy khôi phục trước'),
      );
    });

    it('does not let HR edit an HR account holder', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ user: account(Role.HR) }));

      await expect(service.update('e1', {} as UpdateEmployeeDto, actor(Role.HR))).rejects.toThrow(ForbiddenException);
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('remove and restore', () => {
    it('soft-deletes by marking the employee resigned and removes their head role', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row());

      await service.remove('e1', actor(Role.HR));

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { status: EmployeeStatus.RESIGNED, deletedAt: expect.any(Date) },
      });
      expect(prisma.department.updateMany).toHaveBeenCalledWith({ where: { managerId: 'e1' }, data: { managerId: null } });
    });

    it('refuses to delete yourself or an already resigned employee', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row());
      await expect(service.remove('e1', actor(Role.ADMIN, 'e1'))).rejects.toThrow(
        new BadRequestException('Bạn không thể tự xóa hồ sơ của mình'),
      );

      prisma.employee.findUnique.mockResolvedValue(row({ deletedAt: new Date() }));
      await expect(service.remove('e1', actor(Role.ADMIN))).rejects.toThrow(new ConflictException('Nhân viên đã ở trạng thái nghỉ việc'));
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it('restores a resigned employee as active', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ deletedAt: new Date(), status: EmployeeStatus.RESIGNED }));
      prisma.employee.update.mockResolvedValue(row());

      await service.restore('e1', actor(Role.HR));

      expect(prisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: EmployeeStatus.ACTIVE, deletedAt: null } }),
      );
    });

    it('refuses to restore an active employee', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row());

      await expect(service.restore('e1', actor(Role.HR))).rejects.toThrow(new ConflictException('Nhân viên chưa bị xóa'));
    });

    it('refuses to restore an employee whose department was deleted', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ deletedAt: new Date(), department: department({ deletedAt: new Date() }) }));

      await expect(service.restore('e1', actor(Role.HR))).rejects.toThrow(
        new ConflictException('Phòng ban "Kỹ thuật" đã bị xóa, hãy khôi phục phòng ban trước'),
      );
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('accounts', () => {
    it('creates an account with a temporary password', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ user: account(Role.EMPLOYEE) }));

      const result = await service.createAccount('e1', Role.EMPLOYEE, actor(Role.HR));

      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data).toMatchObject({ employeeId: 'e1', role: Role.EMPLOYEE, mustChangePassword: true });
      expect(await verifyPassword(result.tempPassword, data.passwordHash)).toBe(true);
      expect(result.employee.account).toEqual({ role: Role.EMPLOYEE, mustChangePassword: false });
    });

    it('refuses a second account or a role HR cannot grant', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ user: account(Role.EMPLOYEE) }));
      await expect(service.createAccount('e1', Role.EMPLOYEE, actor(Role.ADMIN))).rejects.toThrow(
        new ConflictException('Nhân viên đã có tài khoản'),
      );

      prisma.employee.findUnique.mockResolvedValue(row());
      await expect(service.createAccount('e1', Role.ADMIN, actor(Role.HR))).rejects.toThrow(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('resets a password and revokes existing sessions', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ user: account(Role.EMPLOYEE) }));

      const { tempPassword } = await service.resetPassword('e1', actor(Role.HR));

      const { where, data } = prisma.user.update.mock.calls[0][0];
      expect(where).toEqual({ id: 'u1' });
      expect(data).toMatchObject({ mustChangePassword: true, sessionVersion: { increment: 1 } });
      expect(await verifyPassword(tempPassword, data.passwordHash)).toBe(true);
    });

    it('refuses to reset without an account or for yourself', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row());
      await expect(service.resetPassword('e1', actor(Role.ADMIN))).rejects.toThrow(new NotFoundException('Nhân viên chưa có tài khoản'));

      prisma.employee.findUnique.mockResolvedValue(row({ user: account(Role.ADMIN) }));
      await expect(service.resetPassword('e1', actor(Role.ADMIN, 'e1'))).rejects.toThrow(BadRequestException);
    });

    it('changes the account role', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ user: account(Role.EMPLOYEE) }));

      await service.changeRole('e1', Role.HR, actor(Role.ADMIN));

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { role: Role.HR } });
    });

    it('refuses to change your own role', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ user: account(Role.ADMIN) }));

      await expect(service.changeRole('e1', Role.EMPLOYEE, actor(Role.ADMIN, 'e1'))).rejects.toThrow(
        new BadRequestException('Bạn không thể tự đổi vai trò của mình'),
      );
    });
  });

  describe('avatars', () => {
    it('stores a new image and removes the previous one', async () => {
      const { prisma, avatars, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ avatarPath: 'old.png' }));
      avatars.save.mockResolvedValue('new.png');
      prisma.employee.update.mockResolvedValue(row({ avatarPath: 'new.png' }));

      const result = await service.setAvatar('e1', { buffer: PNG } as Express.Multer.File, actor(Role.HR));

      expect(avatars.save).toHaveBeenCalledWith(PNG, 'png');
      expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({ data: { avatarPath: 'new.png' } }));
      expect(avatars.remove).toHaveBeenCalledWith('old.png');
      expect(avatars.remove.mock.invocationCallOrder[0]).toBeGreaterThan(prisma.employee.update.mock.invocationCallOrder[0]);
      expect(result.hasAvatar).toBe(true);
    });

    it.each([
      ['no file', undefined, 'Vui lòng chọn ảnh'],
      ['a non-image file', { buffer: Buffer.from('<svg onload=alert(1)>') }, 'Ảnh phải là JPG, PNG hoặc WEBP'],
    ])('rejects %s', async (_label, file, message) => {
      const { prisma, avatars, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row());

      await expect(service.setAvatar('e1', file as Express.Multer.File | undefined, actor(Role.HR))).rejects.toThrow(
        new BadRequestException(message),
      );
      expect(avatars.save).not.toHaveBeenCalled();
    });

    it('serves the avatar path and MIME type', async () => {
      const { prisma, service } = setup();
      prisma.employee.findUnique.mockResolvedValue(row({ avatarPath: 'a.png' }));

      await expect(service.getAvatar('e1', actor(Role.EMPLOYEE, 'e1'))).resolves.toEqual({
        path: '/uploads/avatars/a.png',
        mime: 'image/png',
      });
    });

    it("hides other employees' avatars from plain employees and reports a missing avatar", async () => {
      const { prisma, service } = setup();
      await expect(service.getAvatar('e1', actor(Role.EMPLOYEE, 'e2'))).rejects.toThrow(ForbiddenException);
      expect(prisma.employee.findUnique).not.toHaveBeenCalled();

      prisma.employee.findUnique.mockResolvedValue(row());
      await expect(service.getAvatar('e1', actor(Role.HR))).rejects.toThrow(new NotFoundException('Nhân viên chưa có ảnh đại diện'));
    });
  });
});
