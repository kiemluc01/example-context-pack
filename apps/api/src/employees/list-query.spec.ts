import { EmployeeStatus } from '@prisma/client';
import { buildListOrderBy, buildListWhere } from './list-query';

describe('buildListWhere', () => {
  it('hides soft-deleted employees by default', () => {
    expect(buildListWhere({})).toEqual({ deletedAt: null });
  });

  it('filters by a live status', () => {
    expect(buildListWhere({ status: EmployeeStatus.ON_LEAVE })).toEqual({ deletedAt: null, status: 'ON_LEAVE' });
  });

  it('shows only soft-deleted employees for RESIGNED', () => {
    expect(buildListWhere({ status: EmployeeStatus.RESIGNED })).toEqual({ deletedAt: { not: null } });
  });

  it('adds exact department/position filters and a case-insensitive keyword over four fields', () => {
    const where = buildListWhere({ q: '  an ', department: 'Kỹ thuật', position: 'Lập trình viên' });
    const contains = { contains: 'an', mode: 'insensitive' };
    expect(where).toEqual({
      deletedAt: null,
      department: 'Kỹ thuật',
      position: 'Lập trình viên',
      OR: [{ code: contains }, { fullName: contains }, { email: contains }, { phone: contains }],
    });
  });

  it('ignores a blank keyword', () => {
    expect(buildListWhere({ q: '   ' })).not.toHaveProperty('OR');
  });
});

describe('buildListOrderBy', () => {
  it('adds id as a stable tie-breaker', () => {
    expect(buildListOrderBy({ sortBy: 'fullName', sortOrder: 'asc' })).toEqual([{ fullName: 'asc' }, { id: 'asc' }]);
  });
});
