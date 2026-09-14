import { Prisma } from '@prisma/client';
import type { ListDepartmentsQueryDto } from './departments.dto';

/** Soft-deleted departments are shown only when the DELETED status is requested. */
export function buildDepartmentWhere(query: Pick<ListDepartmentsQueryDto, 'q' | 'parentId' | 'status'>): Prisma.DepartmentWhereInput {
  const where: Prisma.DepartmentWhereInput = { deletedAt: query.status === 'DELETED' ? { not: null } : null };
  if (query.parentId) where.parentId = query.parentId;

  const keyword = query.q?.trim();
  if (keyword) {
    const contains = { contains: keyword, mode: Prisma.QueryMode.insensitive };
    where.OR = [{ code: contains }, { name: contains }];
  }
  return where;
}

export function buildDepartmentOrderBy(query: Pick<ListDepartmentsQueryDto, 'sortBy' | 'sortOrder'>) {
  // Secondary key keeps pagination stable when the sort column has duplicates.
  return [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }] as Prisma.DepartmentOrderByWithRelationInput[];
}
