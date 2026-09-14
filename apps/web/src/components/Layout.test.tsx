import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '../test/fixtures';
import type { SessionUser } from '../types';
import { Layout } from './Layout';

const auth = vi.hoisted(() => ({
  user: null as SessionUser | null,
  logout: (() => Promise.resolve()) as () => Promise<void>,
}));
vi.mock('../auth', () => ({ useAuth: () => auth }));

function renderLayout(user: SessionUser | null) {
  auth.user = user;
  return render(
    <MemoryRouter initialEntries={['/me']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/me" element={<div>Nội dung trang</div>} />
        </Route>
        <Route path="/login" element={<div>Trang đăng nhập</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('Layout', () => {
  it('shows the employee menu, user name and role for HR', () => {
    renderLayout(makeUser('HR'));

    expect(screen.getByRole('link', { name: 'Nhân viên' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hồ sơ của tôi' })).toBeTruthy();
    expect(screen.getByText('Trần Thị Hà')).toBeTruthy();
    expect(screen.getByText('Nội dung trang')).toBeTruthy();
  });

  it('hides the employee menu for plain employees', () => {
    renderLayout(makeUser('EMPLOYEE'));

    expect(screen.queryByRole('link', { name: 'Nhân viên' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Hồ sơ của tôi' })).toBeTruthy();
  });

  it('hides navigation while a temporary password must be changed', () => {
    renderLayout(makeUser('ADMIN', { mustChangePassword: true }));
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('logs out and returns to the login page', async () => {
    auth.logout = vi.fn().mockResolvedValue(undefined);
    renderLayout(makeUser('HR'));

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    expect(await screen.findByText('Trang đăng nhập')).toBeTruthy();
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('renders nothing without a user', () => {
    const { container } = renderLayout(null);
    expect(container.innerHTML).toBe('');
  });
});
