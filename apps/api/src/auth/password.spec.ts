import { PASSWORD_RULE, generateTempPassword, hashPassword, verifyPassword } from './password';

describe('password helpers', () => {
  it('hashes with bcrypt and verifies only the original password', async () => {
    const hash = await hashPassword('Matkhau123');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toContain('Matkhau123');
    await expect(verifyPassword('Matkhau123', hash)).resolves.toBe(true);
    await expect(verifyPassword('matkhau123', hash)).resolves.toBe(false);
  });

  it('generates distinct temporary passwords that satisfy the password rule without look-alike characters', () => {
    const samples = Array.from({ length: 200 }, () => generateTempPassword());
    for (const p of samples) {
      expect(p).toHaveLength(12);
      expect(p).toMatch(PASSWORD_RULE);
      expect(p).not.toMatch(/[iloIO01]/);
    }
    expect(new Set(samples).size).toBe(samples.length);
  });

  it.each([
    ['Matkhau123', true],
    ['Mậtkhẩu12', true],
    ['abc12345', true],
    ['abc1234', false],
    ['abcdefgh', false],
    ['12345678', false],
    [`a${'1'.repeat(71)}`, true],
    [`a${'1'.repeat(72)}`, false],
  ])('PASSWORD_RULE(%s) -> %s', (value, expected) => {
    expect(PASSWORD_RULE.test(value)).toBe(expected);
  });
});
