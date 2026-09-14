import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES } from '../auth/decorators';
import { DepartmentsController } from './departments.controller';
import type { CreateDepartmentDto, ListDepartmentsQueryDto, UpdateDepartmentDto } from './departments.dto';
import type { DepartmentsService } from './departments.service';

function setup() {
  const service = {
    list: jest.fn(),
    options: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
  };
  return { service, controller: new DepartmentsController(service as unknown as DepartmentsService) };
}

describe('DepartmentsController', () => {
  it('delegates each route to the service', () => {
    const { service, controller } = setup();
    const query = { page: 1, pageSize: 20 } as ListDepartmentsQueryDto;
    const createDto = { code: 'KT', name: 'Kỹ thuật' } as CreateDepartmentDto;
    const updateDto = { managerId: null } as UpdateDepartmentDto;

    controller.list(query);
    controller.options();
    controller.findOne('d1');
    controller.create(createDto);
    controller.update('d1', updateDto);
    controller.remove('d1');
    controller.restore('d1');

    expect(service.list).toHaveBeenCalledWith(query);
    expect(service.options).toHaveBeenCalled();
    expect(service.findOne).toHaveBeenCalledWith('d1');
    expect(service.create).toHaveBeenCalledWith(createDto);
    expect(service.update).toHaveBeenCalledWith('d1', updateDto);
    expect(service.remove).toHaveBeenCalledWith('d1');
    expect(service.restore).toHaveBeenCalledWith('d1');
  });

  it('lets Admin and HR read departments but only Admin change them', () => {
    const reflector = new Reflector();
    const rolesOf = (method: keyof DepartmentsController) =>
      reflector.get<Role[] | undefined>(ROLES, DepartmentsController.prototype[method]);

    for (const method of ['list', 'options', 'findOne'] as const) {
      expect(rolesOf(method)).toEqual([Role.ADMIN, Role.HR]);
    }
    for (const method of ['create', 'update', 'remove', 'restore'] as const) {
      expect(rolesOf(method)).toEqual([Role.ADMIN]);
    }
  });
});
