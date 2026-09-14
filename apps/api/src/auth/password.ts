import { compare, hash } from 'bcryptjs';
import { randomInt } from 'node:crypto';

/** 8-72 characters (bcrypt limit) with at least one letter and one digit. */
export const PASSWORD_RULE = /^(?=.*\p{L})(?=.*\d).{8,72}$/u;
export const PASSWORD_RULE_MESSAGE = 'Mật khẩu phải từ 8–72 ký tự, gồm cả chữ và số';

const LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

export function hashPassword(password: string): Promise<string> {
  return hash(password, Number(process.env.BCRYPT_ROUNDS ?? 10));
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

/** Random temporary password without look-alike characters; always satisfies PASSWORD_RULE. */
export function generateTempPassword(length = 12): string {
  const alphabet = LETTERS + DIGITS;
  const chars = [LETTERS[randomInt(LETTERS.length)], DIGITS[randomInt(DIGITS.length)]];
  while (chars.length < length) chars.push(alphabet[randomInt(alphabet.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
