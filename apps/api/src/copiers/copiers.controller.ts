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
import { AuthPayload, CurrentUser } from '../common/decorators/current-user.decorator';
import { CopiersService } from './copiers.service';
import { CreateCopierDto, UpdateCopierDto } from './dto/copier.dto';
import { AddReceiverDto, UpdateReceiverDto } from './dto/receiver.dto';

@Controller()
export class CopiersController {
  constructor(private readonly copiers: CopiersService) {}

  // ---- Copier configs ----
  @Get('copiers')
  list(@CurrentUser() actor: AuthPayload) {
    return this.copiers.listConfigs(actor);
  }

  @Post('copiers')
  create(@Body() dto: CreateCopierDto, @CurrentUser() actor: AuthPayload) {
    return this.copiers.createConfig(dto, actor);
  }

  @Get('copiers/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    return this.copiers.getConfig(id, actor);
  }

  @Patch('copiers/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCopierDto,
    @CurrentUser() actor: AuthPayload,
  ) {
    return this.copiers.updateConfig(id, dto, actor);
  }

  @Delete('copiers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    await this.copiers.deleteConfig(id, actor);
  }

  @Post('copiers/:id/close-all')
  closeAll(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    return this.copiers.closeAll(id, actor);
  }

  // ---- Receivers (subscriptions) ----
  @Post('copiers/:id/receivers')
  addReceiver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddReceiverDto,
    @CurrentUser() actor: AuthPayload,
  ) {
    return this.copiers.addReceiver(id, dto, actor);
  }

  @Patch('receivers/:id')
  updateReceiver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceiverDto,
    @CurrentUser() actor: AuthPayload,
  ) {
    return this.copiers.updateReceiver(id, dto, actor);
  }

  @Post('receivers/:id/pause')
  pause(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    return this.copiers.setReceiverEnabled(id, false, actor);
  }

  @Post('receivers/:id/resume')
  resume(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    return this.copiers.setReceiverEnabled(id, true, actor);
  }

  @Delete('receivers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeReceiver(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPayload,
  ) {
    await this.copiers.removeReceiver(id, actor);
  }
}
