import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Department, DepartmentListParams, DepartmentRef, DepartmentSortField, Page } from '../types';

const COLUMNS: Array<{ key: DepartmentSortField | null; label: string }> = [
  { key: 'code', label: 'Mã phòng ban' },
  { key: 'name', label: 'Tên phòng ban' },
  { key: null, label: 'Phòng ban cha' },
  { key: null, label: 'Trưởng phòng' },
  { key: null, label: 'Nhân viên đang làm' },
];

function readParams(search: URLSearchParams): DepartmentListParams {
  return {
    q: search.get('q') ?? undefined,
    parentId: search.get('parentId') ?? undefined,
    status: search.get('status') === 'DELETED' ? 'DELETED' : undefined,
    sortBy: (search.get('sortBy') as DepartmentSortField | null) ?? 'name',
    sortOrder: search.get('sortOrder') === 'desc' ? 'desc' : 'asc',
    page: Math.max(1, Number(search.get('page')) || 1),
  };
}

export function DepartmentListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const params = readParams(search);
  const [keyword, setKeyword] = useState(params.q ?? '');
  const [data, setData] = useState<Page<Department> | null>(null);
  const [parents, setParents] = useState<DepartmentRef[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** Updates URL params; any filter change returns to page 1. */
  const update = (changes: Partial<Record<keyof DepartmentListParams, string | undefined>>, resetPage = true) => {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete('page');
    setSearch(next, { replace: true });
  };

  useEffect(() => {
    api.departmentOptions().then(setParents).catch(() => undefined);
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
      .listDepartments(readParams(new URLSearchParams(queryKey)))
      .then((page) => !ignore && setData(page))
      .catch((err: Error) => !ignore && setError(err.message))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [queryKey]);

  const toggleSort = (key: DepartmentSortField) => {
    const order = params.sortBy === key && params.sortOrder === 'asc' ? 'desc' : 'asc';
    update({ sortBy: key, sortOrder: order }, false);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const goToPage = (page: number) => update({ page: page > 1 ? String(page) : undefined }, false);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Phòng ban</h1>
        {user?.role === 'ADMIN' && (
          <Link to="/departments/new" className="btn btn-primary">
            + Thêm phòng ban
          </Link>
        )}
      </div>

      <div className="card filters">
        <input
          type="search"
          placeholder="Tìm theo mã, tên phòng ban…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="Tìm kiếm"
        />
        <select value={params.parentId ?? ''} onChange={(e) => update({ parentId: e.target.value || undefined })} aria-label="Phòng ban cha">
          <option value="">Mọi phòng ban cha</option>
          {parents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={params.status ?? ''} onChange={(e) => update({ status: e.target.value || undefined })} aria-label="Trạng thái">
          <option value="">Đang hoạt động</option>
          <option value="DELETED">Đã xóa</option>
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
            {data?.items.map((d) => (
              <tr key={d.id} className="clickable" onClick={() => navigate(`/departments/${d.id}`)}>
                <td className="mono">{d.code}</td>
                <td>
                  <Link to={`/departments/${d.id}`} onClick={(ev) => ev.stopPropagation()}>
                    {d.name}
                  </Link>
                </td>
                <td>{d.parent?.name ?? <span className="muted">—</span>}</td>
                <td>{d.manager?.fullName ?? <span className="muted">—</span>}</td>
                <td>{d.employeeCount}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="empty">
                  Không có phòng ban nào phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="muted">
          {loading ? 'Đang tải…' : data ? `${data.total} phòng ban · Trang ${data.page}/${totalPages}` : ''}
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
