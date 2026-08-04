import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@RequirePermissions('users.manage')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários do escritório' })
  list(@Query('page') page?: string, @Query('perPage') perPage?: string) {
    return this.usersService.list(
      Math.max(1, Number(page ?? 1) || 1),
      Math.min(100, Math.max(1, Number(perPage ?? 20) || 20)),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um funcionário/cliente do escritório' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza nome, papel ou status de acesso' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Exclui (soft delete) um usuário do escritório' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
