import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Employee, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto, LoginDto } from './auth.dto';
import type { AuthUser, SessionPayload } from './auth.types';
import { hashPassword, verifyPassword } from './password';

export interface SessionUser {
  id: string;
  role: User['role'];
  mustChangePassword: boolean;
  employee: { id: string; code: string; fullName: string; email: string };
}

function toSessionUser(user: User, employee: Employee): SessionUser {
  return {
    id: user.id,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    employee: { id: employee.id, code: employee.code, fullName: employee.fullName, email: employee.email },
  };
}

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ token: string; user: SessionUser }> {
    const employee = await this.prisma.employee.findUnique({ where: { email: dto.email }, include: { user: true } });
    const user = employee && !employee.deletedAt ? employee.user : null;
    // Always run bcrypt so response time does not reveal whether the account exists.
    this.dummyHash ??= hashPassword('timing-equalizer-1');
    const valid = await verifyPassword(dto.password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !employee || !valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    return { token: await this.sign(user), user: toSessionUser(user, employee) };
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { employee: true } });
    return toSessionUser(user, user.employee);
  }

  async changePassword(actor: AuthUser, dto: ChangePasswordDto): Promise<{ token: string; user: SessionUser }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    // Bumping the version signs out every other session; the caller gets a fresh token.
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
      include: { employee: true },
    });
    return { token: await this.sign(updated), user: toSessionUser(updated, updated.employee) };
  }

  private sign(user: User): Promise<string> {
    const payload: SessionPayload = { sub: user.id, ver: user.sessionVersion };
    return this.jwt.signAsync(payload);
  }
}
