import { describe, expect, it } from 'vitest';
import { emptyForm, fromDetail, toPayload, validateForm, type EmployeeFormValues } from './employeeForm';
import type { EmployeeDetail } from './types';

const filled = (overrides: Partial<EmployeeFormValues> = {}): EmployeeFormValues => ({
  ...emptyForm(),
  code: 'NV01',
  fullName: 'Nguyễn Văn An',
  email: 'an@congty.vn',
  departmentId: 'd1',
  position: 'Lập trình viên',
  hireDate: '2024-01-01',
  ...overrides,
});

describe('validateForm', () => {
  it('accepts a minimal valid form', () => {
    expect(validateForm(filled())).toEqual({});
  });

  it('flags every missing required field', () => {
    const errors = validateForm({ ...emptyForm(), hireDate: '' });
    expect(Object.keys(errors).sort()).toEqual(['code', 'departmentId', 'email', 'fullName', 'hireDate', 'position']);
    expect(errors.departmentId).toBe('Vui lòng chọn phòng ban');
  });

  it.each([
    ['phone', { phone: '12345' }],
    ['nationalId', { nationalId: '123' }],
    ['salary', { salary: '-5' }],
    ['salary', { salary: '12a' }],
    ['dateOfBirth', { dateOfBirth: '2999-01-01' }],
    ['code', { code: 'NV 01' }],
    ['email', { email: 'khong-hop-le' }],
  ])('flags invalid %s', (field, overrides) => {
    expect(validateForm(filled(overrides))).toHaveProperty(field);
  });

  it('accepts formatted phone and salary input', () => {
    expect(validateForm(filled({ phone: '0912 345 678', salary: '15.000.000' }))).toEqual({});
  });
});

describe('toPayload', () => {
  it('trims text, converts blanks to null, parses salary and sends the department id', () => {
    expect(toPayload(filled({ fullName: '  An  ', phone: ' ', nationalId: '', salary: '15.000.000', gender: '' }))).toMatchObject({
      fullName: 'An',
      phone: null,
      nationalId: null,
      dateOfBirth: null,
      gender: null,
      salary: 15000000,
      departmentId: 'd1',
    });
  });

  it('keeps a zero salary and sends null for an empty one', () => {
    expect(toPayload(filled({ salary: '0' })).salary).toBe(0);
    expect(toPayload(filled({ salary: '' })).salary).toBeNull();
  });
});

describe('fromDetail', () => {
  it('maps nulls to empty inputs, picks the department id and round-trips through toPayload', () => {
    const detail = {
      id: '1', code: 'NV01', fullName: 'An', email: 'an@x.vn', phone: null, department: { id: 'd1', code: 'KT', name: 'Kỹ thuật' },
      position: 'Dev', status: 'ON_LEAVE', hireDate: '2024-01-01', hasAvatar: false, accountRole: null, deletedAt: null,
      dateOfBirth: null, gender: 'FEMALE', salary: 0, nationalId: null, createdAt: '', updatedAt: '', account: null,
    } satisfies EmployeeDetail;
    const values = fromDetail(detail);
    expect(values).toMatchObject({ phone: '', dateOfBirth: '', gender: 'FEMALE', salary: '0', status: 'ON_LEAVE', departmentId: 'd1' });
    expect(toPayload(values)).toMatchObject({ phone: null, gender: 'FEMALE', salary: 0, status: 'ON_LEAVE', departmentId: 'd1' });
  });
});
