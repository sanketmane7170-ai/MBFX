import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Security headers. API serves JSON only, so CSP/COEP defaults are safe.
  app.use(helmet());

  const config = app.get(ConfigService);

  // Lock CORS to configured origins in prod; reflect any origin in dev.
  const origins = config.get<string>('CORS_ORIGINS');
  app.enableCors({
    origin: origins ? origins.split(',').map((o) => o.trim()).filter(Boolean) : true,
    credentials: true,
  });

  // Trust the reverse proxy so throttling/logging see the real client IP.
  const http = app.getHttpAdapter().getInstance();
  if (typeof http.set === 'function') http.set('trust proxy', 1);

  // Drain DB pool / close connections cleanly on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
