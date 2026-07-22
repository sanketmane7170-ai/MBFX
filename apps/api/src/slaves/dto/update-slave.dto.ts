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
import { SizingMode } from '@prisma/client';
import { SymbolMapDto } from './symbol-map.dto';

export class UpdateSlaveDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

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

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
