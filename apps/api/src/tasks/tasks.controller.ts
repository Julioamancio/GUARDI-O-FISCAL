import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateCommentDto, CreateTaskDto, UpdateTaskDto } from './dto/tasks.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

const page = (v?: string) => Math.max(1, Number(v ?? 1) || 1);
const perPage = (v?: string) => Math.min(100, Math.max(1, Number(v ?? 20) || 20));

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'Lista tarefas com filtros (empresa, status, competência, vencidas...)' })
  list(
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
    @Query('competence') competence?: string,
    @Query('responsibleId') responsibleId?: string,
    @Query('department') department?: string,
    @Query('overdue') overdue?: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('page') p?: string,
    @Query('perPage') pp?: string,
  ) {
    return this.tasksService.list({
      companyId,
      status,
      competence,
      responsibleId,
      department,
      overdue: overdue === 'true',
      dueBefore,
      page: page(p),
      perPage: perPage(pp),
    });
  }

  @Get('summary')
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'Contadores por status + vencidas + próximas de vencer (dashboard)' })
  summary() {
    return this.tasksService.summary();
  }

  @Get(':id')
  @RequirePermissions('tasks.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.get(id);
  }

  @Post()
  @RequirePermissions('tasks.write')
  @ApiOperation({ summary: 'Cria tarefa manual (avulsa, fora da recorrência)' })
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tasks.write')
  @ApiOperation({ summary: 'Atualiza tarefa (status, prazo, responsável, checklist)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tasks.write')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id);
  }

  @Post(':id/comments')
  @RequirePermissions('tasks.write')
  addComment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto) {
    return this.tasksService.addComment(id, dto);
  }
}
