import type { CookieOptions } from 'express';

export const AUTH_COOKIE = 'access_token';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET phải được đặt trong .env và dài ít nhất 32 ký tự');
  }
  return secret;
}

export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export const loginRateLimit = () => Number(process.env.LOGIN_RATE_LIMIT ?? 5);
