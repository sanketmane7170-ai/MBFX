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
  Query,
} from '@nestjs/common';
import { AuthPayload, CurrentUser } from '../common/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  create(@Body() dto: CreateAccountDto, @CurrentUser() actor: AuthPayload) {
    return this.accounts.create(dto, actor);
  }

  @Get()
  findAll(@CurrentUser() actor: AuthPayload) {
    return this.accounts.findAll(actor);
  }

  // Must precede ':id' so the UUID param doesn't swallow this path.
  @Get('servers')
  serverSuggestions(@Query('q') q?: string) {
    return this.accounts.serverSuggestions(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    return this.accounts.findOne(id, actor);
  }

  @Get(':id/positions')
  positions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    return this.accounts.getPositions(id, actor);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() actor: AuthPayload,
  ) {
    if (dto.label === undefined && dto.password === undefined && dto.server === undefined) {
      return this.accounts.findOne(id, actor);
    }
    return this.accounts.update(id, dto, actor);
  }

  @Post(':id/connect')
  connect(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    return this.accounts.setConnected(id, true, actor);
  }

  @Post(':id/disconnect')
  disconnect(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    return this.accounts.setConnected(id, false, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPayload) {
    await this.accounts.remove(id, actor);
  }
}
