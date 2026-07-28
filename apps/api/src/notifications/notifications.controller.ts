import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.notifications.list(userId);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('sub') userId: string) {
    return { count: await this.notifications.unreadCount(userId) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') userId: string): Promise<void> {
    await this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@CurrentUser('sub') userId: string): Promise<void> {
    await this.notifications.markAllRead(userId);
  }
}
