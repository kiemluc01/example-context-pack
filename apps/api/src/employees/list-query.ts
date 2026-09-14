import { EmployeeStatus, Prisma } from '@prisma/client';
import type { ListEmployeesQueryDto } from './employees.dto';

type ListFilters = Pick<ListEmployeesQueryDto, 'q' | 'department' | 'position' | 'status'>;

/** Soft-deleted employees are hidden unless the RESIGNED status is requested explicitly. */
export function buildListWhere(query: ListFilters): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput =
    query.status === EmployeeStatus.RESIGNED
      ? { deletedAt: { not: null } }
      : { deletedAt: null, ...(query.status ? { status: query.status } : {}) };

  if (query.department) where.department = query.department;
  if (query.position) where.position = query.position;

  const keyword = query.q?.trim();
  if (keyword) {
    const contains = { contains: keyword, mode: Prisma.QueryMode.insensitive };
    where.OR = [{ code: contains }, { fullName: contains }, { email: contains }, { phone: contains }];
  }
  return where;
}

export function buildListOrderBy(query: Pick<ListEmployeesQueryDto, 'sortBy' | 'sortOrder'>) {
  // Secondary key keeps pagination stable when the sort column has duplicates.
  return [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }] as Prisma.EmployeeOrderByWithRelationInput[];
}
