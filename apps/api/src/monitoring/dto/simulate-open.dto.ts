import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { Side } from '@prisma/client';

export class SimulateOpenDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  symbol?: string;

  @IsOptional()
  @IsEnum(Side)
  side?: Side;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  lots?: number;

  @IsOptional()
  @IsNumber()
  sl?: number;

  @IsOptional()
  @IsNumber()
  tp?: number;

  @IsOptional()
  @IsString()
  sourceTicket?: string;
}
