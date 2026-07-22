import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SlavesService } from './slaves.service';
import { CreateSlaveDto } from './dto/create-slave.dto';
import { UpdateSlaveDto } from './dto/update-slave.dto';

// Authenticated by the global JwtAuthGuard. Slave routes are split between
// the master-scoped collection (create/list) and the slave resource itself.
@Controller()
export class SlavesController {
  constructor(private readonly slaves: SlavesService) {}

  @Post('masters/:masterId/slaves')
  create(
    @Param('masterId', ParseUUIDPipe) masterId: string,
    @Body() dto: CreateSlaveDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.slaves.create(masterId, dto, actorId);
  }

  @Get('masters/:masterId/slaves')
  list(@Param('masterId', ParseUUIDPipe) masterId: string) {
    return this.slaves.listForMaster(masterId);
  }

  @Get('slaves/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.slaves.findOne(id);
  }

  @Patch('slaves/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSlaveDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.slaves.update(id, dto, actorId);
  }

  @Post('slaves/:id/pause')
  pause(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.slaves.setEnabled(id, false, actorId);
  }

  @Post('slaves/:id/resume')
  resume(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.slaves.setEnabled(id, true, actorId);
  }

  @Delete('slaves/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    await this.slaves.remove(id, actorId);
  }
}
