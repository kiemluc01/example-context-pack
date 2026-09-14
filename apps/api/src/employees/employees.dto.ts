import { EmployeeStatus, Gender, Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const EDITABLE_STATUSES = [EmployeeStatus.PROBATION, EmployeeStatus.ACTIVE, EmployeeStatus.ON_LEAVE] as const;
export const SORT_FIELDS = ['code', 'fullName', 'department', 'position', 'hireDate', 'createdAt'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export const MAX_SALARY = 999_999_999_999;

export const CODE_RULE = /^[A-Z0-9_-]{1,20}$/;
const PHONE_RULE = /^(\+84|0)\d{9,10}$/;
const DATE_RULE = /^\d{4}-\d{2}-\d{2}$/;
const NATIONAL_ID_RULE = /^\d{12}$/;

const msg = {
  code: 'Mã nhân viên chỉ gồm chữ không dấu, số, "-" hoặc "_", tối đa 20 ký tự',
  fullName: 'Họ tên bắt buộc, tối đa 100 ký tự',
  email: 'Email không hợp lệ',
  phone: 'Số điện thoại không hợp lệ (vd: 0912345678 hoặc +84912345678)',
  date: 'Ngày không hợp lệ (định dạng YYYY-MM-DD)',
  gender: 'Giới tính không hợp lệ',
  department: 'Vui lòng chọn phòng ban',
  position: 'Chức vụ bắt buộc, tối đa 100 ký tự',
  status: 'Trạng thái chỉ được là Thử việc, Đang làm việc hoặc Nghỉ phép dài hạn',
  salary: `Lương phải là số nguyên từ 0 đến ${MAX_SALARY}`,
  nationalId: 'Số CCCD phải gồm đúng 12 chữ số',
  role: 'Vai trò không hợp lệ',
};

const str = (fn: (s: string) => string) => Transform(({ value }) => (typeof value === 'string' ? fn(value) : value));
export const Trim = () => str((s) => s.trim());
export const Upper = () => str((s) => s.trim().toUpperCase());
const Lower = () => str((s) => s.trim().toLowerCase());
/** Optional text field: blank becomes null (clears the value). */
const Blank = (fn: (s: string) => string = (s) => s) =>
  str((s) => (s.trim() === '' ? (null as unknown as string) : fn(s.trim())));
/** Validate a required field only when it is present (partial update); null is rejected. */
export const Present = () => ValidateIf((_obj, value) => value !== undefined);

export class CreateEmployeeDto {
  @Upper() @IsString({ message: msg.code }) @Matches(CODE_RULE, { message: msg.code })
  code: string;

  @Trim() @IsString({ message: msg.fullName }) @Length(1, 100, { message: msg.fullName })
  fullName: string;

  @Lower() @IsEmail({}, { message: msg.email }) @MaxLength(254, { message: msg.email })
  email: string;

  @Blank((s) => s.replace(/[\s.]/g, '')) @IsOptional() @Matches(PHONE_RULE, { message: msg.phone })
  phone?: string | null;

  @Blank() @IsOptional() @Matches(DATE_RULE, { message: msg.date }) @IsISO8601({ strict: true }, { message: msg.date })
  dateOfBirth?: string | null;

  @IsOptional() @IsEnum(Gender, { message: msg.gender })
  gender?: Gender | null;

  @IsUUID('all', { message: msg.department })
  departmentId: string;

  @Trim() @IsString({ message: msg.position }) @Length(1, 100, { message: msg.position })
  position: string;

  @Matches(DATE_RULE, { message: msg.date }) @IsISO8601({ strict: true }, { message: msg.date })
  hireDate: string;

  @IsOptional() @IsIn(EDITABLE_STATUSES, { message: msg.status })
  status?: EmployeeStatus;

  @IsOptional() @IsInt({ message: msg.salary }) @Min(0, { message: msg.salary }) @Max(MAX_SALARY, { message: msg.salary })
  salary?: number | null;

  @Blank() @IsOptional() @Matches(NATIONAL_ID_RULE, { message: msg.nationalId })
  nationalId?: string | null;

  @IsOptional() @IsBoolean()
  createAccount?: boolean;

  @IsOptional() @IsEnum(Role, { message: msg.role })
  accountRole?: Role;
}

export class UpdateEmployeeDto {
  @Present() @Upper() @IsString({ message: msg.code }) @Matches(CODE_RULE, { message: msg.code })
  code?: string;

  @Present() @Trim() @IsString({ message: msg.fullName }) @Length(1, 100, { message: msg.fullName })
  fullName?: string;

  @Present() @Lower() @IsEmail({}, { message: msg.email }) @MaxLength(254, { message: msg.email })
  email?: string;

  @Blank((s) => s.replace(/[\s.]/g, '')) @IsOptional() @Matches(PHONE_RULE, { message: msg.phone })
  phone?: string | null;

  @Blank() @IsOptional() @Matches(DATE_RULE, { message: msg.date }) @IsISO8601({ strict: true }, { message: msg.date })
  dateOfBirth?: string | null;

  @IsOptional() @IsEnum(Gender, { message: msg.gender })
  gender?: Gender | null;

  @Present() @IsUUID('all', { message: msg.department })
  departmentId?: string;

  @Present() @Trim() @IsString({ message: msg.position }) @Length(1, 100, { message: msg.position })
  position?: string;

  @Present() @Matches(DATE_RULE, { message: msg.date }) @IsISO8601({ strict: true }, { message: msg.date })
  hireDate?: string;

  @Present() @IsIn(EDITABLE_STATUSES, { message: msg.status })
  status?: EmployeeStatus;

  @IsOptional() @IsInt({ message: msg.salary }) @Min(0, { message: msg.salary }) @Max(MAX_SALARY, { message: msg.salary })
  salary?: number | null;

  @Blank() @IsOptional() @Matches(NATIONAL_ID_RULE, { message: msg.nationalId })
  nationalId?: string | null;
}

export class AccountRoleDto {
  @IsEnum(Role, { message: msg.role })
  role: Role;
}

export class ListEmployeesQueryDto {
  @IsOptional() @Trim() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsUUID('all', { message: 'Phòng ban không hợp lệ' })
  departmentId?: string;

  @IsOptional() @Trim() @IsString() @MaxLength(100)
  position?: string;

  @IsOptional() @IsEnum(EmployeeStatus, { message: 'Trạng thái không hợp lệ' })
  status?: EmployeeStatus;

  @IsOptional() @IsIn(SORT_FIELDS, { message: 'Trường sắp xếp không hợp lệ' })
  sortBy: SortField = 'createdAt';

  @IsOptional() @IsIn(['asc', 'desc'], { message: 'Thứ tự sắp xếp không hợp lệ' })
  sortOrder: 'asc' | 'desc' = 'desc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;
}
