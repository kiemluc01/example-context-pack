import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { AVATAR_MAX_BYTES } from './avatar-storage';
import { AccountRoleDto, CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from './employees.dto';
import { EmployeesService } from './employees.service';

const IdParam = () =>
  Param('id', new ParseUUIDPipe({ exceptionFactory: () => new NotFoundException('Không tìm thấy nhân viên') }));

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.HR)
  list(@Query() query: ListEmployeesQueryDto) {
    return this.employees.list(query);
  }

  @Get('filter-options')
  @Roles(Role.ADMIN, Role.HR)
  filterOptions() {
    return this.employees.filterOptions();
  }

  /** Own profile, available to every role (read-only for EMPLOYEE). */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.employees.findOne(user.employeeId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR)
  findOne(@IdParam() id: string) {
    return this.employees.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.HR)
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() actor: AuthUser) {
    return this.employees.create(dto, actor);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.HR)
  update(@IdParam() id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() actor: AuthUser) {
    return this.employees.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.ADMIN, Role.HR)
  remove(@IdParam() id: string, @CurrentUser() actor: AuthUser) {
    return this.employees.remove(id, actor);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Roles(Role.ADMIN, Role.HR)
  restore(@IdParam() id: string, @CurrentUser() actor: AuthUser) {
    return this.employees.restore(id, actor);
  }

  @Post(':id/account')
  @Roles(Role.ADMIN, Role.HR)
  createAccount(@IdParam() id: string, @Body() dto: AccountRoleDto, @CurrentUser() actor: AuthUser) {
    return this.employees.createAccount(id, dto.role, actor);
  }

  @Post(':id/account/reset-password')
  @HttpCode(200)
  @Roles(Role.ADMIN, Role.HR)
  resetPassword(@IdParam() id: string, @CurrentUser() actor: AuthUser) {
    return this.employees.resetPassword(id, actor);
  }

  @Patch(':id/account')
  @Roles(Role.ADMIN)
  changeRole(@IdParam() id: string, @Body() dto: AccountRoleDto, @CurrentUser() actor: AuthUser) {
    return this.employees.changeRole(id, dto.role, actor);
  }

  @Put(':id/avatar')
  @Roles(Role.ADMIN, Role.HR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } }))
  setAvatar(@IdParam() id: string, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: AuthUser) {
    return this.employees.setAvatar(id, file, actor);
  }

  @Get(':id/avatar')
  async getAvatar(
    @IdParam() id: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const avatar = await this.employees.getAvatar(id, actor);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(createReadStream(avatar.path), { type: avatar.mime });
  }
}
