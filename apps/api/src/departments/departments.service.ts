import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildDepartmentOrderBy, buildDepartmentWhere } from './department-list-query';
import { DepartmentView, DepartmentWithRelations, departmentInclude, departmentOptionsQuery, toDepartment } from './department.serializer';
import type { CreateDepartmentDto, ListDepartmentsQueryDto, UpdateDepartmentDto } from './departments.dto';

export function mapDepartmentUniqueViolation(err: unknown): unknown {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return err;
  const target = String(err.meta?.target ?? '');
  if (target.includes('code')) return new ConflictException('Mã phòng ban đã tồn tại');
  if (target.includes('name')) return new ConflictException('Tên phòng ban đã tồn tại (kể cả phòng ban đã xóa)');
  return new ConflictException('Dữ liệu bị trùng');
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListDepartmentsQueryDto) {
    const where = buildDepartmentWhere(query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
        where,
        include: departmentInclude,
        orderBy: buildDepartmentOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toDepartment), total, page: query.page, pageSize: query.pageSize };
  }

  options() {
    return this.prisma.department.findMany(departmentOptionsQuery);
  }

  async findOne(id: string): Promise<DepartmentView> {
    return toDepartment(await this.load(id));
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentView> {
    if (dto.parentId) await this.assertParent(dto.parentId);
    try {
      const department = await this.prisma.department.create({
        data: { code: dto.code, name: dto.name, parentId: dto.parentId ?? null },
        include: departmentInclude,
      });
      return toDepartment(department);
    } catch (err) {
      throw mapDepartmentUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentView> {
    await this.loadActive(id);
    if (dto.parentId) await this.assertParent(dto.parentId, id);
    if (dto.managerId) await this.assertManager(id, dto.managerId);
    try {
      const department = await this.prisma.department.update({
        where: { id },
        // Prisma skips undefined keys; null clears parent or manager.
        data: { code: dto.code, name: dto.name, parentId: dto.parentId, managerId: dto.managerId },
        include: departmentInclude,
      });
      return toDepartment(department);
    } catch (err) {
      throw mapDepartmentUniqueViolation(err);
    }
  }

  /** Soft delete, allowed only when no active employee or active sub-department remains. */
  async remove(id: string): Promise<void> {
    const current = await this.load(id);
    if (current.deletedAt) throw new ConflictException('Phòng ban đã bị xóa');
    if (current._count.employees > 0) {
      throw new ConflictException(`Phòng ban còn ${current._count.employees} nhân viên đang làm việc, hãy chuyển họ sang phòng ban khác trước`);
    }
    const children = await this.prisma.department.count({ where: { parentId: id, deletedAt: null } });
    if (children > 0) {
      throw new ConflictException(`Phòng ban còn ${children} phòng ban con, hãy xóa hoặc chuyển chúng sang phòng ban khác trước`);
    }
    await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date(), managerId: null } });
  }

  async restore(id: string): Promise<DepartmentView> {
    const current = await this.load(id);
    if (!current.deletedAt) throw new ConflictException('Phòng ban chưa bị xóa');
    if (current.parentId) {
      const parent = await this.prisma.department.findUnique({ where: { id: current.parentId }, select: { deletedAt: true } });
      if (parent?.deletedAt) throw new ConflictException('Phòng ban cha đã bị xóa, hãy khôi phục phòng ban cha trước');
    }
    const department = await this.prisma.department.update({ where: { id }, data: { deletedAt: null }, include: departmentInclude });
    return toDepartment(department);
  }

  private async load(id: string): Promise<DepartmentWithRelations> {
    const department = await this.prisma.department.findUnique({ where: { id }, include: departmentInclude });
    if (!department) throw new NotFoundException('Không tìm thấy phòng ban');
    return department;
  }

  private async loadActive(id: string): Promise<DepartmentWithRelations> {
    const department = await this.load(id);
    if (department.deletedAt) throw new ConflictException('Phòng ban đã bị xóa, hãy khôi phục trước');
    return department;
  }

  /** The parent must be active and, when moving an existing department, must not be the department itself or one of its descendants. */
  private async assertParent(parentId: string, departmentId?: string): Promise<void> {
    const parent = await this.prisma.department.findUnique({ where: { id: parentId }, select: { id: true, parentId: true, deletedAt: true } });
    if (!parent || parent.deletedAt) throw new BadRequestException('Phòng ban cha không tồn tại hoặc đã bị xóa');
    if (!departmentId) return;

    const seen = new Set<string>();
    let ancestor: { id: string; parentId: string | null } | null = parent;
    while (ancestor && !seen.has(ancestor.id)) {
      if (ancestor.id === departmentId) {
        throw new BadRequestException('Không thể chọn chính phòng ban này hoặc phòng ban con của nó làm phòng ban cha');
      }
      seen.add(ancestor.id);
      ancestor = ancestor.parentId
        ? await this.prisma.department.findUnique({ where: { id: ancestor.parentId }, select: { id: true, parentId: true } })
        : null;
    }
  }

  private async assertManager(departmentId: string, managerId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: managerId }, select: { departmentId: true, deletedAt: true } });
    if (!employee || employee.deletedAt || employee.departmentId !== departmentId) {
      throw new BadRequestException('Trưởng phòng phải là nhân viên đang làm việc thuộc phòng ban này');
    }
  }
}
