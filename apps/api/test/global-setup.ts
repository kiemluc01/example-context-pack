import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { assertUtf8Ctype } from '../src/prisma/locale';
import { API_ROOT, resolveTestDatabaseUrl } from './test-env';

/** Applies pending migrations to the test database (non-destructive) and checks its locale. */
export default async function globalSetup(): Promise<void> {
  const url = resolveTestDatabaseUrl();
  execSync('npx prisma migrate deploy', { cwd: API_ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const problem = await assertUtf8Ctype(prisma);
    if (problem) throw new Error(problem);
  } finally {
    await prisma.$disconnect();
  }
}
