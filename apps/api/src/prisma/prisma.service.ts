import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { assertUtf8Ctype } from './locale';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    const problem = await assertUtf8Ctype(this);
    if (problem) this.logger.warn(problem);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
