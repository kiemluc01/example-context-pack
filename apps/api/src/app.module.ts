import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { SESSION_TTL_SECONDS, requireJwtSecret } from './auth/auth.constants';
import { EmployeesModule } from './employees/employees.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: requireJwtSecret(), signOptions: { expiresIn: SESSION_TTL_SECONDS } }),
    }),
    PrismaModule,
    AuthModule,
    EmployeesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
