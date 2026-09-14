import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { hashPassword } from '../src/auth/password';
import { PrismaService } from '../src/prisma/prisma.service';

// Fake credentials for throwaway test accounts.
export const PASSWORD = 'Matkhau123'; // context-pack-registry:allow-secret
export const WRONG_PASSWORD = 'Sai123456'; // context-pack-registry:allow-secret
export const NEW_PASSWORD = 'MatKhauMoi456'; // context-pack-registry:allow-secret
export type Agent = ReturnType<typeof request.agent>;

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  if (!process.env.DATABASE_URL?.split('?')[0].endsWith('_test')) {
    throw new Error('Refusing to truncate a database whose name does not end with _test');
  }
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users, employees CASCADE');
}

let seq = 0;

export function employeeData(overrides: Partial<Prisma.EmployeeCreateInput> = {}): Prisma.EmployeeCreateInput {
  seq += 1;
  const n = String(seq).padStart(4, '0');
  return {
    code: `T${n}`,
    fullName: `Nhân viên ${n}`,
    email: `nv${n}@test.vn`,
    department: 'Kỹ thuật',
    position: 'Lập trình viên',
    hireDate: new Date('2024-01-15T00:00:00.000Z'),
    ...overrides,
  };
}

export async function createEmployeeWithAccount(
  prisma: PrismaService,
  role: Role,
  options: { mustChangePassword?: boolean; employee?: Partial<Prisma.EmployeeCreateInput> } = {},
) {
  return prisma.employee.create({
    data: {
      ...employeeData(options.employee),
      user: {
        create: { role, passwordHash: await hashPassword(PASSWORD), mustChangePassword: options.mustChangePassword ?? false },
      },
    },
    include: { user: true },
  });
}

export async function login(app: INestApplication, email: string, password = PASSWORD): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}

/** Minimal buffers carrying real magic bytes. */
export const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
export const JPG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
