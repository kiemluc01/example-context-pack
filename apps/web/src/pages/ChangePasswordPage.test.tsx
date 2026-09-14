import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { makeUser } from '../test/fixtures';
import type { SessionUser } from '../types';
import { ChangePasswordPage } from './ChangePasswordPage';

vi.mock('../api', () => ({ api: { changePassword: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: null as SessionUser | null, setUser: vi.fn() }));
vi.mock('../auth', () => ({ useAuth: () => auth }));

const CURRENT = 'Matkhau123';
const NEXT = 'MatKhauMoi456';

function renderPage(user: SessionUser) {
  auth.user = user;
  render(
    <MemoryRouter initialEntries={['/change-password']}>
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/employees" element={<div>Trang nhân viên</div>} />
        <Route path="/me" element={<div>Trang hồ sơ</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function submit(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
}

afterEach(() => {
  cleanup();
  vi.mocked(api.changePassword).mockReset();
  auth.setUser.mockReset();
});

describe('ChangePasswordPage', () => {
  it('checks the new password locally before calling the API', () => {
    renderPage(makeUser('HR'));

    submit(CURRENT, 'ngan1');
    expect(screen.getByRole('alert').textContent).toBe('Mật khẩu mới phải từ 8–72 ký tự, gồm cả chữ và số');

    submit(CURRENT, NEXT, 'KhacNhau789');
    expect(screen.getByRole('alert').textContent).toBe('Mật khẩu nhập lại không khớp');

    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('sends a user with a temporary password to their home page afterwards', async () => {
    const updated = makeUser('EMPLOYEE');
    vi.mocked(api.changePassword).mockResolvedValue(updated);
    renderPage(makeUser('EMPLOYEE', { mustChangePassword: true }));

    expect(screen.getByText(/mật khẩu tạm thời/)).toBeTruthy();
    submit(CURRENT, NEXT);

    expect(await screen.findByText('Trang hồ sơ')).toBeTruthy();
    expect(api.changePassword).toHaveBeenCalledWith(CURRENT, NEXT);
    expect(auth.setUser).toHaveBeenCalledWith(updated);
  });

  it('confirms a voluntary change and clears the form', async () => {
    vi.mocked(api.changePassword).mockResolvedValue(makeUser('HR'));
    renderPage(makeUser('HR'));

    submit(CURRENT, NEXT);

    expect(await screen.findByText('Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.')).toBeTruthy();
    expect((screen.getByLabelText('Mật khẩu hiện tại') as HTMLInputElement).value).toBe('');
  });

  it('shows the server error', async () => {
    vi.mocked(api.changePassword).mockRejectedValue(new Error('Mật khẩu hiện tại không đúng'));
    renderPage(makeUser('HR'));

    submit(CURRENT, NEXT);

    expect((await screen.findByRole('alert')).textContent).toBe('Mật khẩu hiện tại không đúng');
  });
});
