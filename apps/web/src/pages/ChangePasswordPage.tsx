import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { homePath } from '../labels';

const PASSWORD_RULE = /^(?=.*\p{L})(?=.*\d).{8,72}$/u;

export function ChangePasswordPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setDone(false);
    if (!PASSWORD_RULE.test(newPassword)) return setError('Mật khẩu mới phải từ 8–72 ký tự, gồm cả chữ và số');
    if (newPassword !== confirm) return setError('Mật khẩu nhập lại không khớp');

    setSubmitting(true);
    try {
      const wasForced = user?.mustChangePassword;
      const updated = await api.changePassword(currentPassword, newPassword);
      setUser(updated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      if (wasForced) navigate(homePath(updated), { replace: true });
      else setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card narrow" onSubmit={handleSubmit} noValidate>
      <h1>Đổi mật khẩu</h1>
      {user?.mustChangePassword && (
        <div className="alert alert-warning">Bạn đang dùng mật khẩu tạm thời. Vui lòng đặt mật khẩu mới để tiếp tục.</div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {done && <div className="alert alert-success">Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.</div>}
      <label className="field">
        <span>Mật khẩu hiện tại</span>
        <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </label>
      <label className="field">
        <span>Mật khẩu mới</span>
        <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <small className="muted">Từ 8–72 ký tự, gồm cả chữ và số.</small>
      </label>
      <label className="field">
        <span>Nhập lại mật khẩu mới</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={submitting || !currentPassword || !newPassword || !confirm}>
        {submitting ? 'Đang lưu…' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
}
