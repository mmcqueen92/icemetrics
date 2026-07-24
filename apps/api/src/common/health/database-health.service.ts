import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class DatabaseHealthService {
  constructor(
    @Inject(PrismaService)
    private readonly database: PrismaService,
  ) {}

  async isReady(): Promise<boolean> {
    return this.database.isReady();
  }
}
