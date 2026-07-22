import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { SimulateOpenDto } from './dto/simulate-open.dto';
import { SimulateCloseDto } from './dto/simulate-close.dto';

/**
 * DEV-ONLY simulation endpoints (authenticated; disabled when METAAPI_TOKEN is set).
 * Drives the copy pipeline per copier config without a real broker.
 */
@Controller('dev/simulate/copiers/:copierId')
export class SimulationController {
  constructor(private readonly sim: SimulationService) {}

  @Post('open')
  open(@Param('copierId', ParseUUIDPipe) copierId: string, @Body() dto: SimulateOpenDto) {
    return this.sim.open(copierId, dto);
  }

  @Post('close')
  close(@Param('copierId', ParseUUIDPipe) copierId: string, @Body() dto: SimulateCloseDto) {
    return this.sim.close(copierId, dto.sourceTicket);
  }
}
