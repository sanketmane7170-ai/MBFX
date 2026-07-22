import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { EventsQueryDto } from './dto/events-query.dto';

@Controller()
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get('copiers/:id/copy-events')
  copierEvents(@Param('id', ParseUUIDPipe) id: string, @Query() q: EventsQueryDto) {
    return this.monitoring.copyEventsForConfig(id, q);
  }

  @Get('accounts/:id/copy-events')
  accountEvents(@Param('id', ParseUUIDPipe) id: string, @Query() q: EventsQueryDto) {
    return this.monitoring.copyEventsForAccount(id, q);
  }

  @Get('accounts/:id/snapshot')
  snapshot(@Param('id', ParseUUIDPipe) id: string) {
    return this.monitoring.latestSnapshot(id);
  }
}
