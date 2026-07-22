import { IsEnum, IsString, MinLength } from 'class-validator';
import { Platform } from '@prisma/client';

export class CreateMasterDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(1)
  login!: string;

  /** Broker trade password — encrypted at rest, forwarded to the copier provider. */
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @MinLength(1)
  server!: string;

  @IsEnum(Platform)
  platform!: Platform;
}
