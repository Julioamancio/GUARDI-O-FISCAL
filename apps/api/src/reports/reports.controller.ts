import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { buildCsv, buildPdf, buildXlsx, TabularReport } from './report-builder';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

const FORMATS = {
  csv: { mime: 'text/csv; charset=utf-8', ext: 'csv' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  pdf: { mime: 'application/pdf', ext: 'pdf' },
} as const;
type Format = keyof typeof FORMATS;

async function send(res: Response, report: TabularReport, format: string | undefined, filename: string) {
  const fmt = (format ?? 'csv') as Format;
  if (!FORMATS[fmt]) throw new BadRequestException('Formato deve ser csv, xlsx ou pdf');
  const buffer =
    fmt === 'csv' ? buildCsv(report) : fmt === 'xlsx' ? await buildXlsx(report) : await buildPdf(report);
  res
    .status(200)
    .set({
      'Content-Type': FORMATS[fmt].mime,
      'Content-Disposition': `attachment; filename="${filename}.${FORMATS[fmt].ext}"`,
      'Content-Length': String(buffer.length),
    })
    .send(buffer);
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@RequirePermissions('reports.read')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('tasks')
  @ApiOperation({ summary: 'Relatório de tarefas (format=csv|xlsx|pdf)' })
  async tasks(
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('competence') competence?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
  ) {
    const report = await this.reportsService.tasksReport({ competence, status, companyId });
    await send(res, report, format, `tarefas${competence ? `-${competence}` : ''}`);
  }

  @Get('document-pendencies')
  @ApiOperation({ summary: 'Documentos pendentes por cliente (format=csv|xlsx|pdf)' })
  async documentPendencies(@Res() res: Response, @Query('format') format?: string) {
    const report = await this.reportsService.documentPendenciesReport();
    await send(res, report, format, 'documentos-pendentes');
  }

  @Get('timeline/:companyId')
  @RequirePermissions('reports.read', 'audit.read')
  @ApiOperation({ summary: 'Linha do tempo de responsabilidade da empresa (prova exportável)' })
  async timeline(
    @Res() res: Response,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('format') format?: string,
    @Query('competence') competence?: string,
  ) {
    const report = await this.reportsService.timelineReport(companyId, competence);
    await send(res, report, format, `linha-do-tempo${competence ? `-${competence}` : ''}`);
  }
}
