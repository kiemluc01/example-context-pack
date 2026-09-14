import type { Prisma } from '@prisma/client';

export const departmentInclude = {
  parent: { select: { id: true, code: true, name: true } },
  manager: { select: { id: true, code: true, fullName: true } },
  _count: { select: { employees: { where: { deletedAt: null } } } },
} satisfies Prisma.DepartmentInclude;

export type DepartmentWithRelations = Prisma.DepartmentGetPayload<{ include: typeof departmentInclude }>;

/** Non-deleted departments for dropdowns and filters. */
export const departmentOptionsQuery = {
  where: { deletedAt: null },
  select: { id: true, code: true, name: true },
  orderBy: { name: 'asc' },
} satisfies Prisma.DepartmentFindManyArgs;

/** employeeCount counts employees that are not soft-deleted. */
export function toDepartment(d: DepartmentWithRelations) {
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    parent: d.parent,
    manager: d.manager,
    employeeCount: d._count.employees,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    deletedAt: d.deletedAt?.toISOString() ?? null,
  };
}

export type DepartmentView = ReturnType<typeof toDepartment>;
