import type { EditableStatus, EmployeeDetail, EmployeePayload, Gender } from './types';

export interface EmployeeFormValues {
  code: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender | '';
  department: string;
  position: string;
  hireDate: string;
  status: EditableStatus;
  salary: string;
  nationalId: string;
}

export type FormErrors = Partial<Record<keyof EmployeeFormValues, string>>;

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export function emptyForm(): EmployeeFormValues {
  return {
    code: '',
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    department: '',
    position: '',
    hireDate: todayIso(),
    status: 'ACTIVE',
    salary: '',
    nationalId: '',
  };
}

export function fromDetail(e: EmployeeDetail): EmployeeFormValues {
  return {
    code: e.code,
    fullName: e.fullName,
    email: e.email,
    phone: e.phone ?? '',
    dateOfBirth: e.dateOfBirth ?? '',
    gender: e.gender ?? '',
    department: e.department,
    position: e.position,
    hireDate: e.hireDate,
    status: e.status === 'RESIGNED' ? 'ACTIVE' : e.status,
    salary: e.salary === null ? '' : String(e.salary),
    nationalId: e.nationalId ?? '',
  };
}

const digitsOnly = (s: string) => s.replace(/[.,\s]/g, '');
const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** Quick client-side checks for instant feedback; the API remains the source of truth. */
export function validateForm(v: EmployeeFormValues): FormErrors {
  const errors: FormErrors = {};
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(v.code.trim())) errors.code = 'Chỉ gồm chữ không dấu, số, "-" hoặc "_", tối đa 20 ký tự';
  if (!v.fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên';
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) errors.email = 'Email không hợp lệ';
  if (v.phone.trim() && !/^(\+84|0)\d{9,10}$/.test(v.phone.replace(/[\s.]/g, ''))) errors.phone = 'Số điện thoại không hợp lệ';
  if (!v.department.trim()) errors.department = 'Vui lòng nhập phòng ban';
  if (!v.position.trim()) errors.position = 'Vui lòng nhập chức vụ';
  if (!v.hireDate) errors.hireDate = 'Vui lòng chọn ngày vào làm';
  if (v.dateOfBirth && v.dateOfBirth >= todayIso()) errors.dateOfBirth = 'Ngày sinh phải trước hôm nay';
  if (v.salary.trim() && !/^\d+$/.test(digitsOnly(v.salary))) errors.salary = 'Lương phải là số nguyên không âm';
  if (v.nationalId.trim() && !/^\d{12}$/.test(v.nationalId.trim())) errors.nationalId = 'CCCD gồm đúng 12 chữ số';
  return errors;
}

export function toPayload(v: EmployeeFormValues): EmployeePayload {
  const salary = digitsOnly(v.salary);
  return {
    code: v.code.trim(),
    fullName: v.fullName.trim(),
    email: v.email.trim(),
    phone: blankToNull(v.phone),
    dateOfBirth: blankToNull(v.dateOfBirth),
    gender: v.gender === '' ? null : v.gender,
    department: v.department.trim(),
    position: v.position.trim(),
    hireDate: v.hireDate,
    status: v.status,
    salary: salary === '' ? null : Number(salary),
    nationalId: blankToNull(v.nationalId),
  };
}
