import { IsOptional, IsString, MinLength } from 'class-validator';

export class SetMetaApiDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsOptional()
  @IsString()
  region?: string;
}

export class TestConnectionDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  region?: string;
}
