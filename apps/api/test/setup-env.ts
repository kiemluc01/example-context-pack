import os from 'node:os';
import path from 'node:path';
import { resolveTestDatabaseUrl } from './test-env';

process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'; // context-pack-registry:allow-secret
process.env.BCRYPT_ROUNDS = '4';
process.env.LOGIN_RATE_LIMIT = '1000';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'emp-api-test-uploads');
