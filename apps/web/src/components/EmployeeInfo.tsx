import { api } from '../api';
import { GENDER_LABEL, STATUS_LABEL, formatDate, formatMoney, initials } from '../labels';
import type { EmployeeDetail } from '../types';

export function Avatar({ employee, size = 96 }: { employee: EmployeeDetail; size?: number }) {
  return employee.hasAvatar ? (
    <img className="avatar" src={api.avatarUrl(employee)} alt={employee.fullName} width={size} height={size} />
  ) : (
    <div className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size / 2.6 }} aria-hidden>
      {initials(employee.fullName)}
    </div>
  );
}

export function StatusBadge({ status }: { status: EmployeeDetail['status'] }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

/** Read-only profile fields, shared by the detail page and "Hồ sơ của tôi". */
export function EmployeeInfo({ employee }: { employee: EmployeeDetail }) {
  const rows: Array<[string, string]> = [
    ['Mã nhân viên', employee.code],
    ['Email', employee.email],
    ['Số điện thoại', employee.phone ?? '—'],
    ['Ngày sinh', formatDate(employee.dateOfBirth)],
    ['Giới tính', employee.gender ? GENDER_LABEL[employee.gender] : '—'],
    ['Phòng ban', employee.department.name],
    ['Chức vụ', employee.position],
    ['Ngày vào làm', formatDate(employee.hireDate)],
    ['Lương', formatMoney(employee.salary)],
    ['Số CCCD', employee.nationalId ?? '—'],
  ];
  return (
    <dl className="info-grid">
      {rows.map(([label, value]) => (
        <div key={label} className="info-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
