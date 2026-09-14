import { EmployeeStatus, Prisma } from '@prisma/client';
import type { ListEmployeesQueryDto } from './employees.dto';

type ListFilters = Pick<ListEmployeesQueryDto, 'q' | 'departmentId' | 'position' | 'status'>;

/** Soft-deleted employees are hidden unless the RESIGNED status is requested explicitly. */
export function buildListWhere(query: ListFilters): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput =
    query.status === EmployeeStatus.RESIGNED
      ? { deletedAt: { not: null } }
      : { deletedAt: null, ...(query.status ? { status: query.status } : {}) };

  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.position) where.position = query.position;

  const keyword = query.q?.trim();
  if (keyword) {
    const contains = { contains: keyword, mode: Prisma.QueryMode.insensitive };
    where.OR = [{ code: contains }, { fullName: contains }, { email: contains }, { phone: contains }];
  }
  return where;
}

export function buildListOrderBy(query: Pick<ListEmployeesQueryDto, 'sortBy' | 'sortOrder'>) {
  // The department column sorts by the department name.
  const primary = query.sortBy === 'department' ? { department: { name: query.sortOrder } } : { [query.sortBy]: query.sortOrder };
  // Secondary key keeps pagination stable when the sort column has duplicates.
  return [primary, { id: 'asc' }] as Prisma.EmployeeOrderByWithRelationInput[];
}
