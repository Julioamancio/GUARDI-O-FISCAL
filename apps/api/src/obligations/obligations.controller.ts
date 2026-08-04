import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ObligationsService } from './obligations.service';
import { RecurrenceService } from './recurrence.service';
import { CreateHolidayDto, CreateObligationDto, UpdateObligationDto } from './dto/obligations.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('obligations')
@ApiBearerAuth()
@Controller()
export class ObligationsController {
  constructor(
    private readonly obligationsService: ObligationsService,
    private readonly recurrenceService: RecurrenceService,
  ) {}

  @Get('obligation-templates')
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'Catálogo de templates (globais + do escritório)' })
  listTemplates() {
    return this.obligationsService.listTemplates();
  }

  @Get('obligations')
  @RequirePermissions('tasks.read')
  list(@Query('companyId') companyId?: string, @Query('all') all?: string) {
    return this.obligationsService.list(companyId, all !== 'true');
  }

  @Post('obligations')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Cria obrigação p/ uma ou mais empresas (de template ou custom)' })
  create(@Body() dto: CreateObligationDto) {
    return this.obligationsService.create(dto);
  }

  @Patch('obligations/:id')
  @RequirePermissions('settings.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateObligationDto) {
    return this.obligationsService.update(id, dto);
  }

  @Delete('obligations/:id')
  @RequirePermissions('settings.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.obligationsService.remove(id);
  }

  @Post('obligations/generate-tasks')
  @RequirePermissions('settings.manage')
  @ApiOperation({
    summary: 'Gera imediatamente as tarefas recorrentes do escritório (o worker também roda diariamente)',
  })
  generate() {
    return this.recurrenceService.generateForCurrentTenant();
  }

  @Get('holidays')
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'Feriados aplicáveis (nacionais + personalizados do escritório)' })
  listHolidays(@Query('year') year?: string) {
    return this.obligationsService.listHolidays(year ? Number(year) : undefined);
  }

  @Post('holidays')
  @RequirePermissions('settings.manage')
  createHoliday(@Body() dto: CreateHolidayDto) {
    return this.obligationsService.createHoliday(dto);
  }

  @Delete('holidays/:id')
  @RequirePermissions('settings.manage')
  removeHoliday(@Param('id', ParseUUIDPipe) id: string) {
    return this.obligationsService.removeHoliday(id);
  }
}
