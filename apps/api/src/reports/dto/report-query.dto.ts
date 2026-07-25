import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import type { Bucket } from '../reports.calc';

export class ReportQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Period rollup granularity for the time series. Defaults to 'day'. */
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  bucket?: Bucket;
}
