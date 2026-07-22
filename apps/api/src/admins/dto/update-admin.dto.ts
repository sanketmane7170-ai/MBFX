import { IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateAdminDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
