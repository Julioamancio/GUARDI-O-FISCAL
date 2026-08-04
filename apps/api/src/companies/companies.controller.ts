import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, CreateContactDto, SetResponsibleDto, UpdateCompanyDto } from './dto/companies.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

const page = (v?: string) => Math.max(1, Number(v ?? 1) || 1);
const perPage = (v?: string) => Math.min(100, Math.max(1, Number(v ?? 20) || 20));

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermissions('companies.read')
  @ApiOperation({ summary: 'Lista empresas do escritório com filtros e busca' })
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('regime') regime?: string,
    @Query('uf') uf?: string,
    @Query('tag') tag?: string,
    @Query('page') p?: string,
    @Query('perPage') pp?: string,
  ) {
    return this.companiesService.list({ search, status, regime, uf, tag, page: page(p), perPage: perPage(pp) });
  }

  @Get(':id')
  @RequirePermissions('companies.read')
  @ApiOperation({ summary: 'Detalhe da empresa (contatos, responsáveis, obrigações)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.get(id);
  }

  @Post()
  @RequirePermissions('companies.write')
  @ApiOperation({ summary: 'Cadastra empresa (valida CNPJ e limite do plano)' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('companies.write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('companies.write')
  @ApiOperation({ summary: 'Exclui (soft delete) e desativa as obrigações da empresa' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.remove(id);
  }

  @Post(':id/contacts')
  @RequirePermissions('companies.write')
  addContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateContactDto) {
    return this.companiesService.addContact(id, dto);
  }

  @Delete(':id/contacts/:contactId')
  @RequirePermissions('companies.write')
  removeContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.companiesService.removeContact(id, contactId);
  }

  @Post(':id/responsibles')
  @RequirePermissions('companies.write')
  @ApiOperation({ summary: 'Define o responsável de uma área (substitui o anterior)' })
  setResponsible(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetResponsibleDto) {
    return this.companiesService.setResponsible(id, dto);
  }

  @Delete(':id/responsibles/:area')
  @RequirePermissions('companies.write')
  removeResponsible(@Param('id', ParseUUIDPipe) id: string, @Param('area') area: string) {
    return this.companiesService.removeResponsible(id, area);
  }

  @Post(':id/clients/:userId')
  @RequirePermissions('companies.write')
  @ApiOperation({ summary: 'Vincula usuário-cliente à empresa (acesso ao portal)' })
  linkClient(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.companiesService.linkClient(id, userId);
  }

  @Delete(':id/clients/:userId')
  @RequirePermissions('companies.write')
  unlinkClient(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.companiesService.unlinkClient(id, userId);
  }
}
