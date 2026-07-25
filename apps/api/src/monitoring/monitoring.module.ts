import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { StreamGateway } from './stream.gateway';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';
import { CopyFactoryListenerService } from './copyfactory-listener.service';
import { AccountSnapshotService } from './account-snapshot.service';

// Dev-only trade simulation is not compiled into production at all — the route
// simply does not exist there (previously it was mounted and returned 403).
const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MonitoringController, ...(isProd ? [] : [SimulationController])],
  providers: [
    MonitoringService,
    StreamGateway,
    CopyFactoryListenerService,
    AccountSnapshotService,
    ...(isProd ? [] : [SimulationService]),
  ],
  exports: [MonitoringService, StreamGateway],
})
export class MonitoringModule {}
