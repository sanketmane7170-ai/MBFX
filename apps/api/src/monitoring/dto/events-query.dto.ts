import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { CopyStatus } from '@prisma/client';

export class EventsQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

/** History query — adds status/symbol filters + offset pagination. */
export class HistoryQueryDto extends EventsQueryDto {
  @IsOptional()
  @IsEnum(CopyStatus)
  status?: CopyStatus;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
