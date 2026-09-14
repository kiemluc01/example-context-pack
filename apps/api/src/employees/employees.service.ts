import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { generateTempPassword, hashPassword } from '../auth/password';
import { PrismaService } from '../prisma/prisma.service';
import { canGrantRole, canManageTarget } from './access';
import { AvatarStorage, detectImageType } from './avatar-storage';
import { EmployeeDetail, EmployeeWithUser, parseDate, toDetail, toListItem } from './employee.serializer';
import type { CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from './employees.dto';
import { buildListOrderBy, buildListWhere } from './list-query';

type EmployeeFields = Omit<CreateEmployeeDto, 'createAccount' | 'accountRole'>;

/** Maps DTO fields to Prisma data: skips absent keys, converts dates, keeps null (clears optional values). */
function toEmployeeData(dto: Partial<EmployeeFields>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dto)) {
    if (value === undefined) continue;
    data[key] = (key === 'dateOfBirth' || key === 'hireDate') && value !== null ? parseDate(value as string) : value;
  }
  return data;
}

export function mapUniqueViolation(err: unknown): unknown {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return err;
  const target = String(err.meta?.target ?? '');
  if (target.includes('national')) return new ConflictException('Số CCCD đã tồn tại');
  if (target.includes('email')) return new ConflictException('Email đã được dùng cho nhân viên khác (kể cả nhân viên đã nghỉ)');
  if (target.includes('code')) return new ConflictException('Mã nhân viên đã tồn tại');
  if (target.includes('employee')) return new ConflictException('Nhân viên đã có tài khoản');
  return new ConflictException('Dữ liệu bị trùng');
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarStorage,
  ) {}

  async list(query: ListEmployeesQueryDto) {
    const where = buildListWhere(query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: { user: true },
        orderBy: buildListOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toListItem), total, page: query.page, pageSize: query.pageSize };
  }

  async filterOptions(): Promise<{ departments: string[]; positions: string[] }> {
    const [departments, positions] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where: { deletedAt: null },
        distinct: ['department'],
        select: { department: true },
        orderBy: { department: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: { deletedAt: null },
        distinct: ['position'],
        select: { position: true },
        orderBy: { position: 'asc' },
      }),
    ]);
    return { departments: departments.map((d) => d.department), positions: positions.map((p) => p.position) };
  }

  async findOne(id: string): Promise<EmployeeDetail> {
    return toDetail(await this.load(id));
  }

  async create(dto: CreateEmployeeDto, actor: AuthUser): Promise<{ employee: EmployeeDetail; tempPassword: string | null }> {
    const { createAccount, accountRole, ...fields } = dto;
    const role = accountRole ?? Role.EMPLOYEE;
    if (createAccount && !canGrantRole(actor.role, role)) {
      throw new ForbiddenException('Chỉ Admin được cấp tài khoản HR hoặc Admin');
    }
    this.assertDateOfBirth(fields.dateOfBirth);

    const tempPassword = createAccount ? generateTempPassword() : null;
    const user = tempPassword
      ? { create: { passwordHash: await hashPassword(tempPassword), role, mustChangePassword: true } }
      : undefined;
    try {
      const employee = await this.prisma.employee.create({
        data: { ...(toEmployeeData(fields) as Prisma.EmployeeCreateInput), user },
        include: { user: true },
      });
      return { employee: toDetail(employee), tempPassword };
    } catch (err) {
      throw mapUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: AuthUser): Promise<EmployeeDetail> {
    const current = await this.loadActive(id);
    this.assertCanManage(actor, current);
    this.assertDateOfBirth(dto.dateOfBirth);
    try {
      const employee = await this.prisma.employee.update({
        where: { id },
        data: toEmployeeData(dto) as Prisma.EmployeeUpdateInput,
        include: { user: true },
      });
      return toDetail(employee);
    } catch (err) {
      throw mapUniqueViolation(err);
    }
  }

  /** Soft delete: marks the employee as resigned; the linked account is locked by AuthGuard. */
  async remove(id: string, actor: AuthUser): Promise<void> {
    const current = await this.load(id);
    if (current.id === actor.employeeId) throw new BadRequestException('Bạn không thể tự xóa hồ sơ của mình');
    this.assertCanManage(actor, current);
    if (current.deletedAt) throw new ConflictException('Nhân viên đã ở trạng thái nghỉ việc');
    await this.prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.RESIGNED, deletedAt: new Date() },
    });
  }

  async restore(id: string, actor: AuthUser): Promise<EmployeeDetail> {
    const current = await this.load(id);
    this.assertCanManage(actor, current);
    if (!current.deletedAt) throw new ConflictException('Nhân viên chưa bị xóa');
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.ACTIVE, deletedAt: null },
      include: { user: true },
    });
    return toDetail(employee);
  }

  async createAccount(id: string, role: Role, actor: AuthUser): Promise<{ employee: EmployeeDetail; tempPassword: string }> {
    const current = await this.loadActive(id);
    if (current.user) throw new ConflictException('Nhân viên đã có tài khoản');
    if (!canGrantRole(actor.role, role)) throw new ForbiddenException('Chỉ Admin được cấp tài khoản HR hoặc Admin');

    const tempPassword = generateTempPassword();
    try {
      await this.prisma.user.create({
        data: { employeeId: id, role, passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
      });
    } catch (err) {
      throw mapUniqueViolation(err);
    }
    return { employee: await this.findOne(id), tempPassword };
  }

  async resetPassword(id: string, actor: AuthUser): Promise<{ tempPassword: string }> {
    const current = await this.loadActive(id);
    if (!current.user) throw new NotFoundException('Nhân viên chưa có tài khoản');
    if (current.id === actor.employeeId) throw new BadRequestException('Hãy dùng chức năng Đổi mật khẩu cho tài khoản của bạn');
    this.assertCanManage(actor, current);

    const tempPassword = generateTempPassword();
    await this.prisma.user.update({
      where: { id: current.user.id },
      data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, sessionVersion: { increment: 1 } },
    });
    return { tempPassword };
  }

  /** Admin-only (enforced by the controller). */
  async changeRole(id: string, role: Role, actor: AuthUser): Promise<EmployeeDetail> {
    const current = await this.loadActive(id);
    if (!current.user) throw new NotFoundException('Nhân viên chưa có tài khoản');
    if (current.id === actor.employeeId) throw new BadRequestException('Bạn không thể tự đổi vai trò của mình');
    await this.prisma.user.update({ where: { id: current.user.id }, data: { role } });
    return this.findOne(id);
  }

  async setAvatar(id: string, file: Express.Multer.File | undefined, actor: AuthUser): Promise<EmployeeDetail> {
    const current = await this.loadActive(id);
    this.assertCanManage(actor, current);
    if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn ảnh');
    const ext = detectImageType(file.buffer);
    if (!ext) throw new BadRequestException('Ảnh phải là JPG, PNG hoặc WEBP');

    const name = await this.avatars.save(file.buffer, ext);
    const employee = await this.prisma.employee.update({ where: { id }, data: { avatarPath: name }, include: { user: true } });
    if (current.avatarPath) await this.avatars.remove(current.avatarPath);
    return toDetail(employee);
  }

  async getAvatar(id: string, actor: AuthUser): Promise<{ path: string; mime: string }> {
    if (actor.role === Role.EMPLOYEE && id !== actor.employeeId) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    const current = await this.load(id);
    if (!current.avatarPath) throw new NotFoundException('Nhân viên chưa có ảnh đại diện');
    return { path: this.avatars.resolve(current.avatarPath), mime: this.avatars.mimeOf(current.avatarPath) };
  }

  private async load(id: string): Promise<EmployeeWithUser> {
    const employee = await this.prisma.employee.findUnique({ where: { id }, include: { user: true } });
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');
    return employee;
  }

  private async loadActive(id: string): Promise<EmployeeWithUser> {
    const employee = await this.load(id);
    if (employee.deletedAt) throw new ConflictException('Nhân viên đã nghỉ việc, hãy khôi phục trước');
    return employee;
  }

  private assertCanManage(actor: AuthUser, target: EmployeeWithUser): void {
    if (!canManageTarget(actor.role, target.user?.role)) {
      throw new ForbiddenException('Chỉ Admin được thao tác trên hồ sơ có tài khoản HR hoặc Admin');
    }
  }

  private assertDateOfBirth(value: string | null | undefined): void {
    if (value && parseDate(value).getTime() >= Date.now()) {
      throw new BadRequestException('Ngày sinh phải trước ngày hôm nay');
    }
  }
}
