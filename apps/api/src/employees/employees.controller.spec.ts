import { StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AuthUser } from '../auth/auth.types';
import { ROLES } from '../auth/decorators';
import { EmployeesController } from './employees.controller';
import type { AccountRoleDto, CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from './employees.dto';
import type { EmployeesService } from './employees.service';

const actor: AuthUser = { id: 'u1', role: Role.HR, employeeId: 'e-hr', mustChangePassword: false };

function setup() {
  const service = {
    list: jest.fn(),
    filterOptions: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
    createAccount: jest.fn(),
    resetPassword: jest.fn(),
    changeRole: jest.fn(),
    setAvatar: jest.fn(),
    getAvatar: jest.fn(),
  };
  return { service, controller: new EmployeesController(service as unknown as EmployeesService) };
}

describe('EmployeesController', () => {
  it('delegates each route to the service with the acting user', () => {
    const { service, controller } = setup();
    const query = { page: 1, pageSize: 20 } as ListEmployeesQueryDto;
    const createDto = { code: 'NV0001' } as CreateEmployeeDto;
    const updateDto = { fullName: 'Nguyễn Văn An' } as UpdateEmployeeDto;
    const roleDto = { role: Role.EMPLOYEE } as AccountRoleDto;
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;

    controller.list(query);
    controller.filterOptions();
    controller.me(actor);
    controller.findOne('e1');
    controller.create(createDto, actor);
    controller.update('e1', updateDto, actor);
    controller.remove('e1', actor);
    controller.restore('e1', actor);
    controller.createAccount('e1', roleDto, actor);
    controller.resetPassword('e1', actor);
    controller.changeRole('e1', roleDto, actor);
    controller.setAvatar('e1', file, actor);

    expect(service.list).toHaveBeenCalledWith(query);
    expect(service.filterOptions).toHaveBeenCalled();
    expect(service.findOne).toHaveBeenNthCalledWith(1, 'e-hr');
    expect(service.findOne).toHaveBeenNthCalledWith(2, 'e1');
    expect(service.create).toHaveBeenCalledWith(createDto, actor);
    expect(service.update).toHaveBeenCalledWith('e1', updateDto, actor);
    expect(service.remove).toHaveBeenCalledWith('e1', actor);
    expect(service.restore).toHaveBeenCalledWith('e1', actor);
    expect(service.createAccount).toHaveBeenCalledWith('e1', Role.EMPLOYEE, actor);
    expect(service.resetPassword).toHaveBeenCalledWith('e1', actor);
    expect(service.changeRole).toHaveBeenCalledWith('e1', Role.EMPLOYEE, actor);
    expect(service.setAvatar).toHaveBeenCalledWith('e1', file, actor);
  });

  it('restricts management routes to Admin/HR and role changes to Admin', () => {
    const reflector = new Reflector();
    const rolesOf = (method: keyof EmployeesController) =>
      reflector.get<Role[] | undefined>(ROLES, EmployeesController.prototype[method]);

    const managed = ['list', 'filterOptions', 'findOne', 'create', 'update', 'remove', 'restore', 'createAccount', 'resetPassword', 'setAvatar'] as const;
    for (const method of managed) {
      expect(rolesOf(method)).toEqual([Role.ADMIN, Role.HR]);
    }
    expect(rolesOf('changeRole')).toEqual([Role.ADMIN]);
    expect(rolesOf('me')).toBeUndefined();
    expect(rolesOf('getAvatar')).toBeUndefined();
  });

  describe('getAvatar', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'avatar-controller-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('streams the file with private caching and nosniff headers', async () => {
      const { service, controller } = setup();
      const file = path.join(dir, 'a.png');
      writeFileSync(file, 'png');
      service.getAvatar.mockResolvedValue({ path: file, mime: 'image/png' });
      const res = { setHeader: jest.fn() };

      const stream = await controller.getAvatar('e1', actor, res as unknown as Response);

      expect(service.getAvatar).toHaveBeenCalledWith('e1', actor);
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300');
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(stream).toBeInstanceOf(StreamableFile);
      expect(stream.getHeaders().type).toBe('image/png');
      const chunks: Buffer[] = [];
      for await (const chunk of stream.getStream()) chunks.push(chunk as Buffer);
      expect(Buffer.concat(chunks).toString()).toBe('png');
    });
  });
});
