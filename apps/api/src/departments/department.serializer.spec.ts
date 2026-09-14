import { DepartmentWithRelations, toDepartment } from './department.serializer';

function row(overrides: Partial<DepartmentWithRelations> = {}): DepartmentWithRelations {
  return {
    id: 'd1',
    code: 'KT',
    name: 'Kỹ thuật',
    parentId: 'd0',
    managerId: 'e1',
    createdAt: new Date('2024-01-15T08:00:00.000Z'),
    updatedAt: new Date('2024-02-01T09:30:00.000Z'),
    deletedAt: null,
    parent: { id: 'd0', code: 'BGD', name: 'Ban Giám đốc' },
    manager: { id: 'e1', code: 'NV0001', fullName: 'Nguyễn Văn An' },
    _count: { employees: 3 },
    ...overrides,
  };
}

describe('toDepartment', () => {
  it('exposes parent and manager references, the active employee count and ISO dates', () => {
    expect(toDepartment(row())).toEqual({
      id: 'd1',
      code: 'KT',
      name: 'Kỹ thuật',
      parent: { id: 'd0', code: 'BGD', name: 'Ban Giám đốc' },
      manager: { id: 'e1', code: 'NV0001', fullName: 'Nguyễn Văn An' },
      employeeCount: 3,
      createdAt: '2024-01-15T08:00:00.000Z',
      updatedAt: '2024-02-01T09:30:00.000Z',
      deletedAt: null,
    });
  });

  it('keeps a missing parent or manager as null and reports the deletion time', () => {
    expect(
      toDepartment(row({ parentId: null, parent: null, managerId: null, manager: null, deletedAt: new Date('2025-03-01T10:00:00.000Z') })),
    ).toMatchObject({ parent: null, manager: null, deletedAt: '2025-03-01T10:00:00.000Z' });
  });
});
