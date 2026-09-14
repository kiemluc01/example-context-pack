import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DepartmentWithRelations, departmentInclude, departmentOptionsQuery } from './department.serializer';
import type { CreateDepartmentDto, ListDepartmentsQueryDto, UpdateDepartmentDto } from './departments.dto';
import { DepartmentsService, mapDepartmentUniqueViolation } from './departments.service';

const CYCLE = 'Không thể chọn chính phòng ban này hoặc phòng ban con của nó làm phòng ban cha';

const p2002 = (target: unknown) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test', meta: { target } });

function row(overrides: Partial<DepartmentWithRelations> = {}): DepartmentWithRelations {
  return {
    id: 'd1',
    code: 'KT',
    name: 'Kỹ thuật',
    parentId: null,
    managerId: null,
    createdAt: new Date('2024-01-15T08:00:00.000Z'),
    updatedAt: new Date('2024-01-15T08:00:00.000Z'),
    deletedAt: null,
    parent: null,
    manager: null,
    _count: { employees: 0 },
    ...overrides,
  };
}

function setup() {
  const prisma = {
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    department: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    employee: { findUnique: jest.fn() },
  };
  return { prisma, service: new DepartmentsService(prisma as unknown as PrismaService) };
}

describe('mapDepartmentUniqueViolation', () => {
  it.each([
    [['code'], 'Mã phòng ban đã tồn tại'],
    [['name'], 'Tên phòng ban đã tồn tại (kể cả phòng ban đã xóa)'],
    [['manager_id'], 'Dữ liệu bị trùng'],
  ])('maps target %p to a 409 message', (target, message) => {
    const mapped = mapDepartmentUniqueViolation(p2002(target));
    expect(mapped).toBeInstanceOf(ConflictException);
    expect((mapped as ConflictException).message).toBe(message);
  });

  it('passes other errors through unchanged', () => {
    const other = new Error('boom');
    expect(mapDepartmentUniqueViolation(other)).toBe(other);
    const notFound = new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: 'test' });
    expect(mapDepartmentUniqueViolation(notFound)).toBe(notFound);
  });
});

