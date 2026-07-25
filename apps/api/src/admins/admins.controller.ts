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
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('admins')
@Roles(Role.SUPER_ADMIN)
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Post()
  create(
    @Body() dto: CreateAdminDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.admins.create(dto, actorId);
  }

  @Get()
  findAll() {
    return this.admins.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.admins.findOne(id);
  }

  @Patch(':id')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.admins.setStatus(id, dto.status, actorId);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    await this.admins.resetPassword(id, dto.password, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    await this.admins.remove(id, actorId);
  }
}
