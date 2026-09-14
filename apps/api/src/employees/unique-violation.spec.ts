import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mapUniqueViolation } from './employees.service';

const p2002 = (target: unknown) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test', meta: { target } });

describe('mapUniqueViolation', () => {
  it.each([
    [['code'], 'Mã nhân viên đã tồn tại'],
    [['email'], 'Email đã được dùng cho nhân viên khác (kể cả nhân viên đã nghỉ)'],
    [['national_id'], 'Số CCCD đã tồn tại'],
    ['users_employee_id_key', 'Nhân viên đã có tài khoản'],
    [['something'], 'Dữ liệu bị trùng'],
  ])('maps target %p to a 409 message', (target, message) => {
    const mapped = mapUniqueViolation(p2002(target));
    expect(mapped).toBeInstanceOf(ConflictException);
    expect((mapped as ConflictException).message).toBe(message);
  });

  it('passes other errors through unchanged', () => {
    const other = new Error('boom');
    expect(mapUniqueViolation(other)).toBe(other);
    const notFound = new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: 'test' });
    expect(mapUniqueViolation(notFound)).toBe(notFound);
  });
});
