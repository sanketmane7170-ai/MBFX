import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { SizingMode } from '@prisma/client';
import { SymbolMapDto } from './symbol-map.dto';

export class AddReceiverDto {
  @IsUUID()
  receiverAccountId!: string;

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

export class UpdateReceiverDto {
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
