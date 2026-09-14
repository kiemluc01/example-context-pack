import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators';
import { CreateDepartmentDto, ListDepartmentsQueryDto, UpdateDepartmentDto } from './departments.dto';
import { DepartmentsService } from './departments.service';

const IdParam = () =>
  Param('id', new ParseUUIDPipe({ exceptionFactory: () => new NotFoundException('Không tìm thấy phòng ban') }));

/** Admin and HR can view departments; only Admin changes the organisation structure. */
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.HR)
  list(@Query() query: ListDepartmentsQueryDto) {
    return this.departments.list(query);
  }

  @Get('options')
  @Roles(Role.ADMIN, Role.HR)
  options() {
    return this.departments.options();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR)
  findOne(@IdParam() id: string) {
    return this.departments.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@IdParam() id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.ADMIN)
  remove(@IdParam() id: string) {
    return this.departments.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Roles(Role.ADMIN)
  restore(@IdParam() id: string) {
    return this.departments.restore(id);
  }
}
