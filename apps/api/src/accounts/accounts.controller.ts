import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  create(@Body() dto: CreateAccountDto, @CurrentUser('sub') actorId: string) {
    return this.accounts.create(dto, actorId);
  }

  @Get()
  findAll() {
    return this.accounts.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.findOne(id);
  }

  @Patch(':id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser('sub') actorId: string,
  ) {
    if (dto.label === undefined) return this.accounts.findOne(id);
    return this.accounts.rename(id, dto.label, actorId);
  }

  @Post(':id/connect')
  connect(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string) {
    return this.accounts.setConnected(id, true, actorId);
  }

  @Post(':id/disconnect')
  disconnect(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string) {
    return this.accounts.setConnected(id, false, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string) {
    await this.accounts.remove(id, actorId);
  }
}
