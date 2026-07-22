import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { SimulateOpenDto } from './dto/simulate-open.dto';
import { SimulateCloseDto } from './dto/simulate-close.dto';

/**
 * DEV-ONLY simulation endpoints (authenticated; disabled when METAAPI_TOKEN is set).
 * Drives the copy pipeline without a real broker so monitoring can be verified.
 */
@Controller('dev/simulate/masters/:masterId')
export class SimulationController {
  constructor(private readonly sim: SimulationService) {}

  @Post('open')
  open(
    @Param('masterId', ParseUUIDPipe) masterId: string,
    @Body() dto: SimulateOpenDto,
  ) {
    return this.sim.open(masterId, dto);
  }

  @Post('close')
  close(
    @Param('masterId', ParseUUIDPipe) masterId: string,
    @Body() dto: SimulateCloseDto,
  ) {
    return this.sim.close(masterId, dto.masterTicket);
  }
}
