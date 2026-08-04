import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TimelineService } from './timeline.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('timeline')
@ApiBearerAuth()
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Linha do tempo de responsabilidade (prova de quem fez o quê, quando)' })
  list(
    @Query('companyId') companyId?: string,
    @Query('competence') competence?: string,
    @Query('limit') limit?: string,
  ) {
    return this.timelineService.list(companyId, competence, Number(limit ?? 100) || 100);
  }
}
