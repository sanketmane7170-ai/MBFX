import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../common/audit/audit.service';
import { SettingsService } from './settings.service';
import { SetMetaApiDto, TestConnectionDto } from './dto/update-settings.dto';

// Super-admin only.
@Controller('settings')
@Roles(Role.SUPER_ADMIN)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get('metaapi')
  status() {
    return this.settings.getStatus();
  }

  @Put('metaapi')
  async set(@Body() dto: SetMetaApiDto, @CurrentUser('sub') userId: string) {
    const status = await this.settings.setMetaApi(dto.token, dto.region ?? 'new-york', userId);
    await this.audit.log({
      userId,
      action: 'METAAPI_TOKEN_SET',
      entityType: 'PlatformSetting',
      entityId: 'singleton',
      meta: { region: status.region },
    });
    return status;
  }

  @Post('metaapi/test')
  @HttpCode(HttpStatus.OK)
  test(@Body() dto: TestConnectionDto) {
    return this.settings.testConnection(dto.token, dto.region);
  }

  @Delete('metaapi')
  async clear(@CurrentUser('sub') userId: string) {
    const status = await this.settings.clear(userId);
    await this.audit.log({
      userId,
      action: 'METAAPI_TOKEN_CLEARED',
      entityType: 'PlatformSetting',
      entityId: 'singleton',
    });
    return status;
  }
}
