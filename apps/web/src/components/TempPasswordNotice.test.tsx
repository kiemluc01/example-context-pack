import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TempPasswordNotice } from './TempPasswordNotice';

const TEMP = 'Ab3xYz789Kmn';

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(cleanup);

describe('TempPasswordNotice', () => {
  it('shows the password and copies it to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<TempPasswordNotice password={TEMP} onClose={() => undefined} />);

    expect(screen.getByText(TEMP)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }));

    expect(await screen.findByRole('button', { name: 'Đã sao chép' })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(TEMP);
  });

  it('keeps the copy label when the clipboard is unavailable', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    mockClipboard(writeText);
    render(<TempPasswordNotice password={TEMP} onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Sao chép' })).toBeTruthy();
  });

  it('closes on request', () => {
    const onClose = vi.fn();
    render(<TempPasswordNotice password={TEMP} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
