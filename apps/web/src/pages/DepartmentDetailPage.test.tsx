import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { makeDepartment, makeUser } from '../test/fixtures';
import type { SessionUser } from '../types';
import { DepartmentDetailPage } from './DepartmentDetailPage';

vi.mock('../api', () => ({ api: { getDepartment: vi.fn(), deleteDepartment: vi.fn(), restoreDepartment: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock('../auth', () => ({ useAuth: () => auth }));

const DELETED_AT = '2025-03-01T10:00:00.000Z';
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

function renderDetail(user: SessionUser) {
  auth.user = user;
  render(
    <MemoryRouter initialEntries={['/departments/d1']}>
      <Routes>
        <Route path="/departments/:id" element={<DepartmentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('DepartmentDetailPage', () => {
  it('shows the department with links to its parent, manager, employees and sub-departments, read-only for HR', async () => {
    vi.mocked(api.getDepartment).mockResolvedValue(makeDepartment());
    renderDetail(makeUser('HR'));

    expect(await screen.findByRole('heading', { name: 'Kỹ thuật' })).toBeTruthy();
    expect(api.getDepartment).toHaveBeenCalledWith('d1');
    expect(valueOf('Mã phòng ban')).toBe('KT');
    expect(valueOf('Nhân viên đang làm việc')).toBe('12');
    expect(screen.getByRole('link', { name: 'Ban Giám đốc' }).getAttribute('href')).toBe('/departments/d-bgd');
    expect(screen.getByRole('link', { name: 'Nguyễn Văn An (NV0001)' }).getAttribute('href')).toBe('/employees/e1');
    expect(screen.getByRole('link', { name: 'Xem nhân viên' }).getAttribute('href')).toBe('/employees?departmentId=d1');
    expect(screen.getByRole('link', { name: 'Xem phòng ban con' }).getAttribute('href')).toBe('/departments?parentId=d1');
    expect(screen.queryByRole('link', { name: 'Sửa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa' })).toBeNull();
  });

  it('shows dashes for a top-level department without a manager', async () => {
    vi.mocked(api.getDepartment).mockResolvedValue(makeDepartment({ parent: null, manager: null }));
    renderDetail(makeUser('HR'));

    await screen.findByRole('heading', { name: 'Kỹ thuật' });
    expect(valueOf('Phòng ban cha')).toBe('—');
    expect(valueOf('Trưởng phòng')).toBe('—');
  });

  it('lets Admin delete only after confirming, then reloads the department', async () => {
    vi.mocked(api.getDepartment).mockResolvedValueOnce(makeDepartment()).mockResolvedValueOnce(makeDepartment({ deletedAt: DELETED_AT }));
    vi.mocked(api.deleteDepartment).mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderDetail(makeUser('ADMIN'));

    expect((await screen.findByRole('link', { name: 'Sửa' })).getAttribute('href')).toBe('/departments/d1/edit');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(api.deleteDepartment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    expect(await screen.findByText('Phòng ban đã bị xóa từ 01/03/2025.')).toBeTruthy();
    expect(api.deleteDepartment).toHaveBeenCalledWith('d1');
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Khôi phục' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Sửa' })).toBeNull();
  });

  it('restores a deleted department', async () => {
    vi.mocked(api.getDepartment).mockResolvedValue(makeDepartment({ deletedAt: DELETED_AT }));
    vi.mocked(api.restoreDepartment).mockResolvedValue(makeDepartment());
    renderDetail(makeUser('ADMIN'));

    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục' }));

    expect(await screen.findByRole('link', { name: 'Sửa' })).toBeTruthy();
    expect(api.restoreDepartment).toHaveBeenCalledWith('d1');
    expect(screen.queryByText(/Phòng ban đã bị xóa/)).toBeNull();
  });

  it('shows why a delete was refused', async () => {
    vi.mocked(api.getDepartment).mockResolvedValue(makeDepartment());
    vi.mocked(api.deleteDepartment).mockRejectedValue(new Error('Phòng ban còn 12 nhân viên đang làm việc, hãy chuyển họ sang phòng ban khác trước'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDetail(makeUser('ADMIN'));

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa' }));

    expect((await screen.findByRole('alert')).textContent).toContain('còn 12 nhân viên đang làm việc');
  });

  it('shows a load error', async () => {
    vi.mocked(api.getDepartment).mockRejectedValue(new Error('Không tìm thấy phòng ban'));
    renderDetail(makeUser('HR'));

    expect(await screen.findByText('Không tìm thấy phòng ban')).toBeTruthy();
  });
});
