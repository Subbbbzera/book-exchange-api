import { plainToInstance, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string;

  @IsEmail()
  @IsNotEmpty()
  ADMIN_EMAIL: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  ADMIN_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_NAME: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_PHONE: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => Object.values(err.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Config validation error: ${messages}`);
  }

  return validatedConfig;
}
