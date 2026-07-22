import { Module } from '@nestjs/common';
import { CopiersController } from './copiers.controller';
import { CopiersService } from './copiers.service';

@Module({
  controllers: [CopiersController],
  providers: [CopiersService],
  exports: [CopiersService],
})
export class CopiersModule {}
