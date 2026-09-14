import { Module } from '@nestjs/common';
import { AvatarStorage } from './avatar-storage';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({ controllers: [EmployeesController], providers: [EmployeesService, AvatarStorage] })
export class EmployeesModule {}
