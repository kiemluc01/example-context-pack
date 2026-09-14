import { useEffect, useState } from 'react';
import { api } from '../api';
import { Avatar, EmployeeInfo, StatusBadge } from '../components/EmployeeInfo';
import type { EmployeeDetail } from '../types';

export function MyProfilePage() {
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .myProfile()
      .then(setEmployee)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!employee) return <div className="muted">Đang tải…</div>;

  return (
    <div className="card">
      <div className="profile-head">
        <Avatar employee={employee} />
        <div>
          <h1>{employee.fullName}</h1>
          <p className="muted">
            {employee.position} · {employee.department.name}
          </p>
          <StatusBadge status={employee.status} />
        </div>
      </div>
      <EmployeeInfo employee={employee} />
      <p className="muted small">Cần cập nhật thông tin? Vui lòng liên hệ phòng Nhân sự.</p>
    </div>
  );
}