describe('DepartmentsService', () => {
  describe('list and lookups', () => {
    it('pages the list with relations and active employee counts', async () => {
      const { prisma, service } = setup();
      prisma.department.count.mockResolvedValue(21);
      prisma.department.findMany.mockResolvedValue([row({ _count: { employees: 4 } })]);
      const query = { q: 'kt', status: 'ACTIVE', sortBy: 'code', sortOrder: 'asc', page: 2, pageSize: 20 } as ListDepartmentsQueryDto;

      const result = await service.list(query);

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: departmentInclude, skip: 20, take: 20, orderBy: [{ code: 'asc' }, { id: 'asc' }] }),
      );
      expect(result).toMatchObject({ total: 21, page: 2, pageSize: 20, items: [{ id: 'd1', code: 'KT', employeeCount: 4 }] });
    });

    it('lists active departments as options', async () => {
      const { prisma, service } = setup();
      prisma.department.findMany.mockResolvedValue([{ id: 'd1', code: 'KT', name: 'Kỹ thuật' }]);

      await expect(service.options()).resolves.toEqual([{ id: 'd1', code: 'KT', name: 'Kỹ thuật' }]);
      expect(prisma.department.findMany).toHaveBeenCalledWith(departmentOptionsQuery);
    });

    it('reports a missing department', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(new NotFoundException('Không tìm thấy phòng ban'));
    });
  });

  describe('create', () => {
    it('creates a top-level department', async () => {
      const { prisma, service } = setup();
      prisma.department.create.mockResolvedValue(row());

      const result = await service.create({ code: 'KT', name: 'Kỹ thuật' } as CreateDepartmentDto);

      expect(prisma.department.create).toHaveBeenCalledWith({ data: { code: 'KT', name: 'Kỹ thuật', parentId: null }, include: departmentInclude });
      expect(prisma.department.findUnique).not.toHaveBeenCalled();
      expect(result).toMatchObject({ code: 'KT', parent: null, employeeCount: 0 });
    });

    it('creates a department under an active parent', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue({ id: 'p1', parentId: null, deletedAt: null });
      prisma.department.create.mockResolvedValue(row({ parentId: 'p1' }));

      await service.create({ code: 'KT', name: 'Kỹ thuật', parentId: 'p1' } as CreateDepartmentDto);

      expect(prisma.department.create.mock.calls[0][0].data).toEqual({ code: 'KT', name: 'Kỹ thuật', parentId: 'p1' });
    });

    it.each([
      ['missing', null],
      ['deleted', { id: 'p1', parentId: null, deletedAt: new Date() }],
    ])('rejects a %s parent', async (_label, parent) => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(parent);

      await expect(service.create({ code: 'KT', name: 'Kỹ thuật', parentId: 'p1' } as CreateDepartmentDto)).rejects.toThrow(
        new BadRequestException('Phòng ban cha không tồn tại hoặc đã bị xóa'),
      );
      expect(prisma.department.create).not.toHaveBeenCalled();
    });

    it('maps unique violations to a 409', async () => {
      const { prisma, service } = setup();
      prisma.department.create.mockRejectedValue(p2002(['name']));

      await expect(service.create({ code: 'KT', name: 'Kỹ thuật' } as CreateDepartmentDto)).rejects.toThrow(
        new ConflictException('Tên phòng ban đã tồn tại (kể cả phòng ban đã xóa)'),
      );
    });
  });

  describe('update', () => {
    it('writes the provided fields and clears the parent with null', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row());
      prisma.department.update.mockResolvedValue(row({ name: 'Công nghệ' }));

      const result = await service.update('d1', { name: 'Công nghệ', parentId: null } as UpdateDepartmentDto);

      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { code: undefined, name: 'Công nghệ', parentId: null, managerId: undefined },
        include: departmentInclude,
      });
      expect(prisma.department.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.employee.findUnique).not.toHaveBeenCalled();
      expect(result.name).toBe('Công nghệ');
    });

    it('refuses to edit a deleted department', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row({ deletedAt: new Date() }));

      await expect(service.update('d1', { name: 'X' } as UpdateDepartmentDto)).rejects.toThrow(
        new ConflictException('Phòng ban đã bị xóa, hãy khôi phục trước'),
      );
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it('rejects the department itself as parent', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce({ id: 'd1', parentId: null, deletedAt: null });

      await expect(service.update('d1', { parentId: 'd1' } as UpdateDepartmentDto)).rejects.toThrow(new BadRequestException(CYCLE));
    });

    it('rejects a descendant as parent', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique
        .mockResolvedValueOnce(row())
        .mockResolvedValueOnce({ id: 'c2', parentId: 'c1', deletedAt: null })
        .mockResolvedValueOnce({ id: 'c1', parentId: 'd1' })
        .mockResolvedValueOnce({ id: 'd1', parentId: null });

      await expect(service.update('d1', { parentId: 'c2' } as UpdateDepartmentDto)).rejects.toThrow(new BadRequestException(CYCLE));
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it('accepts a parent from another branch and stops walking on a corrupt cycle above it', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique
        .mockResolvedValueOnce(row())
        .mockResolvedValueOnce({ id: 'a', parentId: 'b', deletedAt: null })
        .mockResolvedValueOnce({ id: 'b', parentId: 'a' })
        .mockResolvedValueOnce({ id: 'a', parentId: 'b' });
      prisma.department.update.mockResolvedValue(row({ parentId: 'a' }));

      await service.update('d1', { parentId: 'a' } as UpdateDepartmentDto);

      expect(prisma.department.findUnique).toHaveBeenCalledTimes(4);
      expect(prisma.department.update).toHaveBeenCalled();
    });

    it('accepts an active employee of the department as manager', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row());
      prisma.employee.findUnique.mockResolvedValue({ departmentId: 'd1', deletedAt: null });
      prisma.department.update.mockResolvedValue(row({ managerId: 'e1', manager: { id: 'e1', code: 'NV0001', fullName: 'Nguyễn Văn An' } }));

      const result = await service.update('d1', { managerId: 'e1' } as UpdateDepartmentDto);

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({ where: { id: 'e1' }, select: { departmentId: true, deletedAt: true } });
      expect(prisma.department.update.mock.calls[0][0].data.managerId).toBe('e1');
      expect(result.manager).toEqual({ id: 'e1', code: 'NV0001', fullName: 'Nguyễn Văn An' });
    });

    it.each([
      ['a missing employee', null],
      ['a resigned employee', { departmentId: 'd1', deletedAt: new Date() }],
      ['an employee of another department', { departmentId: 'd2', deletedAt: null }],
    ])('rejects %s as manager', async (_label, employee) => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row());
      prisma.employee.findUnique.mockResolvedValue(employee);

      await expect(service.update('d1', { managerId: 'e1' } as UpdateDepartmentDto)).rejects.toThrow(
        new BadRequestException('Trưởng phòng phải là nhân viên đang làm việc thuộc phòng ban này'),
      );
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it('maps unique violations to a 409', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row());
      prisma.department.update.mockRejectedValue(p2002(['code']));

      await expect(service.update('d1', { code: 'KD' } as UpdateDepartmentDto)).rejects.toThrow(
        new ConflictException('Mã phòng ban đã tồn tại'),
      );
    });
  });

  describe('remove and restore', () => {
    it('soft-deletes an empty department and clears its manager', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row());
      prisma.department.count.mockResolvedValue(0);

      await service.remove('d1');

      expect(prisma.department.count).toHaveBeenCalledWith({ where: { parentId: 'd1', deletedAt: null } });
      expect(prisma.department.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { deletedAt: expect.any(Date), managerId: null } });
    });

    it('refuses while active employees remain', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row({ _count: { employees: 3 } }));

      await expect(service.remove('d1')).rejects.toThrow(
        new ConflictException('Phòng ban còn 3 nhân viên đang làm việc, hãy chuyển họ sang phòng ban khác trước'),
      );
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it('refuses while active sub-departments remain', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row());
      prisma.department.count.mockResolvedValue(2);

      await expect(service.remove('d1')).rejects.toThrow(
        new ConflictException('Phòng ban còn 2 phòng ban con, hãy xóa hoặc chuyển chúng sang phòng ban khác trước'),
      );
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it('refuses to delete twice', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row({ deletedAt: new Date() }));

      await expect(service.remove('d1')).rejects.toThrow(new ConflictException('Phòng ban đã bị xóa'));
    });

    it('restores a deleted top-level department', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row({ deletedAt: new Date() }));
      prisma.department.update.mockResolvedValue(row());

      const result = await service.restore('d1');

      expect(prisma.department.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { deletedAt: null }, include: departmentInclude });
      expect(prisma.department.findUnique).toHaveBeenCalledTimes(1);
      expect(result.deletedAt).toBeNull();
    });

    it('restores under an active parent but not under a deleted one', async () => {
      const { prisma, service } = setup();
      prisma.department.update.mockResolvedValue(row({ parentId: 'p1' }));
      prisma.department.findUnique.mockResolvedValueOnce(row({ deletedAt: new Date(), parentId: 'p1' })).mockResolvedValueOnce({ deletedAt: null });

      await service.restore('d1');
      expect(prisma.department.findUnique).toHaveBeenNthCalledWith(2, { where: { id: 'p1' }, select: { deletedAt: true } });

      prisma.department.findUnique
        .mockResolvedValueOnce(row({ deletedAt: new Date(), parentId: 'p1' }))
        .mockResolvedValueOnce({ deletedAt: new Date() });
      await expect(service.restore('d1')).rejects.toThrow(
        new ConflictException('Phòng ban cha đã bị xóa, hãy khôi phục phòng ban cha trước'),
      );
      expect(prisma.department.update).toHaveBeenCalledTimes(1);
    });

    it('refuses to restore an active department', async () => {
      const { prisma, service } = setup();
      prisma.department.findUnique.mockResolvedValue(row());

      await expect(service.restore('d1')).rejects.toThrow(new ConflictException('Phòng ban chưa bị xóa'));
    });
  });
});
