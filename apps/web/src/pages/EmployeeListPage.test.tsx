import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { makeEmployee } from '../test/fixtures';
import { EmployeeListPage } from './EmployeeListPage';

vi.mock('../api', () => ({ api: { listEmployees: vi.fn(), filterOptions: vi.fn() } }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const urlParams = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

function renderList(url = '/employees') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/employees" element={<EmployeeListPage />} />
        <Route path="/employees/:id" element={<div>Trang chi tiết</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.filterOptions).mockResolvedValue({ departments: ['Kỹ thuật', 'Nhân sự'], positions: ['Lập trình viên'] });
  vi.mocked(api.listEmployees).mockResolvedValue({
    items: [makeEmployee({ phone: null, accountRole: 'HR' })],
    total: 25,
    page: 2,
    pageSize: 10,
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('EmployeeListPage', () => {
  it('loads the list described by the URL', async () => {
    renderList('/employees?status=ACTIVE&page=2&sortBy=code&sortOrder=asc');

    expect(await screen.findByText('Nguyễn Văn An')).toBeTruthy();
    expect(api.listEmployees).toHaveBeenCalledWith({
      q: undefined,
      department: undefined,
      position: undefined,
      status: 'ACTIVE',
      sortBy: 'code',
      sortOrder: 'asc',
      page: 2,
    });
    expect(screen.getByText('25 nhân viên · Trang 2/3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mã NV ▲' })).toBeTruthy();
    expect(await screen.findByRole('option', { name: 'Nhân sự' })).toBeTruthy();
  });

  it('returns to page 1 when a filter changes', async () => {
    renderList('/employees?page=2');
    await screen.findByText('Nguyễn Văn An');

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'RESIGNED' } });

    expect(urlParams().get('status')).toBe('RESIGNED');
    expect(urlParams().get('page')).toBeNull();
  });

  it('toggles sorting and keeps the page', async () => {
    renderList('/employees?page=2');
    await screen.findByText('Nguyễn Văn An');

    fireEvent.click(screen.getByRole('button', { name: 'Họ tên' }));
    expect(urlParams().get('sortBy')).toBe('fullName');
    expect(urlParams().get('sortOrder')).toBe('asc');
    expect(urlParams().get('page')).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: 'Họ tên ▲' }));
    expect(urlParams().get('sortOrder')).toBe('desc');
  });

  it('pages through the results', async () => {
    renderList('/employees?page=2');
    await screen.findByText('25 nhân viên · Trang 2/3');

    fireEvent.click(screen.getByRole('button', { name: 'Sau ›' }));
    expect(urlParams().get('page')).toBe('3');

    fireEvent.click(screen.getByRole('button', { name: '‹ Trước' }));
    expect(urlParams().get('page')).toBeNull();
    await screen.findByText('25 nhân viên · Trang 2/3');
  });

  it('debounces the search box into the URL', async () => {
    renderList();
    await screen.findByText('Nguyễn Văn An');

    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: '  an ' } });

    expect(urlParams().get('q')).toBeNull();
    await waitFor(() => expect(urlParams().get('q')).toBe('an'));
  });

  it('opens the detail page when a row is clicked', async () => {
    renderList();

    fireEvent.click((await screen.findByText('NV0001')).closest('tr')!);

    expect(await screen.findByText('Trang chi tiết')).toBeTruthy();
  });

  it('shows the empty state', async () => {
    vi.mocked(api.listEmployees).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderList();

    expect(await screen.findByText('Không có nhân viên nào phù hợp.')).toBeTruthy();
  });

  it('shows the server error', async () => {
    vi.mocked(api.listEmployees).mockRejectedValue(new Error('Lỗi máy chủ (500)'));
    renderList();

    expect(await screen.findByText('Lỗi máy chủ (500)')).toBeTruthy();
  });
});
