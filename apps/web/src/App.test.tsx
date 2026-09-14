import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { makeUser } from './test/fixtures';
import type { SessionUser } from './types';

const auth = vi.hoisted(() => ({
  user: null as SessionUser | null,
  loading: false,
  logout: () => Promise.resolve(),
}));
vi.mock('./auth', () => ({ useAuth: () => auth }));
vi.mock('./pages/LoginPage', () => ({ LoginPage: () => 'Trang đăng nhập' }));
vi.mock('./pages/ChangePasswordPage', () => ({ ChangePasswordPage: () => 'Trang đổi mật khẩu' }));
vi.mock('./pages/MyProfilePage', () => ({ MyProfilePage: () => 'Trang hồ sơ' }));
vi.mock('./pages/EmployeeListPage', () => ({ EmployeeListPage: () => 'Trang danh sách' }));
vi.mock('./pages/EmployeeFormPage', () => ({ EmployeeFormPage: () => 'Trang form' }));
vi.mock('./pages/EmployeeDetailPage', () => ({ EmployeeDetailPage: () => 'Trang chi tiết' }));
vi.mock('./pages/DepartmentListPage', () => ({ DepartmentListPage: () => 'Trang phòng ban' }));
vi.mock('./pages/DepartmentDetailPage', () => ({ DepartmentDetailPage: () => 'Trang chi tiết phòng ban' }));
vi.mock('./pages/DepartmentFormPage', () => ({ DepartmentFormPage: () => 'Trang form phòng ban' }));

function renderAt(path: string, user: SessionUser | null, loading = false) {
  auth.user = user;
  auth.loading = loading;
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('App routing', () => {
  it('waits for the session check', () => {
    renderAt('/employees', null, true);
    expect(screen.getByText('Đang tải…')).toBeTruthy();
  });

  it('sends anonymous visitors to the login page', () => {
    renderAt('/employees', null);
    expect(screen.getByText('Trang đăng nhập')).toBeTruthy();
  });

  it('forces a temporary password to be changed first', () => {
    renderAt('/me', makeUser('HR', { mustChangePassword: true }));
    expect(screen.getByText('Trang đổi mật khẩu')).toBeTruthy();
  });

  it.each([
    ['/', 'HR', 'Trang danh sách'],
    ['/', 'EMPLOYEE', 'Trang hồ sơ'],
    ['/employees', 'EMPLOYEE', 'Trang hồ sơ'],
    ['/employees', 'ADMIN', 'Trang danh sách'],
    ['/employees/new', 'HR', 'Trang form'],
    ['/employees/e1', 'HR', 'Trang chi tiết'],
    ['/employees/e1/edit', 'HR', 'Trang form'],
    ['/departments', 'HR', 'Trang phòng ban'],
    ['/departments', 'EMPLOYEE', 'Trang hồ sơ'],
    ['/departments/d1', 'HR', 'Trang chi tiết phòng ban'],
    ['/departments/new', 'ADMIN', 'Trang form phòng ban'],
    ['/departments/d1/edit', 'ADMIN', 'Trang form phòng ban'],
    ['/departments/new', 'HR', 'Trang danh sách'],
    ['/departments/d1/edit', 'HR', 'Trang danh sách'],
    ['/khong-co', 'EMPLOYEE', 'Không tìm thấy trang.'],
  ] as const)('%s as %s shows %s', (path, role, text) => {
    renderAt(path, makeUser(role));
    expect(screen.getByText(text)).toBeTruthy();
  });
});
