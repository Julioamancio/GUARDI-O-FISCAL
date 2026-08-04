import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClosingService } from './closing.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('closing')
@ApiBearerAuth()
@Controller('closing')
export class ClosingController {
  constructor(private readonly closingService: ClosingService) {}

  @Get()
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'Painel de fechamento mensal (semáforo por empresa e departamento)' })
  panel(@Query('competence') competence: string) {
    return this.closingService.panel(competence);
  }
}
