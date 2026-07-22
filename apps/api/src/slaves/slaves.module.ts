import { Module } from '@nestjs/common';
import { SlavesController } from './slaves.controller';
import { SlavesService } from './slaves.service';

@Module({
  controllers: [SlavesController],
  providers: [SlavesService],
})
export class SlavesModule {}
