import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, errorMessage, setUnauthorizedHandler, toQueryString } from './api';

const jsonResponse = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('errorMessage', () => {
  it('joins validation message lists and falls back when there is no message', () => {
    expect(errorMessage({ message: ['a', 'b'] }, 'x')).toBe('a\nb');
    expect(errorMessage({ message: 'lỗi' }, 'x')).toBe('lỗi');
    expect(errorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('toQueryString', () => {
  it('skips empty values', () => {
    expect(toQueryString({ q: 'an', departmentId: '', page: 2, status: undefined })).toBe('?q=an&page=2');
    expect(toQueryString({})).toBe('');
  });
});

describe('request', () => {
  it('sends JSON with same-origin credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'u' }));
    vi.stubGlobal('fetch', fetchMock);

    await api.login('a@b.vn', 'Matkhau123');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.vn', password: 'Matkhau123' }), // context-pack-registry:allow-secret
    });
  });

  it('throws ApiError with the server message and code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { message: 'Cần đổi mật khẩu', code: 'PASSWORD_CHANGE_REQUIRED' })));

    const err = await api.myProfile().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, message: 'Cần đổi mật khẩu', code: 'PASSWORD_CHANGE_REQUIRED' });
  });

  it('notifies the unauthorized handler on 401, except for the login call itself', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Hết hạn' })));

    await expect(api.me()).rejects.toThrow('Hết hạn');
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(api.login('a@b.vn', 'x')).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for 204 and reports network failures in Vietnamese', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api.deleteEmployee('1')).resolves.toBeUndefined();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.me()).rejects.toMatchObject({ status: 0, message: 'Không kết nối được máy chủ. Vui lòng thử lại.' });
  });

  it('calls the department endpoints with query strings and JSON bodies', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    vi.stubGlobal('fetch', fetchMock);

    await api.listDepartments({ q: 'kinh', status: undefined, page: 2 });
    await api.updateDepartment('d1', { managerId: null });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/departments?q=kinh&page=2');
    expect(fetchMock.mock.calls[1]).toEqual([
      '/api/departments/d1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ managerId: null }) }),
    ]);
  });

  it('explains a 413 upload without a JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('too big', { status: 413 })));
    await expect(api.uploadAvatar('1', new File(['x'], 'a.png'))).rejects.toThrow('Ảnh vượt quá dung lượng 2 MB');
  });
});
