import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { PASSWORD_RULE_MESSAGE } from './password';

const CURRENT = 'Matkhau123';
const STRONG = 'MatKhauMoi456';

async function check<T extends object>(cls: ClassConstructor<T>, plain: Record<string, unknown>) {
  const dto = plainToInstance(cls, plain);
  const errors = await validate(dto);
  return { dto, messages: errors.flatMap((e) => Object.values(e.constraints ?? {})) };
}

describe('LoginDto', () => {
  it('normalises the email', async () => {
    const { dto, messages } = await check(LoginDto, { email: '  HR@CongTy.VN ', password: CURRENT });
    expect(messages).toEqual([]);
    expect(dto.email).toBe('hr@congty.vn');
  });

  it('rejects an invalid email and an empty password', async () => {
    const { messages } = await check(LoginDto, { email: 'khong-phai-email', password: '' });
    expect(messages).toEqual(expect.arrayContaining(['Email không hợp lệ', 'Vui lòng nhập mật khẩu']));
  });
});

describe('ChangePasswordDto', () => {
  it('accepts a strong new password', async () => {
    const { messages } = await check(ChangePasswordDto, { currentPassword: CURRENT, newPassword: STRONG });
    expect(messages).toEqual([]);
  });

  it.each(['short1', 'chicochuthoi', '1234567890', 'a1'.repeat(40)])('rejects the weak new password %p', async (weak) => {
    const { messages } = await check(ChangePasswordDto, { currentPassword: CURRENT, newPassword: weak });
    expect(messages).toEqual([PASSWORD_RULE_MESSAGE]);
  });

  it('requires the current password', async () => {
    const { messages } = await check(ChangePasswordDto, { currentPassword: '', newPassword: STRONG });
    expect(messages).toEqual(['Vui lòng nhập mật khẩu hiện tại']);
  });
});
