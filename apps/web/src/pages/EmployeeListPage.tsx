import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { STATUS_LABEL, formatDate, ROLE_LABEL } from '../labels';
import type { EmployeeListItem, EmployeeStatus, ListParams, Page, SortField } from '../types';

const COLUMNS: Array<{ key: SortField | null; label: string }> = [
  { key: 'code', label: 'Mã NV' },
  { key: 'fullName', label: 'Họ tên' },
  { key: null, label: 'Số điện thoại' },
  { key: 'department', label: 'Phòng ban' },
  { key: 'position', label: 'Chức vụ' },
  { key: 'hireDate', label: 'Ngày vào làm' },
  { key: null, label: 'Trạng thái' },
  { key: null, label: 'Tài khoản' },
];

function readParams(search: URLSearchParams): ListParams {
  return {
    q: search.get('q') ?? undefined,
    department: search.get('department') ?? undefined,
    position: search.get('position') ?? undefined,
    status: (search.get('status') as EmployeeStatus | null) ?? undefined,
    sortBy: (search.get('sortBy') as SortField | null) ?? 'createdAt',
    sortOrder: search.get('sortOrder') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Number(search.get('page')) || 1),
  };
}

export function EmployeeListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const params = readParams(search);
  const [keyword, setKeyword] = useState(params.q ?? '');
  const [data, setData] = useState<Page<EmployeeListItem> | null>(null);
  const [options, setOptions] = useState<{ departments: string[]; positions: string[] }>({ departments: [], positions: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** Updates URL params; any filter change returns to page 1. */
  const update = (changes: Partial<Record<keyof ListParams, string | undefined>>, resetPage = true) => {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete('page');
    setSearch(next, { replace: true });
  };

  useEffect(() => {
    api.filterOptions().then(setOptions).catch(() => undefined);
  }, []);

  // Debounce typing into the search box.
  useEffect(() => {
    if (keyword === (params.q ?? '')) return;
    const timer = setTimeout(() => update({ q: keyword.trim() || undefined }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const queryKey = search.toString();
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    api
      .listEmployees(readParams(new URLSearchParams(queryKey)))
      .then((page) => !ignore && setData(page))
      .catch((err: Error) => !ignore && setError(err.message))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [queryKey]);

  const toggleSort = (key: SortField) => {
    const order = params.sortBy === key && params.sortOrder === 'asc' ? 'desc' : 'asc';
    update({ sortBy: key, sortOrder: order }, false);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const goToPage = (page: number) => update({ page: page > 1 ? String(page) : undefined }, false);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Nhân viên</h1>
        <Link to="/employees/new" className="btn btn-primary">
          + Thêm nhân viên
        </Link>
      </div>

      <div className="card filters">
        <input
          type="search"
          placeholder="Tìm theo mã, họ tên, email, số điện thoại…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="Tìm kiếm"
        />
        <select value={params.department ?? ''} onChange={(e) => update({ department: e.target.value || undefined })} aria-label="Phòng ban">
          <option value="">Tất cả phòng ban</option>
          {options.departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select value={params.position ?? ''} onChange={(e) => update({ position: e.target.value || undefined })} aria-label="Chức vụ">
          <option value="">Tất cả chức vụ</option>
          {options.positions.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select value={params.status ?? ''} onChange={(e) => update({ status: e.target.value || undefined })} aria-label="Trạng thái">
          <option value="">Đang làm (mọi trạng thái)</option>
          <option value="ACTIVE">{STATUS_LABEL.ACTIVE}</option>
          <option value="PROBATION">{STATUS_LABEL.PROBATION}</option>
          <option value="ON_LEAVE">{STATUS_LABEL.ON_LEAVE}</option>
          <option value="RESIGNED">Đã nghỉ việc (đã xóa)</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              {COLUMNS.map(({ key, label }) => (
                <th key={label}>
                  {key ? (
                    <button type="button" className="sort-btn" onClick={() => toggleSort(key)}>
                      {label}
                      {params.sortBy === key ? (params.sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((e) => (
              <tr key={e.id} className="clickable" onClick={() => navigate(`/employees/${e.id}`)}>
                <td className="mono">{e.code}</td>
                <td>
                  <Link to={`/employees/${e.id}`} onClick={(ev) => ev.stopPropagation()}>
                    {e.fullName}
                  </Link>
                  <div className="muted small">{e.email}</div>
                </td>
                <td>{e.phone ?? '—'}</td>
                <td>{e.department}</td>
                <td>{e.position}</td>
                <td>{formatDate(e.hireDate)}</td>
                <td>
                  <span className={`badge status-${e.status.toLowerCase()}`}>{STATUS_LABEL[e.status]}</span>
                </td>
                <td>{e.accountRole ? ROLE_LABEL[e.accountRole] : <span className="muted">—</span>}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="empty">
                  Không có nhân viên nào phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="muted">
          {loading ? 'Đang tải…' : data ? `${data.total} nhân viên · Trang ${data.page}/${totalPages}` : ''}
        </span>
        <div className="row gap-sm">
          <button type="button" className="btn btn-secondary" disabled={!data || data.page <= 1} onClick={() => goToPage((data?.page ?? 1) - 1)}>
            ‹ Trước
          </button>
          <button type="button" className="btn btn-secondary" disabled={!data || data.page >= totalPages} onClick={() => goToPage((data?.page ?? 1) + 1)}>
            Sau ›
          </button>
        </div>
      </div>
    </div>
  );
}
