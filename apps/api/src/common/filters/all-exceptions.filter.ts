import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Catch-all exception filter: consistent JSON error shape + structured logging.
 * Maps common Prisma errors to sensible HTTP codes and never leaks internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        message = (body as any).message ?? exception.message;
        error = (body as any).error ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with these details already exists.';
        error = 'Conflict';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found.';
        error = 'NotFound';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database request error.';
        error = 'BadRequest';
      }
    }

    const payload = {
      statusCode: status,
      error,
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status}: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    } else {
      this.logger.warn(`${req.method} ${req.originalUrl} -> ${status}: ${JSON.stringify(message)}`);
    }

    res.status(status).json(payload);
  }
}
