import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

/** Client-facing runtime flags (authenticated) — drives conditional UI. */
@Controller('runtime')
export class RuntimeController {
  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  info() {
    const liveTrading = this.settings.hasToken();
    const prod = this.config.get<string>('NODE_ENV') === 'production';
    return {
      liveTrading,
      // Dev simulation is available only off-prod and while no real token is set.
      simulationEnabled: !liveTrading && !prod,
    };
  }
}
