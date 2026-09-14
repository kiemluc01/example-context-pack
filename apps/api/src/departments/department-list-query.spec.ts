import { buildDepartmentOrderBy, buildDepartmentWhere } from './department-list-query';

describe('buildDepartmentWhere', () => {
  it('shows active departments by default', () => {
    expect(buildDepartmentWhere({ status: 'ACTIVE' })).toEqual({ deletedAt: null });
  });

  it('shows only soft-deleted departments for DELETED', () => {
    expect(buildDepartmentWhere({ status: 'DELETED' })).toEqual({ deletedAt: { not: null } });
  });

  it('filters by parent and matches the keyword case-insensitively on code and name', () => {
    const contains = { contains: 'kinh', mode: 'insensitive' };
    expect(buildDepartmentWhere({ q: '  kinh ', parentId: 'p1', status: 'ACTIVE' })).toEqual({
      deletedAt: null,
      parentId: 'p1',
      OR: [{ code: contains }, { name: contains }],
    });
  });

  it('ignores a blank keyword', () => {
    expect(buildDepartmentWhere({ q: '   ', status: 'ACTIVE' })).not.toHaveProperty('OR');
  });
});

describe('buildDepartmentOrderBy', () => {
  it('adds id as a stable tie-breaker', () => {
    expect(buildDepartmentOrderBy({ sortBy: 'code', sortOrder: 'desc' })).toEqual([{ code: 'desc' }, { id: 'asc' }]);
  });
});
