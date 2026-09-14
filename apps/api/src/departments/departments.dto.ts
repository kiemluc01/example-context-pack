import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { CODE_RULE, Present, Trim, Upper } from '../employees/employees.dto';

export const DEPARTMENT_SORT_FIELDS = ['code', 'name', 'createdAt'] as const;
export type DepartmentSortField = (typeof DEPARTMENT_SORT_FIELDS)[number];
export const DEPARTMENT_STATUSES = ['ACTIVE', 'DELETED'] as const;

const msg = {
  code: 'Mã phòng ban chỉ gồm chữ không dấu, số, "-" hoặc "_", tối đa 20 ký tự',
  name: 'Tên phòng ban bắt buộc, tối đa 100 ký tự',
  parentId: 'Phòng ban cha không hợp lệ',
  managerId: 'Trưởng phòng không hợp lệ',
};

export class CreateDepartmentDto {
  @Upper() @IsString({ message: msg.code }) @Matches(CODE_RULE, { message: msg.code })
  code: string;

  @Trim() @IsString({ message: msg.name }) @Length(1, 100, { message: msg.name })
  name: string;

  /** Null or absent: top-level department. */
  @IsOptional() @IsUUID('all', { message: msg.parentId })
  parentId?: string | null;
}

/** The manager is only set on update: a new department has no employees yet. */
export class UpdateDepartmentDto {
  @Present() @Upper() @IsString({ message: msg.code }) @Matches(CODE_RULE, { message: msg.code })
  code?: string;

  @Present() @Trim() @IsString({ message: msg.name }) @Length(1, 100, { message: msg.name })
  name?: string;

  @IsOptional() @IsUUID('all', { message: msg.parentId })
  parentId?: string | null;

  @IsOptional() @IsUUID('all', { message: msg.managerId })
  managerId?: string | null;
}

export class ListDepartmentsQueryDto {
  @IsOptional() @Trim() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsUUID('all', { message: msg.parentId })
  parentId?: string;

  @IsOptional() @IsIn(DEPARTMENT_STATUSES, { message: 'Trạng thái không hợp lệ' })
  status: (typeof DEPARTMENT_STATUSES)[number] = 'ACTIVE';

  @IsOptional() @IsIn(DEPARTMENT_SORT_FIELDS, { message: 'Trường sắp xếp không hợp lệ' })
  sortBy: DepartmentSortField = 'name';

  @IsOptional() @IsIn(['asc', 'desc'], { message: 'Thứ tự sắp xếp không hợp lệ' })
  sortOrder: 'asc' | 'desc' = 'asc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;
}
