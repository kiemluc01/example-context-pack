import { authCookieOptions, requireJwtSecret } from './auth.constants';

describe('auth constants', () => {
  const original = { secret: process.env.JWT_SECRET, env: process.env.NODE_ENV };
  afterEach(() => {
    process.env.JWT_SECRET = original.secret;
    process.env.NODE_ENV = original.env;
  });

  it('requires a JWT secret of at least 32 characters', () => {
    delete process.env.JWT_SECRET;
    expect(() => requireJwtSecret()).toThrow('JWT_SECRET');
    process.env.JWT_SECRET = 'x'.repeat(31);
    expect(() => requireJwtSecret()).toThrow('JWT_SECRET');
    process.env.JWT_SECRET = 'x'.repeat(32);
    expect(requireJwtSecret()).toBe('x'.repeat(32));
  });

  it('marks the cookie secure only in production', () => {
    process.env.NODE_ENV = 'development';
    expect(authCookieOptions()).toEqual({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
    process.env.NODE_ENV = 'production';
    expect(authCookieOptions().secure).toBe(true);
  });
});
