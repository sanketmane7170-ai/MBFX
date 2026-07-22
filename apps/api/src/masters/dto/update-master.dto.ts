import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMasterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;
}
