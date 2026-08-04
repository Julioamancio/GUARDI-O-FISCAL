import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AdminService } from './admin.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

class SetTenantStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'CANCELED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'CANCELED';
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@RequirePermissions('tenants.manage')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('tenants')
  @ApiOperation({ summary: 'Cria um escritório (tenant) com plano e admin inicial' })
  createTenant(@Body() dto: CreateTenantDto) {
    return this.adminService.createTenant(dto);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Lista escritórios com contagem de usuários/empresas' })
  listTenants(@Query('page') page?: string, @Query('perPage') perPage?: string) {
    return this.adminService.listTenants(
      Math.max(1, Number(page ?? 1) || 1),
      Math.min(100, Math.max(1, Number(perPage ?? 20) || 20)),
    );
  }

  @Patch('tenants/:id/status')
  @ApiOperation({ summary: 'Ativa, suspende ou cancela um escritório' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetTenantStatusDto) {
    return this.adminService.setTenantStatus(id, dto.status);
  }

  @Get('plans')
  @RequirePermissions('plans.manage')
  @ApiOperation({ summary: 'Lista os planos da plataforma' })
  listPlans() {
    return this.adminService.listPlans();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Métricas globais: tenants, usuários, empresas, tarefas, armazenamento' })
  overview() {
    return this.adminService.overview();
  }
}
