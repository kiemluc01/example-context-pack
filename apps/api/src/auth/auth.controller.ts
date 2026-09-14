import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AUTH_COOKIE, SESSION_TTL_SECONDS, authCookieOptions, loginRateLimit } from './auth.constants';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { AuthService, SessionUser } from './auth.service';
import type { AuthUser } from './auth.types';
import { AllowPendingPasswordChange, CurrentUser, Public } from './decorators';

const PASSWORD_THROTTLE = { default: { limit: loginRateLimit, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(PASSWORD_THROTTLE)
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<SessionUser> {
    const { token, user } = await this.auth.login(dto);
    setSessionCookie(res, token);
    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(AUTH_COOKIE, authCookieOptions());
  }

  @AllowPendingPasswordChange()
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<SessionUser> {
    return this.auth.me(user.id);
  }

  @AllowPendingPasswordChange()
  @UseGuards(ThrottlerGuard)
  @Throttle(PASSWORD_THROTTLE)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() actor: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const { token, user } = await this.auth.changePassword(actor, dto);
    setSessionCookie(res, token);
    return user;
  }
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, { ...authCookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
}
