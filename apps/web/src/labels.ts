import type { EditableStatus, EmployeeDetail, EmployeeStatus, Gender, Role, SessionUser } from './types';

export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', HR: 'HR', EMPLOYEE: 'Nhân viên' };

export const STATUS_LABEL: Record<EmployeeStatus, string> = {
  PROBATION: 'Thử việc',
  ACTIVE: 'Đang làm việc',
  ON_LEAVE: 'Nghỉ phép dài hạn',
  RESIGNED: 'Đã nghỉ việc',
};

export const EDITABLE_STATUSES: EditableStatus[] = ['PROBATION', 'ACTIVE', 'ON_LEAVE'];

export const GENDER_LABEL: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

/** YYYY-MM-DD -> DD/MM/YYYY */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts.length > 1 ? parts[parts.length - 2][0] : '';
  return (first + parts[parts.length - 1][0]).toUpperCase();
}

export const homePath = (user: SessionUser): string => (user.role === 'EMPLOYEE' ? '/me' : '/employees');

/** Mirrors the API rule: HR manages plain employees; HR/Admin account holders are managed by Admin. */
export function canManage(user: SessionUser, employee: Pick<EmployeeDetail, 'account'>): boolean {
  if (user.role === 'ADMIN') return true;
  return user.role === 'HR' && (!employee.account || employee.account.role === 'EMPLOYEE');
}

export function grantableRoles(user: SessionUser): Role[] {
  if (user.role === 'ADMIN') return ['EMPLOYEE', 'HR', 'ADMIN'];
  return user.role === 'HR' ? ['EMPLOYEE'] : [];
}
