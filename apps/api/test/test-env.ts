import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const API_ROOT = path.resolve(__dirname, '..');

/** TEST_DATABASE_URL, or DATABASE_URL from .env with "_test" appended to the database name. */
export function resolveTestDatabaseUrl(): string {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const envFile = path.join(API_ROOT, '.env');
    const devUrl = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')).DATABASE_URL : undefined;
    if (!devUrl) throw new Error('Đặt TEST_DATABASE_URL hoặc tạo apps/api/.env có DATABASE_URL');
    const parsed = new URL(devUrl);
    parsed.pathname = `${parsed.pathname}_test`;
    url = parsed.toString();
  }
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Database dùng cho test phải có tên kết thúc bằng "_test" (đang là "${dbName}")`);
  }
  return url;
}
