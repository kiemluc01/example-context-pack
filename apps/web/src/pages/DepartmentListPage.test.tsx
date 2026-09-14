import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { makeDepartment, makeUser } from '../test/fixtures';
import type { SessionUser } from '../types';
import { DepartmentListPage } from './DepartmentListPage';

vi.mock('../api', () => ({ api: { listDepartments: vi.fn(), departmentOptions: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock('../auth', () => ({ useAuth: () => auth }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const urlParams = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

function renderList(url = '/departments', user: SessionUser = makeUser('ADMIN')) {
  auth.user = user;
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/departments" element={<DepartmentListPage />} />
        <Route path="/departments/:id" element={<div>Trang chi tiết phòng ban</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.departmentOptions).mockResolvedValue([{ id: 'd-bgd', code: 'BGD', name: 'Ban Giám đốc' }]);
  vi.mocked(api.listDepartments).mockResolvedValue({ items: [makeDepartment()], total: 25, page: 2, pageSize: 10 });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('DepartmentListPage', () => {
  it('loads the list described by the URL and shows parent, manager and employee count', async () => {
    renderList('/departments?status=DELETED&page=2&sortBy=code&sortOrder=desc&parentId=d-bgd');

    const row = (await screen.findByText('KT')).closest('tr')!;
    expect(api.listDepartments).toHaveBeenCalledWith({
      q: undefined,
      parentId: 'd-bgd',
      status: 'DELETED',
      sortBy: 'code',
      sortOrder: 'desc',
      page: 2,
    });
    expect(row.textContent).toContain('Kỹ thuật');
    expect(row.textContent).toContain('Ban Giám đốc');
    expect(row.textContent).toContain('Nguyễn Văn An');
    expect(row.textContent).toContain('12');
    expect(screen.getByText('25 phòng ban · Trang 2/3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mã phòng ban ▼' })).toBeTruthy();
  });

  it('defaults to active departments sorted by name and shows dashes for missing parent or manager', async () => {
    vi.mocked(api.listDepartments).mockResolvedValue({
      items: [makeDepartment({ parent: null, manager: null })],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderList();

    const row = (await screen.findByText('KT')).closest('tr')!;
    expect(api.listDepartments).toHaveBeenCalledWith(expect.objectContaining({ status: undefined, sortBy: 'name', sortOrder: 'asc', page: 1 }));
    expect(screen.getByRole('button', { name: 'Tên phòng ban ▲' })).toBeTruthy();
    expect(row.querySelectorAll('.muted')).toHaveLength(2);
  });

  it('shows the add button only to Admin', async () => {
    renderList('/departments', makeUser('HR'));
    await screen.findByText('KT');
    expect(screen.queryByRole('link', { name: '+ Thêm phòng ban' })).toBeNull();
    cleanup();

    renderList('/departments', makeUser('ADMIN'));
    expect((await screen.findByRole('link', { name: '+ Thêm phòng ban' })).getAttribute('href')).toBe('/departments/new');
  });

  it('returns to page 1 when the parent or status filter changes', async () => {
    renderList('/departments?page=2');
    await screen.findByRole('option', { name: 'Ban Giám đốc' });

    fireEvent.change(screen.getByLabelText('Phòng ban cha'), { target: { value: 'd-bgd' } });
    expect(urlParams().get('parentId')).toBe('d-bgd');
    expect(urlParams().get('page')).toBeNull();

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'DELETED' } });
    expect(urlParams().get('status')).toBe('DELETED');
    await screen.findByText('KT');
  });

  it('toggles sorting, pages and debounces the search box', async () => {
    renderList('/departments?page=2');
    await screen.findByText('25 phòng ban · Trang 2/3');

    fireEvent.click(screen.getByRole('button', { name: 'Mã phòng ban' }));
    expect(urlParams().get('sortBy')).toBe('code');
    expect(urlParams().get('sortOrder')).toBe('asc');
    expect(urlParams().get('page')).toBe('2');

    await screen.findByText('25 phòng ban · Trang 2/3');
    fireEvent.click(screen.getByRole('button', { name: 'Sau ›' }));
    expect(urlParams().get('page')).toBe('3');

    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: ' kinh ' } });
    expect(urlParams().get('q')).toBeNull();
    await waitFor(() => expect(urlParams().get('q')).toBe('kinh'));
    expect(urlParams().get('page')).toBeNull();
  });

  it('opens the detail page when a row is clicked', async () => {
    renderList();

    fireEvent.click((await screen.findByText('KT')).closest('tr')!);

    expect(await screen.findByText('Trang chi tiết phòng ban')).toBeTruthy();
  });

  it('shows the empty state and the server error', async () => {
    vi.mocked(api.listDepartments).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderList();
    expect(await screen.findByText('Không có phòng ban nào phù hợp.')).toBeTruthy();
    cleanup();

    vi.mocked(api.listDepartments).mockRejectedValue(new Error('Lỗi máy chủ (500)'));
    renderList();
    expect(await screen.findByText('Lỗi máy chủ (500)')).toBeTruthy();
  });
});
