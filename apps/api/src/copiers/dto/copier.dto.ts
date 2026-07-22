import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCopierDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsUUID()
  sourceAccountId!: string;
}

export class UpdateCopierDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
