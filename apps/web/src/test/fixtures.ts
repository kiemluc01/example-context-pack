import type { Department, EmployeeDetail, Role, SessionUser } from '../types';

export function makeEmployee(overrides: Partial<EmployeeDetail> = {}): EmployeeDetail {
  return {
    id: 'e1',
    code: 'NV0001',
    fullName: 'Nguyễn Văn An',
    email: 'an@congty.vn',
    phone: '0912345678',
    department: { id: 'd1', code: 'KT', name: 'Kỹ thuật' },
    position: 'Lập trình viên',
    status: 'ACTIVE',
    hireDate: '2024-01-15',
    hasAvatar: false,
    accountRole: null,
    deletedAt: null,
    dateOfBirth: '1990-05-20',
    gender: 'MALE',
    salary: 15000000,
    nationalId: '012345678901',
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2024-02-01T08:00:00.000Z',
    account: null,
    ...overrides,
  };
}

export function makeDepartment(overrides: Partial<Department> = {}): Department {
  return {
    id: 'd1',
    code: 'KT',
    name: 'Kỹ thuật',
    parent: { id: 'd-bgd', code: 'BGD', name: 'Ban Giám đốc' },
    manager: { id: 'e1', code: 'NV0001', fullName: 'Nguyễn Văn An' },
    employeeCount: 12,
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2024-02-01T08:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

export function makeUser(role: Role = 'HR', overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: `u-${role}`,
    role,
    mustChangePassword: false,
    employee: { id: `e-${role}`, code: `${role}001`, fullName: 'Trần Thị Hà', email: 'ha@congty.vn' },
    ...overrides,
  };
}
