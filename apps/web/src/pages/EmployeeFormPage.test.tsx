import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { todayIso } from '../employeeForm';
import { makeEmployee, makeUser } from '../test/fixtures';
import type { SessionUser } from '../types';
import { EmployeeFormPage } from './EmployeeFormPage';

vi.mock('../api', () => ({ api: { getEmployee: vi.fn(), createEmployee: vi.fn(), updateEmployee: vi.fn() } }));
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

function fillRequired() {
  fireEvent.change(field('Mã nhân viên'), { target: { value: 'NV0100' } });
  fireEvent.change(field('Họ và tên'), { target: { value: 'Lê Thu Mai' } });
  fireEvent.change(field('Email'), { target: { value: 'mai@congty.vn' } });
  fireEvent.change(field('Phòng ban'), { target: { value: 'Nhân sự' } });
  fireEvent.change(field('Chức vụ'), { target: { value: 'Chuyên viên tuyển dụng' } });
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('EmployeeFormPage', () => {
  it('creates an employee with a login account and hands the temporary password to the detail page', async () => {
    vi.mocked(api.createEmployee).mockResolvedValue({ employee: makeEmployee({ id: 'new-id' }), tempPassword: TEMP });
    renderForm(makeUser('HR'));

    fillRequired();
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
      department: 'Nhân sự',
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

    fillRequired();
    fireEvent.change(screen.getByLabelText('Vai trò'), { target: { value: 'HR' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByLabelText('Vai trò')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));

    await screen.findByText(/^Chi tiết \/employees\/new-id/);
    expect(api.createEmployee).toHaveBeenCalledWith(expect.objectContaining({ createAccount: false, accountRole: undefined }));
  });

  it('shows validation errors without calling the API', () => {
    renderForm(makeUser('HR'));

    fireEvent.change(field('Email'), { target: { value: 'khong-hop-le' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));

    expect(screen.getByText('Vui lòng nhập họ tên')).toBeTruthy();
    expect(screen.getByText('Email không hợp lệ')).toBeTruthy();
    expect(api.createEmployee).not.toHaveBeenCalled();
  });

  it('loads an employee for editing and saves the changes', async () => {
    vi.mocked(api.getEmployee).mockResolvedValue(makeEmployee());
    vi.mocked(api.updateEmployee).mockResolvedValue(makeEmployee());
    renderForm(makeUser('HR'), '/employees/e1/edit');

    expect(await screen.findByRole('heading', { name: 'Sửa thông tin nhân viên' })).toBeTruthy();
    expect(field('Họ và tên').value).toBe('Nguyễn Văn An');
    expect(screen.queryByRole('checkbox')).toBeNull();

    fireEvent.change(field('Chức vụ'), { target: { value: 'Trưởng nhóm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText(/^Chi tiết \/employees\/e1/)).toBeTruthy();
    expect(api.getEmployee).toHaveBeenCalledWith('e1');
    expect(api.updateEmployee).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ position: 'Trưởng nhóm', salary: 15000000, phone: '0912345678' }),
    );
  });

  it('shows the server error', async () => {
    vi.mocked(api.createEmployee).mockRejectedValue(new Error('Mã nhân viên đã tồn tại'));
    renderForm(makeUser('HR'));

    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Mã nhân viên đã tồn tại');
  });
});
