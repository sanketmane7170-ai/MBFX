import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Platform, SizingMode } from '@prisma/client';
import { SymbolMapDto } from './symbol-map.dto';

export class CreateSlaveDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(1)
  login!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @MinLength(1)
  server!: string;

  @IsEnum(Platform)
  platform!: Platform;

  @IsOptional()
  @IsEnum(SizingMode)
  sizingMode?: SizingMode;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  multiplier?: number;

  @IsOptional()
  @IsBoolean()
  copySl?: boolean;

  @IsOptional()
  @IsBoolean()
  copyTp?: boolean;

  @IsOptional()
  @IsBoolean()
  reverse?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SymbolMapDto)
  symbolMapping?: SymbolMapDto[];
}
