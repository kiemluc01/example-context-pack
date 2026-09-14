import { EmployeeStatus, Gender, PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const prisma = new PrismaClient();
const PASSWORD_RULE = /^(?=.*\p{L})(?=.*\d).{8,72}$/u;

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Thiếu ADMIN_EMAIL hoặc ADMIN_PASSWORD trong apps/api/.env');
  if (!PASSWORD_RULE.test(password)) throw new Error('ADMIN_PASSWORD phải từ 8–72 ký tự, gồm cả chữ và số');

  const existing = await prisma.employee.findUnique({ where: { email }, include: { user: true } });
  if (existing?.user) {
    console.log(`Tài khoản ${email} đã tồn tại - bỏ qua.`);
    return;
  }

  // The env password lives in a file, so the admin must replace it on first login.
  const user = { create: { role: Role.ADMIN, passwordHash: await hash(password, 10), mustChangePassword: true } };
  if (existing) {
    await prisma.employee.update({ where: { id: existing.id }, data: { user } });
  } else {
    await prisma.employee.create({
      data: {
        code: 'ADMIN001',
        fullName: 'Quản trị viên',
        email,
        department: 'Ban Giám đốc',
        position: 'Quản trị hệ thống',
        hireDate: new Date(new Date().toISOString().slice(0, 10)),
        user,
      },
    });
  }
  console.log(`Đã tạo Admin ${email} (bắt buộc đổi mật khẩu khi đăng nhập lần đầu).`);
}

async function seedDemo(): Promise<void> {
  if ((await prisma.employee.count()) > 1) {
    console.log('Đã có dữ liệu nhân viên - bỏ qua dữ liệu mẫu.');
    return;
  }
  const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi'];
  const middleNames = ['Văn', 'Thị', 'Minh', 'Thu', 'Quốc', 'Ngọc'];
  const firstNames = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Hùng', 'Lan', 'Long', 'Mai', 'Nam', 'Phương', 'Tuấn'];
  const departments: Array<[string, string[]]> = [
    ['Kỹ thuật', ['Lập trình viên', 'Kiểm thử viên', 'Trưởng nhóm kỹ thuật']],
    ['Kinh doanh', ['Nhân viên kinh doanh', 'Trưởng phòng kinh doanh']],
    ['Nhân sự', ['Chuyên viên tuyển dụng', 'Chuyên viên C&B']],
    ['Kế toán', ['Kế toán viên', 'Kế toán trưởng']],
  ];
  const statuses = [EmployeeStatus.ACTIVE, EmployeeStatus.ACTIVE, EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION, EmployeeStatus.ON_LEAVE];

  const data = Array.from({ length: 30 }, (_, i) => {
    const n = i + 1;
    const [department, positions] = departments[i % departments.length];
    const middle = middleNames[i % middleNames.length];
    return {
      code: `NV${String(n).padStart(4, '0')}`,
      fullName: `${lastNames[i % lastNames.length]} ${middle} ${firstNames[(i * 7) % firstNames.length]}`,
      email: `nhanvien${n}@congty.vn`,
      phone: `09${String(10_000_000 + n * 7919).slice(0, 8)}`,
      dateOfBirth: new Date(Date.UTC(1985 + (i % 15), i % 12, 1 + (i % 27))),
      gender: middle === 'Thị' || middle === 'Thu' || middle === 'Ngọc' ? Gender.FEMALE : Gender.MALE,
      department,
      position: positions[i % positions.length],
      hireDate: new Date(Date.UTC(2018 + (i % 7), (i * 5) % 12, 1 + (i % 28))),
      status: statuses[i % statuses.length],
      salary: 9_000_000 + ((i * 1_500_000) % 30_000_000),
    };
  });
  const { count } = await prisma.employee.createMany({ data, skipDuplicates: true });
  console.log(`Đã thêm ${count} nhân viên mẫu.`);
}

async function main() {
  await seedAdmin();
  if (process.env.SEED_DEMO === 'true') await seedDemo();
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
