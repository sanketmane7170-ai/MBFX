import { IsString, MinLength } from 'class-validator';

export class SimulateCloseDto {
  @IsString()
  @MinLength(1)
  sourceTicket!: string;
}
