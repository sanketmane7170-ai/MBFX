import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Platform } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(1)
  login!: string;

  /** Broker password — encrypted at rest, forwarded to the copier provider. */
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @MinLength(1)
  server!: string;

  @IsEnum(Platform)
  platform!: Platform;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  /** Rotate the broker/trade password (re-encrypted at rest). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;

  /** Change the broker server. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  server?: string;
}
