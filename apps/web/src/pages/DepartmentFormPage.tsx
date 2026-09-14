import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Department, DepartmentPayload, DepartmentRef } from '../types';

interface FormValues {
  code: string;
  name: string;
  parentId: string;
  managerId: string;
}

type ManagerOption = NonNullable<Department['manager']>;
type FormErrors = Partial<Record<keyof FormValues, string>>;

/** API limit for one page; enough for the manager picker of a typical department. */
const MEMBER_PAGE_SIZE = 100;

export function DepartmentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [values, setValues] = useState<FormValues>({ code: '', name: '', parentId: '', managerId: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [parents, setParents] = useState<DepartmentRef[]>([]);
  const [members, setMembers] = useState<ManagerOption[]>([]);

  useEffect(() => {
    api
      .departmentOptions()
      .then(setParents)
      .catch((err: Error) => setServerError(err.message));
  }, []);

  useEffect(() => {
    if (!id) return;
    // The manager must be an active employee of this department, so only its members are offered.
    Promise.all([api.getDepartment(id), api.listEmployees({ departmentId: id, sortBy: 'fullName', sortOrder: 'asc', pageSize: MEMBER_PAGE_SIZE })])
      .then(([department, page]) => {
        setValues({
          code: department.code,
          name: department.name,
          parentId: department.parent?.id ?? '',
          managerId: department.manager?.id ?? '',
        });
        const options = page.items.map(({ id: memberId, code, fullName }) => ({ id: memberId, code, fullName }));
        // Keep the current manager selectable even when they fall outside the loaded page.
        const { manager } = department;
        if (manager && !options.some((m) => m.id === manager.id)) options.unshift(manager);
        setMembers(options);
      })
      .catch((err: Error) => setServerError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key: keyof FormValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError('');
    const found: FormErrors = {};
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(values.code.trim())) found.code = 'Chỉ gồm chữ không dấu, số, "-" hoặc "_", tối đa 20 ký tự';
    if (!values.name.trim()) found.name = 'Vui lòng nhập tên phòng ban';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload: DepartmentPayload = { code: values.code.trim(), name: values.name.trim(), parentId: values.parentId || null };
    setSubmitting(true);
    try {
      const saved = id
        ? await api.updateDepartment(id, { ...payload, managerId: values.managerId || null })
        : await api.createDepartment(payload);
      navigate(`/departments/${saved.id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="muted">Đang tải…</div>;

  return (
    <form className="card stack" onSubmit={handleSubmit} noValidate>
      <div className="page-head">
        <h1>{isEdit ? 'Sửa phòng ban' : 'Thêm phòng ban'}</h1>
        <Link to={id ? `/departments/${id}` : '/departments'} className="btn btn-ghost">
          Hủy
        </Link>
      </div>

      {serverError && (
        <div className="alert alert-error pre-line" role="alert">
          {serverError}
        </div>
      )}

      <div className="form-grid">
        <label className={`field ${errors.code ? 'has-error' : ''}`}>
          <span>
            Mã phòng ban<em className="req"> *</em>
          </span>
          <input value={values.code} onChange={(e) => set('code', e.target.value)} placeholder="VD: KT" maxLength={20} />
          {errors.code && <small className="error-text">{errors.code}</small>}
        </label>
        <label className={`field ${errors.name ? 'has-error' : ''}`}>
          <span>
            Tên phòng ban<em className="req"> *</em>
          </span>
          <input value={values.name} onChange={(e) => set('name', e.target.value)} maxLength={100} />
          {errors.name && <small className="error-text">{errors.name}</small>}
        </label>
        <label className="field">
          <span>Phòng ban cha</span>
          <select value={values.parentId} onChange={(e) => set('parentId', e.target.value)}>
            <option value="">— Không có (cấp cao nhất) —</option>
            {parents
              .filter((d) => d.id !== id)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        {isEdit && (
          <label className="field">
            <span>Trưởng phòng</span>
            <select value={values.managerId} onChange={(e) => set('managerId', e.target.value)}>
              <option value="">— Chưa có —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.code})
                </option>
              ))}
            </select>
            {members.length === 0 && <small className="muted">Phòng ban chưa có nhân viên đang làm việc.</small>}
          </label>
        )}
      </div>

      <div className="row gap-sm">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Thêm phòng ban'}
        </button>
      </div>
    </form>
  );
}
