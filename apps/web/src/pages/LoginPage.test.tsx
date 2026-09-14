import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import { LoginPage } from './LoginPage';

const login = vi.fn();
vi.mock('../auth', () => ({ useAuth: () => ({ user: null, login }) }));

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/employees" element={<div>Trang nhân viên</div>} />
        <Route path="/change-password" element={<div>Trang đổi mật khẩu</div>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hr@congty.vn' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Matkhau123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

afterEach(() => {
  cleanup();
  login.mockReset();
});

describe('LoginPage', () => {
  it('signs in and opens the employee list for HR', async () => {
    login.mockResolvedValue({ role: 'HR', mustChangePassword: false });
    renderLogin();
    expect(await screen.findByText('Trang nhân viên')).toBeTruthy();
    expect(login).toHaveBeenCalledWith('hr@congty.vn', 'Matkhau123');
  });

  it('sends users with a temporary password to the change-password page', async () => {
    login.mockResolvedValue({ role: 'EMPLOYEE', mustChangePassword: true });
    renderLogin();
    expect(await screen.findByText('Trang đổi mật khẩu')).toBeTruthy();
  });

  it('shows the server error and stays on the page', async () => {
    login.mockRejectedValue(new ApiError(401, 'Email hoặc mật khẩu không đúng'));
    renderLogin();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Email hoặc mật khẩu không đúng'));
    expect(screen.queryByText('Trang nhân viên')).toBeNull();
  });
});
