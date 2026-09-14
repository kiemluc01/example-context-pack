import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { homePath } from './labels';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage';
import { EmployeeFormPage } from './pages/EmployeeFormPage';
import { EmployeeListPage } from './pages/EmployeeListPage';
import { LoginPage } from './pages/LoginPage';
import { MyProfilePage } from './pages/MyProfilePage';
import type { Role } from './types';

function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-center muted">Đang tải…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePath(user)} replace />;
  return <Outlet />;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homePath(user) : '/login'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/me" element={<MyProfilePage />} />
          <Route element={<RequireAuth roles={['ADMIN', 'HR']} />}>
            <Route path="/employees" element={<EmployeeListPage />} />
            <Route path="/employees/new" element={<EmployeeFormPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
          </Route>
          <Route path="*" element={<div className="card">Không tìm thấy trang.</div>} />
        </Route>
      </Route>
    </Routes>
  );
}
