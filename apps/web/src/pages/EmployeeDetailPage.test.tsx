import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { makeEmployee, makeUser } from '../test/fixtures';
import type { EmployeeDetail, SessionUser } from '../types';
import { EmployeeDetailPage } from './EmployeeDetailPage';

vi.mock('../api', () => ({
  api: {
    getEmployee: vi.fn(),
    deleteEmployee: vi.fn(),
    restoreEmployee: vi.fn(),
    resetPassword: vi.fn(),
    changeRole: vi.fn(),
    createAccount: vi.fn(),
    uploadAvatar: vi.fn(),
    avatarUrl: () => '/avatar',
  },
}));
const auth = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock('../auth', () => ({ useAuth: () => auth }));

const TEMP = 'Ab3xYz789Kmn';
const employeeAccount = { role: 'EMPLOYEE', mustChangePassword: false } as const;

function renderDetail(employee: EmployeeDetail, { user = makeUser('HR'), state }: { user?: SessionUser; state?: unknown } = {}) {
  auth.user = user;
  vi.mocked(api.getEmployee).mockResolvedValue(employee);
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/employees/${employee.id}`, state }]}>
      <Routes>
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const answerConfirm = (answer: boolean) => vi.spyOn(window, 'confirm').mockReturnValue(answer);
const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!;

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('EmployeeDetailPage', () => {
  it('shows the temporary password handed over from the create form', async () => {
    renderDetail(makeEmployee({ account: { role: 'EMPLOYEE', mustChangePassword: true } }), { state: { tempPassword: TEMP } });

    expect(await screen.findByText(TEMP)).toBeTruthy();
    expect(screen.getByText(/chưa đổi mật khẩu tạm/)).toBeTruthy();
  });

  it('soft-deletes after confirmation and reloads the profile', async () => {
    answerConfirm(true);
    vi.mocked(api.deleteEmployee).mockResolvedValue(undefined);
    renderDetail(makeEmployee());

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa' }));

    await waitFor(() => expect(api.getEmployee).toHaveBeenCalledTimes(2));
    expect(api.deleteEmployee).toHaveBeenCalledWith('e1');
  });

  it('does nothing when the deletion is cancelled', async () => {
    answerConfirm(false);
    renderDetail(makeEmployee());

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa' }));

    expect(api.deleteEmployee).not.toHaveBeenCalled();
  });

  it('offers restore for a resigned employee', async () => {
    vi.mocked(api.restoreEmployee).mockResolvedValue(makeEmployee());
    renderDetail(makeEmployee({ status: 'RESIGNED', deletedAt: '2025-03-01T10:00:00.000Z' }));

    expect(await screen.findByText(/Nhân viên đã nghỉ việc từ 01\/03\/2025/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xóa' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Khôi phục' })).toBeNull());
    expect(api.restoreEmployee).toHaveBeenCalledWith('e1');
  });

  it('keeps HR/Admin account holders read-only for HR', async () => {
    renderDetail(makeEmployee({ account: { role: 'HR', mustChangePassword: false } }));

    expect(await screen.findByText('Hồ sơ có tài khoản HR/Admin chỉ Admin được chỉnh sửa.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Sửa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đặt lại mật khẩu' })).toBeNull();
  });

  it('does not offer delete, reset or role change on your own record', async () => {
    const user = makeUser('ADMIN');
    renderDetail(makeEmployee({ id: user.employee.id, account: { role: 'ADMIN', mustChangePassword: false } }), { user });

    expect(await screen.findByRole('link', { name: 'Sửa' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xóa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đặt lại mật khẩu' })).toBeNull();
    expect(screen.queryByLabelText('Đổi vai trò')).toBeNull();
  });

  it('resets the password and shows the new temporary one', async () => {
    answerConfirm(true);
    vi.mocked(api.resetPassword).mockResolvedValue({ tempPassword: TEMP });
    renderDetail(makeEmployee({ account: employeeAccount }));

    fireEvent.click(await screen.findByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByText(TEMP)).toBeTruthy();
    expect(api.resetPassword).toHaveBeenCalledWith('e1');
  });

  it('lets an admin change the account role after confirmation', async () => {
    answerConfirm(true);
    vi.mocked(api.changeRole).mockResolvedValue(makeEmployee({ account: { role: 'HR', mustChangePassword: false } }));
    renderDetail(makeEmployee({ account: employeeAccount }), { user: makeUser('ADMIN') });

    fireEvent.change(await screen.findByLabelText('Đổi vai trò'), { target: { value: 'HR' } });

    await waitFor(() => expect(api.changeRole).toHaveBeenCalledWith('e1', 'HR'));
  });

  it('creates a login account with the chosen role', async () => {
    vi.mocked(api.createAccount).mockResolvedValue({
      employee: makeEmployee({ account: { role: 'HR', mustChangePassword: true } }),
      tempPassword: TEMP,
    });
    renderDetail(makeEmployee(), { user: makeUser('ADMIN') });

    expect(await screen.findByText('Nhân viên chưa có tài khoản đăng nhập.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Vai trò'), { target: { value: 'HR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByText(TEMP)).toBeTruthy();
    expect(api.createAccount).toHaveBeenCalledWith('e1', 'HR');
  });

  it('rejects avatars over 2 MB before uploading', async () => {
    const { container } = renderDetail(makeEmployee());
    await screen.findByRole('button', { name: 'Đổi ảnh' });
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });

    fireEvent.change(fileInput(container), { target: { files: [big] } });

    expect(screen.getByRole('alert').textContent).toBe('Ảnh vượt quá dung lượng 2 MB');
    expect(api.uploadAvatar).not.toHaveBeenCalled();
  });

  it('uploads a valid avatar', async () => {
    vi.mocked(api.uploadAvatar).mockResolvedValue(makeEmployee({ hasAvatar: true }));
    const { container } = renderDetail(makeEmployee());
    await screen.findByRole('button', { name: 'Đổi ảnh' });
    const file = new File(['png'], 'a.png', { type: 'image/png' });

    fireEvent.change(fileInput(container), { target: { files: [file] } });

    expect(await screen.findByRole('img', { name: 'Nguyễn Văn An' })).toBeTruthy();
    expect(api.uploadAvatar).toHaveBeenCalledWith('e1', file);
  });

  it('shows a loading error', async () => {
    auth.user = makeUser('HR');
    vi.mocked(api.getEmployee).mockRejectedValue(new Error('Không tìm thấy nhân viên'));
    render(
      <MemoryRouter initialEntries={['/employees/x']}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Không tìm thấy nhân viên')).toBeTruthy();
  });
});
