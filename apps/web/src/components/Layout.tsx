import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ROLE_LABEL } from '../labels';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Quản lý nhân viên</div>
        {!user.mustChangePassword && (
          <nav className="nav">
            {user.role !== 'EMPLOYEE' && (
              <>
                <NavLink to="/employees">Nhân viên</NavLink>
                <NavLink to="/departments">Phòng ban</NavLink>
              </>
            )}
            <NavLink to="/me">Hồ sơ của tôi</NavLink>
            <NavLink to="/change-password">Đổi mật khẩu</NavLink>
          </nav>
        )}
        <div className="user-box">
          <span className="user-name">{user.employee.fullName}</span>
          <span className={`badge role-${user.role.toLowerCase()}`}>{ROLE_LABEL[user.role]}</span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
