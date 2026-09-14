import 'reflect-metadata';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDepartmentDto, ListDepartmentsQueryDto, UpdateDepartmentDto } from './departments.dto';

const ID = '6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60';

async function check<T extends object>(cls: ClassConstructor<T>, plain: Record<string, unknown>) {
  const dto = plainToInstance(cls, plain);
  const errors = await validate(dto);
  const messages: Record<string, string[]> = Object.fromEntries(
    errors.map((e) => [e.property, Object.values(e.constraints ?? {})]),
  );
  return { dto, messages };
}

describe('CreateDepartmentDto', () => {
  it('normalises code and name and accepts a parent or none', async () => {
    const { dto, messages } = await check(CreateDepartmentDto, { code: ' kd-01 ', name: '  Kinh doanh ', parentId: ID });
    expect(messages).toEqual({});
    expect(dto).toMatchObject({ code: 'KD-01', name: 'Kinh doanh', parentId: ID });

    expect((await check(CreateDepartmentDto, { code: 'KD', name: 'Kinh doanh', parentId: null })).messages).toEqual({});
  });

  it('reports invalid and missing fields with Vietnamese messages', async () => {
    const { messages } = await check(CreateDepartmentDto, { code: 'KD 01!', name: 'a'.repeat(101), parentId: 'kd' });
    expect(messages.code).toContain('Mã phòng ban chỉ gồm chữ không dấu, số, "-" hoặc "_", tối đa 20 ký tự');
    expect(messages.name).toContain('Tên phòng ban bắt buộc, tối đa 100 ký tự');
    expect(messages.parentId).toContain('Phòng ban cha không hợp lệ');

    expect(Object.keys((await check(CreateDepartmentDto, { name: '   ' })).messages).sort()).toEqual(['code', 'name']);
  });
});

describe('UpdateDepartmentDto', () => {
  it('accepts a partial update and null to clear the parent or manager', async () => {
    expect((await check(UpdateDepartmentDto, {})).messages).toEqual({});

    const { dto, messages } = await check(UpdateDepartmentDto, { parentId: null, managerId: null });
    expect(messages).toEqual({});
    expect(dto).toMatchObject({ parentId: null, managerId: null });
  });

  it('rejects null for required fields and malformed ids', async () => {
    const { messages } = await check(UpdateDepartmentDto, { code: null, name: null, managerId: 'an' });
    expect(Object.keys(messages).sort()).toEqual(['code', 'managerId', 'name']);
    expect(messages.managerId).toContain('Trưởng phòng không hợp lệ');
  });
});

describe('ListDepartmentsQueryDto', () => {
  it('applies defaults', async () => {
    const { dto, messages } = await check(ListDepartmentsQueryDto, {});
    expect(messages).toEqual({});
    expect(dto).toMatchObject({ status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc', page: 1, pageSize: 20 });
  });

  it('converts query strings and trims the keyword', async () => {
    const { dto, messages } = await check(ListDepartmentsQueryDto, {
      q: ' kinh ',
      parentId: ID,
      status: 'DELETED',
      sortBy: 'code',
      sortOrder: 'desc',
      page: '2',
      pageSize: '50',
    });
    expect(messages).toEqual({});
    expect(dto).toMatchObject({ q: 'kinh', parentId: ID, status: 'DELETED', sortBy: 'code', sortOrder: 'desc', page: 2, pageSize: 50 });
  });

  it('rejects unknown values', async () => {
    const { messages } = await check(ListDepartmentsQueryDto, { status: 'ALL', sortBy: 'employeeCount', pageSize: '101', parentId: 'x' });
    expect(Object.keys(messages).sort()).toEqual(['pageSize', 'parentId', 'sortBy', 'status']);
    expect(messages.status).toContain('Trạng thái không hợp lệ');
  });
});
