export type Role = 'ADMIN' | 'HR' | 'EMPLOYEE';
export type EmployeeStatus = 'PROBATION' | 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
export type EditableStatus = Exclude<EmployeeStatus, 'RESIGNED'>;
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type SortField = 'code' | 'fullName' | 'department' | 'position' | 'hireDate' | 'createdAt';
export type DepartmentSortField = 'code' | 'name' | 'createdAt';

export interface SessionUser {
  id: string;
  role: Role;
  mustChangePassword: boolean;
  employee: { id: string; code: string; fullName: string; email: string };
}

export interface DepartmentRef {
  id: string;
  code: string;
  name: string;
}

export interface EmployeeListItem {
  id: string;
  code: string;
  fullName: string;
  email: string;
  phone: string | null;
  department: DepartmentRef;
  position: string;
  status: EmployeeStatus;
  hireDate: string;
  hasAvatar: boolean;
  accountRole: Role | null;
  deletedAt: string | null;
}

export interface EmployeeDetail extends EmployeeListItem {
  dateOfBirth: string | null;
  gender: Gender | null;
  salary: number | null;
  nationalId: string | null;
  createdAt: string;
  updatedAt: string;
  account: { role: Role; mustChangePassword: boolean } | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListParams {
  q?: string;
  departmentId?: string;
  position?: string;
  status?: EmployeeStatus;
  sortBy?: SortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface EmployeePayload {
  code: string;
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  departmentId: string;
  position: string;
  hireDate: string;
  status: EditableStatus;
  salary: number | null;
  nationalId: string | null;
}

export interface Department extends DepartmentRef {
  parent: DepartmentRef | null;
  manager: { id: string; code: string; fullName: string } | null;
  /** Employees that are not soft-deleted. */
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DepartmentListParams {
  q?: string;
  parentId?: string;
  status?: 'ACTIVE' | 'DELETED';
  sortBy?: DepartmentSortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface DepartmentPayload {
  code: string;
  name: string;
  parentId: string | null;
  managerId?: string | null;
}
