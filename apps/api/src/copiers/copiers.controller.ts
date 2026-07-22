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
import { CopiersService } from './copiers.service';
import { CreateCopierDto, UpdateCopierDto } from './dto/copier.dto';
import { AddReceiverDto, UpdateReceiverDto } from './dto/receiver.dto';

@Controller()
export class CopiersController {
  constructor(private readonly copiers: CopiersService) {}

  // ---- Copier configs ----
  @Get('copiers')
  list() {
    return this.copiers.listConfigs();
  }

  @Post('copiers')
  create(@Body() dto: CreateCopierDto, @CurrentUser('sub') actorId: string) {
    return this.copiers.createConfig(dto, actorId);
  }

  @Get('copiers/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.copiers.getConfig(id);
  }

  @Patch('copiers/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCopierDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.copiers.updateConfig(id, dto, actorId);
  }

  @Delete('copiers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string) {
    await this.copiers.deleteConfig(id, actorId);
  }

  @Post('copiers/:id/close-all')
  closeAll(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string) {
    return this.copiers.closeAll(id, actorId);
  }

  // ---- Receivers (subscriptions) ----
  @Post('copiers/:id/receivers')
  addReceiver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddReceiverDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.copiers.addReceiver(id, dto, actorId);
  }

  @Patch('receivers/:id')
  updateReceiver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceiverDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.copiers.updateReceiver(id, dto, actorId);
  }

  @Post('receivers/:id/pause')
  pause(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string) {
    return this.copiers.setReceiverEnabled(id, false, actorId);
  }

  @Post('receivers/:id/resume')
  resume(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string) {
    return this.copiers.setReceiverEnabled(id, true, actorId);
  }

  @Delete('receivers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeReceiver(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    await this.copiers.removeReceiver(id, actorId);
  }
}
