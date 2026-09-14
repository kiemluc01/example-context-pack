import { Logger } from '@nestjs/common';
import { assertUtf8Ctype } from './locale';
import { PrismaService } from './prisma.service';

jest.mock('./locale', () => ({ assertUtf8Ctype: jest.fn() }));

const assertMock = jest.mocked(assertUtf8Ctype);

describe('PrismaService', () => {
  let connect: jest.SpyInstance;
  let disconnect: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    connect = jest.spyOn(PrismaService.prototype, '$connect').mockResolvedValue(undefined);
    disconnect = jest.spyOn(PrismaService.prototype, '$disconnect').mockResolvedValue(undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    assertMock.mockReset();
  });

  it('connects and stays quiet when the database locale is UTF-8', async () => {
    assertMock.mockResolvedValue(null);
    const service = new PrismaService();

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(assertMock.mock.calls[0][0]).toBe(service);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when Vietnamese case-insensitive search would be broken', async () => {
    assertMock.mockResolvedValue('Database đang dùng LC_CTYPE="C"');

    await new PrismaService().onModuleInit();

    expect(warn).toHaveBeenCalledWith('Database đang dùng LC_CTYPE="C"');
  });

  it('disconnects on shutdown', async () => {
    await new PrismaService().onModuleDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
