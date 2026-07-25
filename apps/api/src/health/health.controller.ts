import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/** Liveness/readiness probes for load balancers & container orchestration. */
@Controller()
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness — process is up. */
  @Get('health')
  health() {
    return { status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() };
  }

  /** Readiness — dependencies (DB) reachable. */
  @Get('ready')
  async ready() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return { status: db ? 'ok' : 'degraded', db };
  }
}
