import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { formatDate } from '../labels';
import type { Department } from '../types';

export function DepartmentDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getDepartment(id)
      .then(setDepartment)
      .catch((err: Error) => setError(err.message));
  }, [id]);
  useEffect(load, [load]);

  if (!user) return null;
  if (!department) return error ? <div className="alert alert-error">{error}</div> : <div className="muted">Đang tải…</div>;

  const deleted = Boolean(department.deletedAt);
  const isAdmin = user.role === 'ADMIN';

  const run = async (action: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    const ok = window.confirm(
      `Xóa phòng ban "${department.name}"?\n\nPhòng ban sẽ bị ẩn khỏi danh sách và không thể chọn cho nhân viên. Bạn có thể khôi phục sau.`,
    );
    if (ok) void run(async () => {
      await api.deleteDepartment(department.id);
      load();
    });
  };

  const rows: Array<[string, ReactNode]> = [
    ['Mã phòng ban', department.code],
    ['Phòng ban cha', department.parent ? <Link to={`/departments/${department.parent.id}`}>{department.parent.name}</Link> : '—'],
    [
      'Trưởng phòng',
      department.manager ? (
        <Link to={`/employees/${department.manager.id}`}>
          {department.manager.fullName} ({department.manager.code})
        </Link>
      ) : (
        '—'
      ),
    ],
    ['Nhân viên đang làm việc', String(department.employeeCount)],
  ];

  return (
    <div className="stack">
      <div className="page-head">
        <Link to="/departments" className="btn btn-ghost">
          ‹ Danh sách
        </Link>
        {isAdmin && (
          <div className="row gap-sm">
            {deleted ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(async () => setDepartment(await api.restoreDepartment(department.id)))}>
                Khôi phục
              </button>
            ) : (
              <>
                <Link to={`/departments/${department.id}/edit`} className="btn btn-secondary">
                  Sửa
                </Link>
                <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={busy}>
                  Xóa
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error pre-line" role="alert">
          {error}
        </div>
      )}
      {deleted && <div className="alert alert-warning">Phòng ban đã bị xóa từ {formatDate(department.deletedAt)}.</div>}

      <div className="card stack">
        <h1>{department.name}</h1>
        <dl className="info-grid">
          {rows.map(([label, value]) => (
            <div key={label} className="info-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="row gap-sm wrap">
          <Link to={`/employees?departmentId=${department.id}`} className="btn btn-secondary">
            Xem nhân viên
          </Link>
          <Link to={`/departments?parentId=${department.id}`} className="btn btn-secondary">
            Xem phòng ban con
          </Link>
        </div>
      </div>
    </div>
  );
}
