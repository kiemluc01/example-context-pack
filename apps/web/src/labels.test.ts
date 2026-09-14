import { describe, expect, it } from 'vitest';
import { canManage, formatDate, formatMoney, grantableRoles, homePath, initials } from './labels';
import type { Role, SessionUser } from './types';

const userWith = (role: Role): SessionUser => ({
  id: 'u',
  role,
  mustChangePassword: false,
  employee: { id: 'e', code: 'X', fullName: 'X', email: 'x@x.vn' },
});

describe('formatting', () => {
  it('formats dates as DD/MM/YYYY', () => {
    expect(formatDate('2024-03-09')).toBe('09/03/2024');
    expect(formatDate('2024-03-09T10:00:00.000Z')).toBe('09/03/2024');
    expect(formatDate(null)).toBe('—');
  });

  it('formats money in VND and keeps zero', () => {
    expect(formatMoney(15000000)).toMatch(/^15[.  ]000[.  ]000 ₫$/);
    expect(formatMoney(0)).toBe('0 ₫');
    expect(formatMoney(null)).toBe('—');
  });

  it('builds initials from the last two words of a Vietnamese name', () => {
    expect(initials('Nguyễn Văn An')).toBe('VA');
    expect(initials('An')).toBe('A');
    expect(initials('  ')).toBe('?');
  });
});

describe('permissions', () => {
  it('sends employees to their profile and managers to the list', () => {
    expect(homePath(userWith('EMPLOYEE'))).toBe('/me');
    expect(homePath(userWith('HR'))).toBe('/employees');
  });

  it.each([
    ['ADMIN', 'ADMIN', true],
    ['HR', null, true],
    ['HR', 'EMPLOYEE', true],
    ['HR', 'HR', false],
    ['HR', 'ADMIN', false],
    ['EMPLOYEE', null, false],
  ] as const)('%s can manage a record with account %s -> %s', (actor, target, expected) => {
    const account = target ? { role: target, mustChangePassword: false } : null;
    expect(canManage(userWith(actor), { account })).toBe(expected);
  });

  it('limits grantable roles', () => {
    expect(grantableRoles(userWith('ADMIN'))).toEqual(['EMPLOYEE', 'HR', 'ADMIN']);
    expect(grantableRoles(userWith('HR'))).toEqual(['EMPLOYEE']);
    expect(grantableRoles(userWith('EMPLOYEE'))).toEqual([]);
  });
});
