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

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.mapException(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }

  private mapException(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        const message =
          (resObj.message as string | string[] | undefined) ??
          exception.message;
        const error =
          (resObj.error as string | undefined) ?? HttpStatus[status] ?? 'Error';
        return { statusCode: status, message, error };
      }

      return {
        statusCode: status,
        message: typeof res === 'string' ? res : exception.message,
        error: HttpStatus[status] ?? 'Error',
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          const target = exception.meta?.target;
          const fields = Array.isArray(target)
            ? target.join(', ')
            : typeof target === 'string'
              ? target
              : 'unique field';
          return {
            statusCode: HttpStatus.CONFLICT,
            message: `Unique constraint violation on: ${fields}`,
            error: 'Conflict',
          };
        }
        case 'P2025': {
          return {
            statusCode: HttpStatus.NOT_FOUND,
            message: 'Requested record was not found',
            error: 'Not Found',
          };
        }
        case 'P2034': {
          return {
            statusCode: HttpStatus.CONFLICT,
            message: 'Transaction conflict or deadlock detected, please retry',
            error: 'Conflict',
          };
        }
        case 'P2003': {
          return {
            statusCode: HttpStatus.CONFLICT,
            message: 'Foreign key constraint failed on the operation',
            error: 'Conflict',
          };
        }
      }
    }

    if (
      exception instanceof Prisma.PrismaClientUnknownRequestError &&
      (exception.message.includes('40P01') ||
        exception.message.includes('40001') ||
        exception.message.includes('deadlock detected'))
    ) {
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'Transaction conflict or deadlock detected, please retry',
        error: 'Conflict',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}
