import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { StreamGateway } from './stream.gateway';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MonitoringController, SimulationController],
  providers: [MonitoringService, StreamGateway, SimulationService],
  exports: [MonitoringService, StreamGateway],
})
export class MonitoringModule {}
