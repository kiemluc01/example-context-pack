import 'reflect-metadata';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from './employees.dto';

async function check<T extends object>(cls: ClassConstructor<T>, plain: Record<string, unknown>) {
  const dto = plainToInstance(cls, plain);
  const errors = await validate(dto);
  const messages: Record<string, string[]> = Object.fromEntries(
    errors.map((e) => [e.property, Object.values(e.constraints ?? {})]),
  );
  return { dto, messages };
}

const validCreate = {
  code: ' nv0001 ',
  fullName: ' Nguyễn Văn An ',
  email: ' An@CongTy.VN ',
  phone: '0912.345 678',
  dateOfBirth: '',
  gender: 'MALE',
  department: 'Kỹ thuật',
  position: 'Lập trình viên',
  hireDate: '2024-01-15',
  status: 'ACTIVE',
  salary: 15000000,
  nationalId: '  ',
  createAccount: true,
  accountRole: 'HR',
};

describe('CreateEmployeeDto', () => {
  it('normalises text fields and turns blank optional values into null', async () => {
    const { dto, messages } = await check(CreateEmployeeDto, validCreate);

    expect(messages).toEqual({});
    expect(dto).toMatchObject({
      code: 'NV0001',
      fullName: 'Nguyễn Văn An',
      email: 'an@congty.vn',
      phone: '0912345678',
      dateOfBirth: null,
      nationalId: null,
    });
  });

  it('reports every invalid field with a Vietnamese message', async () => {
    const { messages } = await check(CreateEmployeeDto, {
      ...validCreate,
      code: 'NV 01!',
      email: 'x',
      phone: '12345',
      gender: 'X',
      hireDate: '2024-02-30',
      status: 'RESIGNED',
      salary: 1_000_000_000_000,
      nationalId: '12345678901',
      accountRole: 'ROOT',
    });

    expect(Object.keys(messages).sort()).toEqual(
      ['accountRole', 'code', 'email', 'gender', 'hireDate', 'nationalId', 'phone', 'salary', 'status'].sort(),
    );
    expect(messages.phone).toContain('Số điện thoại không hợp lệ (vd: 0912345678 hoặc +84912345678)');
    expect(messages.hireDate).toContain('Ngày không hợp lệ (định dạng YYYY-MM-DD)');
    expect(messages.status).toContain('Trạng thái chỉ được là Thử việc, Đang làm việc hoặc Nghỉ phép dài hạn');
    expect(messages.nationalId).toContain('Số CCCD phải gồm đúng 12 chữ số');
  });

  it('requires the mandatory fields', async () => {
    const { messages } = await check(CreateEmployeeDto, {});
    expect(Object.keys(messages)).toEqual(expect.arrayContaining(['code', 'fullName', 'email', 'department', 'position', 'hireDate']));
  });

  it('rejects a fractional salary', async () => {
    const { messages } = await check(CreateEmployeeDto, { ...validCreate, salary: 1.5 });
    expect(Object.keys(messages)).toEqual(['salary']);
  });
});

describe('UpdateEmployeeDto', () => {
  it('accepts a partial update', async () => {
    const { messages } = await check(UpdateEmployeeDto, {});
    expect(messages).toEqual({});
  });

  it('rejects null for required fields but clears optional ones', async () => {
    const { dto, messages } = await check(UpdateEmployeeDto, { fullName: null, phone: '' });
    expect(Object.keys(messages)).toEqual(['fullName']);
    expect(dto.phone).toBeNull();
  });
});

describe('ListEmployeesQueryDto', () => {
  it('applies defaults', async () => {
    const { dto, messages } = await check(ListEmployeesQueryDto, {});
    expect(messages).toEqual({});
    expect(dto).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc', page: 1, pageSize: 20 });
  });

  it('converts query strings and trims the keyword', async () => {
    const { dto, messages } = await check(ListEmployeesQueryDto, {
      q: '  An ',
      page: '3',
      pageSize: '50',
      sortBy: 'hireDate',
      sortOrder: 'asc',
    });
    expect(messages).toEqual({});
    expect(dto).toMatchObject({ q: 'An', page: 3, pageSize: 50, sortBy: 'hireDate', sortOrder: 'asc' });
  });

  it('rejects out-of-range paging and unknown sort fields', async () => {
    const { messages } = await check(ListEmployeesQueryDto, { page: '0', pageSize: '101', sortBy: 'salary' });
    expect(Object.keys(messages).sort()).toEqual(['page', 'pageSize', 'sortBy']);
    expect(messages.sortBy).toContain('Trường sắp xếp không hợp lệ');
  });
});
