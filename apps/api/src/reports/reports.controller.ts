import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { AuthPayload, CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Portfolio-wide financial report across the caller's copiers. */
  @Get('overview')
  overview(@Query() q: ReportQueryDto, @CurrentUser() actor: AuthPayload) {
    return this.reports.overview(q, actor);
  }

  /** Per-account financial report. */
  @Get('accounts/:id')
  account(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ReportQueryDto,
    @CurrentUser() actor: AuthPayload,
  ) {
    return this.reports.forAccount(id, q, actor);
  }
}
