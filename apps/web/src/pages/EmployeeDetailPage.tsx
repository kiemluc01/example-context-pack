import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, EmployeeInfo, StatusBadge } from '../components/EmployeeInfo';
import { TempPasswordNotice } from '../components/TempPasswordNotice';
import { ROLE_LABEL, canManage, formatDate, grantableRoles } from '../labels';
import type { EmployeeDetail, Role } from '../types';

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(
    (location.state as { tempPassword?: string | null } | null)?.tempPassword ?? null,
  );
  const [newAccountRole, setNewAccountRole] = useState<Role>('EMPLOYEE');

  useEffect(() => {
    // Drop the one-time password from history so it does not reappear on back/refresh.
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const load = useCallback(() => {
    api
      .getEmployee(id)
      .then(setEmployee)
      .catch((err: Error) => setError(err.message));
  }, [id]);
  useEffect(load, [load]);

  if (!user) return null;
  if (!employee) return error ? <div className="alert alert-error">{error}</div> : <div className="muted">Đang tải…</div>;

  const deleted = Boolean(employee.deletedAt);
  const manageable = canManage(user, employee);
  const isSelf = employee.id === user.employee.id;

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
      `Xóa nhân viên "${employee.fullName}"?\n\nNhân viên sẽ chuyển sang trạng thái "Đã nghỉ việc", bị ẩn khỏi danh sách và tài khoản đăng nhập bị khóa. Bạn có thể khôi phục sau.`,
    );
    if (ok) void run(async () => {
      await api.deleteEmployee(employee.id);
      load();
    });
  };

  const handleAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError('Ảnh vượt quá dung lượng 2 MB');
    void run(async () => setEmployee(await api.uploadAvatar(employee.id, file)));
  };

  const handleResetPassword = () => {
    if (!window.confirm(`Đặt lại mật khẩu cho ${employee.fullName}? Mật khẩu cũ và các phiên đăng nhập hiện tại sẽ mất hiệu lực.`)) return;
    void run(async () => setTempPassword((await api.resetPassword(employee.id)).tempPassword));
  };

  return (
    <div className="stack">
      <div className="page-head">
        <Link to="/employees" className="btn btn-ghost">
          ‹ Danh sách
        </Link>
        <div className="row gap-sm">
          {!deleted && manageable && (
            <>
              <Link to={`/employees/${employee.id}/edit`} className="btn btn-secondary">
                Sửa
              </Link>
              {!isSelf && (
                <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={busy}>
                  Xóa
                </button>
              )}
            </>
          )}
          {deleted && manageable && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(async () => setEmployee(await api.restoreEmployee(employee.id)))}>
              Khôi phục
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error pre-line" role="alert">
          {error}
        </div>
      )}
      {tempPassword && <TempPasswordNotice password={tempPassword} onClose={() => setTempPassword(null)} />}
      {deleted && (
        <div className="alert alert-warning">
          Nhân viên đã nghỉ việc từ {formatDate(employee.deletedAt)}. Tài khoản đăng nhập (nếu có) đang bị khóa.
        </div>
      )}
      {!manageable && <div className="alert alert-info">Hồ sơ có tài khoản HR/Admin chỉ Admin được chỉnh sửa.</div>}

      <div className="card">
        <div className="profile-head">
          <div className="avatar-col">
            <Avatar employee={employee} />
            {!deleted && manageable && (
              <>
                <button type="button" className="btn btn-ghost small" onClick={() => fileInput.current?.click()} disabled={busy}>
                  Đổi ảnh
                </button>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleAvatar} />
              </>
            )}
          </div>
          <div>
            <h1>{employee.fullName}</h1>
            <p className="muted">
              {employee.position} · {employee.department}
            </p>
            <StatusBadge status={employee.status} />
          </div>
        </div>
        <EmployeeInfo employee={employee} />
      </div>

      <div className="card stack">
        <h2>Tài khoản đăng nhập</h2>
        {employee.account ? (
          <>
            <p>
              Vai trò: <span className={`badge role-${employee.account.role.toLowerCase()}`}>{ROLE_LABEL[employee.account.role]}</span>
              {employee.account.mustChangePassword && <span className="muted small"> · chưa đổi mật khẩu tạm</span>}
            </p>
            {!deleted && (
              <div className="row gap-sm wrap">
                {manageable && !isSelf && (
                  <button type="button" className="btn btn-secondary" onClick={handleResetPassword} disabled={busy}>
                    Đặt lại mật khẩu
                  </button>
                )}
                {user.role === 'ADMIN' && !isSelf && (
                  <label className="field inline">
                    <span>Đổi vai trò</span>
                    <select
                      value={employee.account.role}
                      disabled={busy}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        if (window.confirm(`Đổi vai trò của ${employee.fullName} thành ${ROLE_LABEL[role]}?`)) {
                          void run(async () => setEmployee(await api.changeRole(employee.id, role)));
                        }
                      }}
                    >
                      {(['EMPLOYEE', 'HR', 'ADMIN'] as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="muted">Nhân viên chưa có tài khoản đăng nhập.</p>
            {!deleted && (
              <div className="row gap-sm wrap">
                {grantableRoles(user).length > 1 && (
                  <select value={newAccountRole} onChange={(e) => setNewAccountRole(e.target.value as Role)} aria-label="Vai trò">
                    {grantableRoles(user).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const res = await api.createAccount(employee.id, newAccountRole);
                      setEmployee(res.employee);
                      setTempPassword(res.tempPassword);
                    })
                  }
                >
                  Tạo tài khoản
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
