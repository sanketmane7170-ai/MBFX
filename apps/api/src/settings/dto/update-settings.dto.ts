import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class SetSmtpDto {
  @IsString()
  @MinLength(1)
  host!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsString()
  @MinLength(1)
  user!: string;

  /**
   * SMTP/app password. Optional on update: when omitted the stored password is
   * kept (lets the operator change host/port without re-entering the secret).
   */
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsEmail()
  alertEmail?: string;

  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;
}

export class TestSmtpDto {
  // Optional overrides — when omitted the stored/pending config is used.
  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  /** When provided, a real test email is sent to this address. */
  @IsOptional()
  @IsEmail()
  to?: string;
}
