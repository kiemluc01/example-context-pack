import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { todayIso } from '../employeeForm';
import { makeEmployee, makeUser } from '../test/fixtures';
import type { SessionUser } from '../types';
import { EmployeeFormPage } from './EmployeeFormPage';

vi.mock('../api', () => ({
  api: { getEmployee: vi.fn(), createEmployee: vi.fn(), updateEmployee: vi.fn(), departmentOptions: vi.fn() },
}));
const auth = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock('../auth', () => ({ useAuth: () => auth }));

const TEMP = 'Ab3xYz789Kmn';

function DetailProbe() {
  const location = useLocation();
  const state = location.state as { tempPassword?: string | null } | null;
  return (
    <div>
      Chi tiết {location.pathname} {state?.tempPassword ?? ''}
    </div>
  );
}

function renderForm(user: SessionUser, url = '/employees/new') {
  auth.user = user;
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/employees/new" element={<EmployeeFormPage />} />
        <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
        <Route path="/employees/:id" element={<DetailProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;

async function fillRequired() {
  await screen.findByRole('option', { name: 'Nhân sự' });
  fireEvent.change(field('Mã nhân viên'), { target: { value: 'NV0100' } });
  fireEvent.change(field('Họ và tên'), { target: { value: 'Lê Thu Mai' } });
  fireEvent.change(field('Email'), { target: { value: 'mai@congty.vn' } });
  fireEvent.change(field('Phòng ban'), { target: { value: 'd-ns' } });
  fireEvent.change(field('Chức vụ'), { target: { value: 'Chuyên viên tuyển dụng' } });
}

beforeEach(() => {
  vi.mocked(api.departmentOptions).mockResolvedValue([
    { id: 'd1', code: 'KT', name: 'Kỹ thuật' },
    { id: 'd-ns', code: 'NS', name: 'Nhân sự' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('EmployeeFormPage', () => {
  it('creates an employee with a login account and hands the temporary password to the detail page', async () => {
    vi.mocked(api.createEmployee).mockResolvedValue({ employee: makeEmployee({ id: 'new-id' }), tempPassword: TEMP });
    renderForm(makeUser('HR'));

    await fillRequired();
    expect(screen.queryByLabelText('Vai trò')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));

    expect(await screen.findByText(`Chi tiết /employees/new-id ${TEMP}`)).toBeTruthy();
    expect(api.createEmployee).toHaveBeenCalledWith({
      code: 'NV0100',
      fullName: 'Lê Thu Mai',
      email: 'mai@congty.vn',
      phone: null,
      dateOfBirth: null,
      gender: null,
      departmentId: 'd-ns',
      position: 'Chuyên viên tuyển dụng',
      hireDate: todayIso(),
      status: 'ACTIVE',
      salary: null,
      nationalId: null,
      createAccount: true,
      accountRole: 'EMPLOYEE',
    });
  });

  it('lets an admin pick a role or skip the account', async () => {
    vi.mocked(api.createEmployee).mockResolvedValue({ employee: makeEmployee({ id: 'new-id' }), tempPassword: null });
    renderForm(makeUser('ADMIN'));

    await fillRequired();
    fireEvent.change(screen.getByLabelText('Vai trò'), { target: { value: 'HR' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByLabelText('Vai trò')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));

    await screen.findByText(/^Chi tiết \/employees\/new-id/);
    expect(api.createEmployee).toHaveBeenCalledWith(expect.objectContaining({ createAccount: false, accountRole: undefined }));
  });

  it('shows validation errors, including a missing department, without calling the API', async () => {
    renderForm(makeUser('HR'));

    fireEvent.change(field('Email'), { target: { value: 'khong-hop-le' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));

    expect(screen.getByText('Vui lòng nhập họ tên')).toBeTruthy();
    expect(screen.getByText('Email không hợp lệ')).toBeTruthy();
    expect(screen.getByText('Vui lòng chọn phòng ban')).toBeTruthy();
    expect(api.createEmployee).not.toHaveBeenCalled();
    await screen.findByRole('option', { name: 'Nhân sự' });
  });

  it('loads an employee for editing, preselects their department and saves the changes', async () => {
    vi.mocked(api.getEmployee).mockResolvedValue(makeEmployee());
    vi.mocked(api.updateEmployee).mockResolvedValue(makeEmployee());
    renderForm(makeUser('HR'), '/employees/e1/edit');

    expect(await screen.findByRole('heading', { name: 'Sửa thông tin nhân viên' })).toBeTruthy();
    await screen.findByRole('option', { name: 'Kỹ thuật' });
    expect(field('Họ và tên').value).toBe('Nguyễn Văn An');
    expect(field('Phòng ban').value).toBe('d1');
    expect(screen.queryByRole('checkbox')).toBeNull();

    fireEvent.change(field('Chức vụ'), { target: { value: 'Trưởng nhóm' } });
    fireEvent.change(field('Phòng ban'), { target: { value: 'd-ns' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText(/^Chi tiết \/employees\/e1/)).toBeTruthy();
    expect(api.getEmployee).toHaveBeenCalledWith('e1');
    expect(api.updateEmployee).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ position: 'Trưởng nhóm', departmentId: 'd-ns', salary: 15000000, phone: '0912345678' }),
    );
  });

  it('shows the server error', async () => {
    vi.mocked(api.createEmployee).mockRejectedValue(new Error('Mã nhân viên đã tồn tại'));
    renderForm(makeUser('HR'));

    await fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Mã nhân viên đã tồn tại');
  });

  it('reports when the department list cannot be loaded', async () => {
    vi.mocked(api.departmentOptions).mockRejectedValue(new Error('Lỗi máy chủ (500)'));
    renderForm(makeUser('HR'));

    expect((await screen.findByRole('alert')).textContent).toBe('Lỗi máy chủ (500)');
  });
});
