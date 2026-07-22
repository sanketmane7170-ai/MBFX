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
import { MastersService } from './masters.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';

// Authenticated by the global JwtAuthGuard; both SUPER_ADMIN and ADMIN may manage accounts.
@Controller('masters')
export class MastersController {
  constructor(private readonly masters: MastersService) {}

  @Post()
  create(@Body() dto: CreateMasterDto, @CurrentUser('sub') actorId: string) {
    return this.masters.create(dto, actorId);
  }

  @Get()
  findAll() {
    return this.masters.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.masters.findOne(id);
  }

  @Patch(':id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMasterDto,
    @CurrentUser('sub') actorId: string,
  ) {
    if (dto.label === undefined) return this.masters.findOne(id);
    return this.masters.rename(id, dto.label, actorId);
  }

  @Post(':id/connect')
  connect(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.masters.setConnected(id, true, actorId);
  }

  @Post(':id/disconnect')
  disconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.masters.setConnected(id, false, actorId);
  }

  @Post(':id/close-all')
  closeAll(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.masters.closeAll(id, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    await this.masters.remove(id, actorId);
  }
}
