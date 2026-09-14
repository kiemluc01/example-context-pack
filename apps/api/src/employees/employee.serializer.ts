import type { Department, Employee, Prisma, User } from '@prisma/client';

export const employeeInclude = { user: true, department: true } satisfies Prisma.EmployeeInclude;

export type EmployeeWithRelations = Employee & { user: User | null; department: Department };

export const toDateString = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

/** Parses a validated YYYY-MM-DD string into a UTC date for @db.Date columns. */
export const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

/** List rows omit salary and national ID. */
export function toListItem(e: EmployeeWithRelations) {
  return {
    id: e.id,
    code: e.code,
    fullName: e.fullName,
    email: e.email,
    phone: e.phone,
    department: { id: e.department.id, code: e.department.code, name: e.department.name },
    position: e.position,
    status: e.status,
    hireDate: toDateString(e.hireDate),
    hasAvatar: Boolean(e.avatarPath),
    accountRole: e.user?.role ?? null,
    deletedAt: e.deletedAt?.toISOString() ?? null,
  };
}

export function toDetail(e: EmployeeWithRelations) {
  return {
    ...toListItem(e),
    dateOfBirth: toDateString(e.dateOfBirth),
    gender: e.gender,
    salary: e.salary === null ? null : e.salary.toNumber(),
    nationalId: e.nationalId,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    account: e.user ? { role: e.user.role, mustChangePassword: e.user.mustChangePassword } : null,
  };
}

export type EmployeeDetail = ReturnType<typeof toDetail>;
