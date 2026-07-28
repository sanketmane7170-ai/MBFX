import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SizingMode, SymbolFilterMode } from '@prisma/client';
import { SymbolMapDto } from './symbol-map.dto';

/** Fields shared by add + update — copy rules, filters, and the trading window. */
class ReceiverRulesDto {
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

  // ---- Trade filters ----
  @IsOptional()
  @IsEnum(SymbolFilterMode)
  symbolFilterMode?: SymbolFilterMode;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbolFilterList?: string[];

  @IsOptional()
  @IsNumber()
  @IsPositive()
  minVolume?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxVolume?: number;

  // ---- Trading-hours window (minutes-of-day, UTC) ----
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  tradeWindowStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  tradeWindowEnd?: number;
}

export class AddReceiverDto extends ReceiverRulesDto {
  @IsUUID()
  receiverAccountId!: string;
}

export class UpdateReceiverDto extends ReceiverRulesDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
