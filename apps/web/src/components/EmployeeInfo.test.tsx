import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatMoney } from '../labels';
import { makeEmployee } from '../test/fixtures';
import { Avatar, EmployeeInfo, StatusBadge } from './EmployeeInfo';

const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

afterEach(cleanup);

describe('EmployeeInfo', () => {
  it('shows formatted profile fields', () => {
    render(<EmployeeInfo employee={makeEmployee()} />);

    expect(valueOf('Mã nhân viên')).toBe('NV0001');
    expect(valueOf('Ngày sinh')).toBe('20/05/1990');
    expect(valueOf('Giới tính')).toBe('Nam');
    expect(valueOf('Ngày vào làm')).toBe('15/01/2024');
    expect(valueOf('Lương')).toBe(formatMoney(15000000));
    expect(valueOf('Số CCCD')).toBe('012345678901');
  });

  it('shows a dash for empty optional fields', () => {
    render(<EmployeeInfo employee={makeEmployee({ phone: null, dateOfBirth: null, gender: null, salary: null, nationalId: null })} />);

    for (const label of ['Số điện thoại', 'Ngày sinh', 'Giới tính', 'Lương', 'Số CCCD']) {
      expect(valueOf(label)).toBe('—');
    }
  });
});

describe('Avatar', () => {
  it('renders the uploaded image with a cache-busting URL', () => {
    render(<Avatar employee={makeEmployee({ hasAvatar: true })} />);
    const img = screen.getByRole('img', { name: 'Nguyễn Văn An' });
    expect(img.getAttribute('src')).toBe('/api/employees/e1/avatar?v=2024-02-01T08%3A00%3A00.000Z');
  });

  it('falls back to initials without an image', () => {
    const { container } = render(<Avatar employee={makeEmployee()} size={40} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).toBe('VA');
  });
});

describe('StatusBadge', () => {
  it('shows the Vietnamese label with a status class', () => {
    render(<StatusBadge status="ON_LEAVE" />);
    const badge = screen.getByText('Nghỉ phép dài hạn');
    expect(badge.className).toContain('status-on_leave');
  });
});
