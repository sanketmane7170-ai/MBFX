import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { AuthPayload, CurrentUser } from '../common/decorators/current-user.decorator';
import { MonitoringService } from './monitoring.service';
import { EventsQueryDto, HistoryQueryDto } from './dto/events-query.dto';

@Controller()
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get('copy-events')
  history(@Query() q: HistoryQueryDto, @CurrentUser() actor: AuthPayload) {
    return this.monitoring.history(actor, q);
  }

  @Get('copiers/:id/copy-events')
  copierEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: EventsQueryDto,
    @CurrentUser() actor: AuthPayload,
  ) {
    return this.monitoring.copyEventsForConfig(id, q, actor);
  }

  @Get('accounts/:id/copy-events')
  accountEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: EventsQueryDto,
    @CurrentUser() actor: AuthPayload,
  ) {
    return this.monitoring.copyEventsForAccount(id, q, actor);
  }

  @Get('accounts/:id/snapshot')
  snapshot(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    return this.monitoring.latestSnapshot(id, actor);
  }
}
