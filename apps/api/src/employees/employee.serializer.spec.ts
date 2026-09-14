import { EmployeeStatus, Gender, Prisma, Role, User } from '@prisma/client';
import { EmployeeWithUser, parseDate, toDateString, toDetail, toListItem } from './employee.serializer';

function account(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    employeeId: 'e1',
    passwordHash: 'hash',
    role: Role.HR,
    mustChangePassword: true,
    sessionVersion: 0,
    createdAt: new Date('2024-01-15T08:00:00.000Z'),
    updatedAt: new Date('2024-01-15T08:00:00.000Z'),
    ...overrides,
  };
}

function employee(overrides: Partial<EmployeeWithUser> = {}): EmployeeWithUser {
  return {
    id: 'e1',
    code: 'NV0001',
    fullName: 'Nguyễn Văn An',
    email: 'an@congty.vn',
    phone: '0912345678',
    dateOfBirth: new Date('1990-05-20T00:00:00.000Z'),
    gender: Gender.MALE,
    department: 'Kỹ thuật',
    position: 'Lập trình viên',
    hireDate: new Date('2024-01-15T00:00:00.000Z'),
    status: EmployeeStatus.ACTIVE,
    salary: new Prisma.Decimal(15000000),
    nationalId: '012345678901',
    avatarPath: null,
    createdAt: new Date('2024-01-15T08:00:00.000Z'),
    updatedAt: new Date('2024-02-01T09:30:00.000Z'),
    deletedAt: null,
    user: null,
    ...overrides,
  };
}

describe('date helpers', () => {
  it('formats @db.Date values as YYYY-MM-DD and keeps null', () => {
    expect(toDateString(new Date('2024-02-29T00:00:00.000Z'))).toBe('2024-02-29');
    expect(toDateString(null)).toBeNull();
  });

  it('parses a date string as UTC midnight', () => {
    expect(parseDate('2024-02-29').toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });
});

describe('toListItem', () => {
  it('omits salary and national ID and summarises avatar and account', () => {
    const item = toListItem(
      employee({ avatarPath: 'a.png', user: account(), deletedAt: new Date('2025-03-01T10:00:00.000Z') }),
    );

    expect(item).toEqual({
      id: 'e1',
      code: 'NV0001',
      fullName: 'Nguyễn Văn An',
      email: 'an@congty.vn',
      phone: '0912345678',
      department: 'Kỹ thuật',
      position: 'Lập trình viên',
      status: 'ACTIVE',
      hireDate: '2024-01-15',
      hasAvatar: true,
      accountRole: 'HR',
      deletedAt: '2025-03-01T10:00:00.000Z',
    });
    expect(item).not.toHaveProperty('salary');
    expect(item).not.toHaveProperty('nationalId');
  });

  it('reports no avatar and no account', () => {
    expect(toListItem(employee())).toMatchObject({ hasAvatar: false, accountRole: null, deletedAt: null });
  });
});

describe('toDetail', () => {
  it('adds private fields and account state', () => {
    expect(toDetail(employee({ user: account() }))).toMatchObject({
      dateOfBirth: '1990-05-20',
      gender: 'MALE',
      salary: 15000000,
      nationalId: '012345678901',
      createdAt: '2024-01-15T08:00:00.000Z',
      updatedAt: '2024-02-01T09:30:00.000Z',
      account: { role: 'HR', mustChangePassword: true },
    });
  });

  it('keeps empty optional fields as null', () => {
    expect(toDetail(employee({ salary: null, dateOfBirth: null, gender: null, nationalId: null }))).toMatchObject({
      salary: null,
      dateOfBirth: null,
      gender: null,
      nationalId: null,
      account: null,
    });
  });
});
