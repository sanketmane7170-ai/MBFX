import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { EventsQueryDto } from './dto/events-query.dto';

// Authenticated by the global JwtAuthGuard.
@Controller()
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get('masters/:id/copy-events')
  masterEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: EventsQueryDto,
  ) {
    return this.monitoring.copyEventsForMaster(id, q);
  }

  @Get('slaves/:id/copy-events')
  slaveEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: EventsQueryDto,
  ) {
    return this.monitoring.copyEventsForSlave(id, q);
  }

  @Get('accounts/:id/snapshot')
  snapshot(@Param('id', ParseUUIDPipe) id: string) {
    return this.monitoring.latestSnapshot(id);
  }
}
