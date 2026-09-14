import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setUnauthorizedHandler } from './api';
import { AuthProvider, useAuth } from './auth';
import { makeUser } from './test/fixtures';

vi.mock('./api', () => ({ api: { me: vi.fn(), login: vi.fn(), logout: vi.fn() }, setUnauthorizedHandler: vi.fn() }));

let auth: ReturnType<typeof useAuth>;

function Probe() {
  auth = useAuth();
  return <div>{auth.loading ? 'loading' : (auth.user?.employee.fullName ?? 'anonymous')}</div>;
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('AuthProvider', () => {
  it('restores the session on load', async () => {
    vi.mocked(api.me).mockResolvedValue(makeUser('HR'));
    renderProvider();

    expect(screen.getByText('loading')).toBeTruthy();
    expect(await screen.findByText('Trần Thị Hà')).toBeTruthy();
  });

  it('treats a failed session check as signed out', async () => {
    vi.mocked(api.me).mockRejectedValue(new Error('401'));
    renderProvider();

    expect(await screen.findByText('anonymous')).toBeTruthy();
  });

  it('signs in, and signs out even when the logout request fails', async () => {
    vi.mocked(api.me).mockRejectedValue(new Error('401'));
    vi.mocked(api.login).mockResolvedValue(makeUser('ADMIN'));
    vi.mocked(api.logout).mockRejectedValue(new Error('network'));
    renderProvider();
    await screen.findByText('anonymous');

    await act(async () => {
      await expect(auth.login('a@b.vn', 'x')).resolves.toMatchObject({ role: 'ADMIN' });
    });
    expect(screen.getByText('Trần Thị Hà')).toBeTruthy();
    expect(api.login).toHaveBeenCalledWith('a@b.vn', 'x');

    await act(() => auth.logout());
    expect(screen.getByText('anonymous')).toBeTruthy();
  });

  it('clears the user when the API reports an expired session', async () => {
    vi.mocked(api.me).mockResolvedValue(makeUser('HR'));
    const { unmount } = renderProvider();
    await screen.findByText('Trần Thị Hà');

    const handler = vi.mocked(setUnauthorizedHandler).mock.calls[0][0]!;
    act(() => handler());
    expect(screen.getByText('anonymous')).toBeTruthy();

    unmount();
    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
  });

  it('requires the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside <AuthProvider>');
  });
});
