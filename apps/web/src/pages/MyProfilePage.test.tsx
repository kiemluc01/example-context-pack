import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { makeEmployee } from '../test/fixtures';
import { MyProfilePage } from './MyProfilePage';

vi.mock('../api', () => ({ api: { myProfile: vi.fn(), avatarUrl: () => '/avatar' } }));

afterEach(() => {
  cleanup();
  vi.mocked(api.myProfile).mockReset();
});

describe('MyProfilePage', () => {
  it('loads and shows the signed-in employee profile', async () => {
    vi.mocked(api.myProfile).mockResolvedValue(makeEmployee());
    render(<MyProfilePage />);

    expect(screen.getByText('Đang tải…')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn An' })).toBeTruthy();
    expect(screen.getByText('Lập trình viên · Kỹ thuật')).toBeTruthy();
    expect(screen.getByText('Đang làm việc')).toBeTruthy();
  });

  it('shows the server error', async () => {
    vi.mocked(api.myProfile).mockRejectedValue(new Error('Không tìm thấy nhân viên'));
    render(<MyProfilePage />);

    expect(await screen.findByText('Không tìm thấy nhân viên')).toBeTruthy();
  });
});
