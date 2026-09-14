import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { EmployeeFormValues, FormErrors, emptyForm, fromDetail, toPayload, validateForm } from '../employeeForm';
import { EDITABLE_STATUSES, GENDER_LABEL, ROLE_LABEL, STATUS_LABEL, grantableRoles } from '../labels';
import type { Gender, Role } from '../types';

export function EmployeeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<EmployeeFormValues>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [accountRole, setAccountRole] = useState<Role>('EMPLOYEE');

  useEffect(() => {
    if (!id) return;
    api
      .getEmployee(id)
      .then((e) => setValues(fromDetail(e)))
      .catch((err: Error) => setServerError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError('');
    const found = validateForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      if (id) {
        await api.updateEmployee(id, toPayload(values));
        navigate(`/employees/${id}`);
      } else {
        const res = await api.createEmployee({ ...toPayload(values), createAccount, accountRole: createAccount ? accountRole : undefined });
        navigate(`/employees/${res.employee.id}`, { state: { tempPassword: res.tempPassword } });
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="muted">Đang tải…</div>;
  const roles = user ? grantableRoles(user) : [];

  const field = (key: keyof EmployeeFormValues, label: string, input: ReactNode, required = false) => (
    <label className={`field ${errors[key] ? 'has-error' : ''}`}>
      <span>
        {label}
        {required && <em className="req"> *</em>}
      </span>
      {input}
      {errors[key] && <small className="error-text">{errors[key]}</small>}
    </label>
  );
  const text = (key: keyof EmployeeFormValues, props: Record<string, unknown> = {}) => (
    <input value={values[key]} onChange={(e) => set(key, e.target.value as never)} {...props} />
  );

  return (
    <form className="card stack" onSubmit={handleSubmit} noValidate>
      <div className="page-head">
        <h1>{isEdit ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên'}</h1>
        <Link to={id ? `/employees/${id}` : '/employees'} className="btn btn-ghost">
          Hủy
        </Link>
      </div>

      {serverError && (
        <div className="alert alert-error pre-line" role="alert">
          {serverError}
        </div>
      )}

      <div className="form-grid">
        {field('code', 'Mã nhân viên', text('code', { placeholder: 'VD: NV0001', maxLength: 20 }), true)}
        {field('fullName', 'Họ và tên', text('fullName', { maxLength: 100 }), true)}
        {field('email', 'Email', text('email', { type: 'email', maxLength: 254 }), true)}
        {field('phone', 'Số điện thoại', text('phone', { placeholder: '0912345678' }))}
        {field('dateOfBirth', 'Ngày sinh', text('dateOfBirth', { type: 'date' }))}
        {field(
          'gender',
          'Giới tính',
          <select value={values.gender} onChange={(e) => set('gender', e.target.value as Gender | '')}>
            <option value="">— Chưa chọn —</option>
            {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
              <option key={g} value={g}>
                {GENDER_LABEL[g]}
              </option>
            ))}
          </select>,
        )}
        {field('department', 'Phòng ban', text('department', { maxLength: 100 }), true)}
        {field('position', 'Chức vụ', text('position', { maxLength: 100 }), true)}
        {field('hireDate', 'Ngày vào làm', text('hireDate', { type: 'date' }), true)}
        {field(
          'status',
          'Trạng thái',
          <select value={values.status} onChange={(e) => set('status', e.target.value as EmployeeFormValues['status'])}>
            {EDITABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>,
          true,
        )}
        {field('salary', 'Lương (VNĐ/tháng)', text('salary', { inputMode: 'numeric', placeholder: '15000000' }))}
        {field('nationalId', 'Số CCCD', text('nationalId', { inputMode: 'numeric', maxLength: 12 }))}
      </div>

      {!isEdit && (
        <fieldset className="account-box">
          <label className="checkbox">
            <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />
            Tạo tài khoản đăng nhập (đăng nhập bằng email, mật khẩu tạm thời được tạo tự động)
          </label>
          {createAccount && roles.length > 1 && (
            <label className="field inline">
              <span>Vai trò</span>
              <select value={accountRole} onChange={(e) => setAccountRole(e.target.value as Role)}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
      )}

      <div className="row gap-sm">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Thêm nhân viên'}
        </button>
      </div>
    </form>
  );
}
