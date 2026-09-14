import type {
  EmployeeDetail,
  EmployeeListItem,
  EmployeePayload,
  ListParams,
  Page,
  Role,
  SessionUser,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Nest returns `message` as a string or, for validation errors, a list of strings. */
export function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const { message } = body as { message: unknown };
    if (Array.isArray(message)) return message.join('\n');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export function toQueryString(params: ListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: string;
  json?: unknown;
  body?: BodyInit;
}

async function request<T>(path: string, { method = 'GET', json, body }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: json !== undefined ? JSON.stringify(json) : body,
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Vui lòng thử lại.');
  }
  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized?.();
    const code = data && typeof data === 'object' && 'code' in data ? String((data as { code: unknown }).code) : undefined;
    const fallback = res.status === 413 ? 'Ảnh vượt quá dung lượng 2 MB' : `Lỗi máy chủ (${res.status})`;
    throw new ApiError(res.status, errorMessage(data, fallback), code);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) => request<SessionUser>('/auth/login', { method: 'POST', json: { email, password } }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<SessionUser>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<SessionUser>('/auth/change-password', { method: 'POST', json: { currentPassword, newPassword } }),

  listEmployees: (params: ListParams) => request<Page<EmployeeListItem>>(`/employees${toQueryString(params)}`),
  filterOptions: () => request<{ departments: string[]; positions: string[] }>('/employees/filter-options'),
  myProfile: () => request<EmployeeDetail>('/employees/me'),
  getEmployee: (id: string) => request<EmployeeDetail>(`/employees/${id}`),
  createEmployee: (payload: EmployeePayload & { createAccount?: boolean; accountRole?: Role }) =>
    request<{ employee: EmployeeDetail; tempPassword: string | null }>('/employees', { method: 'POST', json: payload }),
  updateEmployee: (id: string, payload: Partial<EmployeePayload>) =>
    request<EmployeeDetail>(`/employees/${id}`, { method: 'PATCH', json: payload }),
  deleteEmployee: (id: string) => request<void>(`/employees/${id}`, { method: 'DELETE' }),
  restoreEmployee: (id: string) => request<EmployeeDetail>(`/employees/${id}/restore`, { method: 'POST' }),

  createAccount: (id: string, role: Role) =>
    request<{ employee: EmployeeDetail; tempPassword: string }>(`/employees/${id}/account`, { method: 'POST', json: { role } }),
  resetPassword: (id: string) => request<{ tempPassword: string }>(`/employees/${id}/account/reset-password`, { method: 'POST' }),
  changeRole: (id: string, role: Role) => request<EmployeeDetail>(`/employees/${id}/account`, { method: 'PATCH', json: { role } }),

  uploadAvatar: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<EmployeeDetail>(`/employees/${id}/avatar`, { method: 'PUT', body: form });
  },
  avatarUrl: (employee: Pick<EmployeeDetail, 'id' | 'updatedAt'>) =>
    `/api/employees/${employee.id}/avatar?v=${encodeURIComponent(employee.updatedAt)}`,
};
