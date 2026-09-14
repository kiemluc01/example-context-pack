import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { makeDepartment, makeEmployee } from '../test/fixtures';
import { DepartmentFormPage } from './DepartmentFormPage';

vi.mock('../api', () => ({
  api: { departmentOptions: vi.fn(), getDepartment: vi.fn(), listEmployees: vi.fn(), createDepartment: vi.fn(), updateDepartment: vi.fn() },
}));

function DetailProbe() {
  const { pathname } = useLocation();
  return <div>Chi tiết {pathname}</div>;
}

function renderForm(url = '/departments/new') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/departments/new" element={<DepartmentFormPage />} />
        <Route path="/departments/:id/edit" element={<DepartmentFormPage />} />
        <Route path="/departments/:id" element={<DetailProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;

beforeEach(() => {
  vi.mocked(api.departmentOptions).mockResolvedValue([
    { id: 'd-bgd', code: 'BGD', name: 'Ban Giám đốc' },
    { id: 'd1', code: 'KT', name: 'Kỹ thuật' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('DepartmentFormPage', () => {
  it('creates a department under a parent, without a manager field', async () => {
    vi.mocked(api.createDepartment).mockResolvedValue(makeDepartment({ id: 'new-id' }));
    renderForm();

    await screen.findByRole('option', { name: 'Ban Giám đốc' });
    expect(screen.queryByLabelText(/^Trưởng phòng/)).toBeNull();
    fireEvent.change(field('Mã phòng ban'), { target: { value: ' kd ' } });
    fireEvent.change(field('Tên phòng ban'), { target: { value: ' Kinh doanh ' } });
    fireEvent.change(field('Phòng ban cha'), { target: { value: 'd-bgd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm phòng ban' }));

    expect(await screen.findByText('Chi tiết /departments/new-id')).toBeTruthy();
    expect(api.createDepartment).toHaveBeenCalledWith({ code: 'kd', name: 'Kinh doanh', parentId: 'd-bgd' });
  });

  it('shows validation errors without calling the API', async () => {
    renderForm();

    fireEvent.change(field('Mã phòng ban'), { target: { value: 'KD 01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm phòng ban' }));

    expect(screen.getByText('Chỉ gồm chữ không dấu, số, "-" hoặc "_", tối đa 20 ký tự')).toBeTruthy();
    expect(screen.getByText('Vui lòng nhập tên phòng ban')).toBeTruthy();
    expect(api.createDepartment).not.toHaveBeenCalled();

    fireEvent.change(field('Tên phòng ban'), { target: { value: 'Kinh doanh' } });
    expect(screen.queryByText('Vui lòng nhập tên phòng ban')).toBeNull();
    await screen.findByRole('option', { name: 'Ban Giám đốc' });
  });

  it('edits a department, offering its active employees as manager and never itself as parent', async () => {
    vi.mocked(api.getDepartment).mockResolvedValue(makeDepartment({ manager: null }));
    vi.mocked(api.listEmployees).mockResolvedValue({
      items: [makeEmployee({ id: 'e2', code: 'NV0002', fullName: 'Lê Thu Mai' })],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    vi.mocked(api.updateDepartment).mockResolvedValue(makeDepartment());
    renderForm('/departments/d1/edit');

    expect(await screen.findByRole('heading', { name: 'Sửa phòng ban' })).toBeTruthy();
    await screen.findByRole('option', { name: 'Ban Giám đốc' });
    expect(field('Tên phòng ban').value).toBe('Kỹ thuật');
    expect(field('Phòng ban cha').value).toBe('d-bgd');
    expect(screen.queryByRole('option', { name: 'Kỹ thuật' })).toBeNull();
    expect(api.listEmployees).toHaveBeenCalledWith({ departmentId: 'd1', sortBy: 'fullName', sortOrder: 'asc', pageSize: 100 });

    fireEvent.change(field('Trưởng phòng'), { target: { value: 'e2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Chi tiết /departments/d1')).toBeTruthy();
    expect(api.updateDepartment).toHaveBeenCalledWith('d1', { code: 'KT', name: 'Kỹ thuật', parentId: 'd-bgd', managerId: 'e2' });
  });

  it('keeps the current manager selectable when they are not in the loaded page and can clear it', async () => {
    vi.mocked(api.getDepartment).mockResolvedValue(makeDepartment());
    vi.mocked(api.listEmployees).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    vi.mocked(api.updateDepartment).mockResolvedValue(makeDepartment());
    renderForm('/departments/d1/edit');

    await screen.findByRole('option', { name: 'Nguyễn Văn An (NV0001)' });
    expect(field('Trưởng phòng').value).toBe('e1');

    fireEvent.change(field('Trưởng phòng'), { target: { value: '' } });
    fireEvent.change(field('Phòng ban cha'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await screen.findByText('Chi tiết /departments/d1');
    expect(api.updateDepartment).toHaveBeenCalledWith('d1', expect.objectContaining({ parentId: null, managerId: null }));
  });

  it('explains that a department without active employees has no manager candidates', async () => {
    vi.mocked(api.getDepartment).mockResolvedValue(makeDepartment({ manager: null }));
    vi.mocked(api.listEmployees).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    renderForm('/departments/d1/edit');

    expect(await screen.findByText('Phòng ban chưa có nhân viên đang làm việc.')).toBeTruthy();
    await screen.findByRole('option', { name: 'Ban Giám đốc' });
  });

  it('shows server errors from loading and saving', async () => {
    vi.mocked(api.getDepartment).mockRejectedValue(new Error('Không tìm thấy phòng ban'));
    vi.mocked(api.listEmployees).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    renderForm('/departments/missing/edit');
    expect((await screen.findByRole('alert')).textContent).toBe('Không tìm thấy phòng ban');
    cleanup();

    vi.mocked(api.createDepartment).mockRejectedValue(new Error('Mã phòng ban đã tồn tại'));
    renderForm();
    await screen.findByRole('option', { name: 'Ban Giám đốc' });
    fireEvent.change(field('Mã phòng ban'), { target: { value: 'KT' } });
    fireEvent.change(field('Tên phòng ban'), { target: { value: 'Khác' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm phòng ban' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Mã phòng ban đã tồn tại');
  });
});
