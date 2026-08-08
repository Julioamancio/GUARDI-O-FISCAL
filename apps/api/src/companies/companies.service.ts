import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isValidCnpj, isValidCnpjOrCpf, normalizeCnpj } from '@guardiao/shared';
import { parseCsv } from '../common/csv';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';
import { CreateCompanyDto, CreateContactDto, SetResponsibleDto, UpdateCompanyDto } from './dto/companies.dto';

export interface CompanyFilters {
  search?: string;
  status?: string;
  regime?: string;
  uf?: string;
  tag?: string;
  page: number;
  perPage: number;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: CompanyFilters) {
    const where: Prisma.CompanyWhereInput = { deletedAt: null };
    if (filters.status) where.status = filters.status as never;
    if (filters.regime) where.regimeTributario = filters.regime as never;
    if (filters.uf) where.uf = filters.uf.toUpperCase();
    if (filters.tag) where.tags = { has: filters.tag };
    if (filters.search) {
      const digits = filters.search.replace(/\D/g, '');
      where.OR = [
        { razaoSocial: { contains: filters.search, mode: 'insensitive' } },
        { nomeFantasia: { contains: filters.search, mode: 'insensitive' } },
        ...(digits.length >= 4 ? [{ cnpj: { contains: digits } }] : []),
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.scoped.company.findMany({
        where,
        include: {
          responsibles: { include: { user: { select: { id: true, name: true } } } },
          _count: { select: { tasks: { where: { deletedAt: null, status: { notIn: ['CONCLUIDA', 'CANCELADA'] } } } } },
        },
        orderBy: { razaoSocial: 'asc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      this.prisma.scoped.company.count({ where }),
    ]);
    return { items, total, page: filters.page, perPage: filters.perPage };
  }

  async get(id: string) {
    const company = await this.prisma.scoped.company.findFirst({
      where: { id, deletedAt: null },
      include: {
        contacts: { orderBy: { createdAt: 'asc' } },
        responsibles: { include: { user: { select: { id: true, name: true, email: true } } } },
        obligations: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
        clientAccesses: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } },
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async create(dto: CreateCompanyDto) {
    if (!isValidCnpj(dto.cnpj)) {
      throw new BadRequestException('CNPJ inválido (dígitos verificadores não conferem)');
    }
    const cnpj = normalizeCnpj(dto.cnpj);

    const tenantId = TenantContext.get()?.tenantId;
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId ?? '' },
      include: { plan: true },
    });
    const activeCompanies = await this.prisma.scoped.company.count({ where: { deletedAt: null } });
    if (tenant.plan && activeCompanies >= tenant.plan.maxCompanies) {
      throw new BadRequestException(
        `Limite de ${tenant.plan.maxCompanies} empresas do plano ${tenant.plan.name} atingido`,
      );
    }

    const exists = await this.prisma.scoped.company.findFirst({ where: { cnpj } });
    if (exists) throw new ConflictException('Já existe uma empresa com este CNPJ no escritório');

    const company = await this.prisma.scoped.company.create({
      data: {
        ...dto,
        tenantId: this.tid(),
        cnpj,
        uf: dto.uf?.toUpperCase(),
        dataAbertura: dto.dataAbertura ? new Date(dto.dataAbertura) : undefined,
      },
    });
    await this.audit.log({
      action: 'companies.create',
      entity: 'Company',
      entityId: company.id,
      after: { razaoSocial: company.razaoSocial, cnpj: company.cnpj },
    });
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const current = await this.prisma.scoped.company.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Empresa não encontrada');

    let cnpj: string | undefined;
    if (dto.cnpj !== undefined) {
      if (!isValidCnpj(dto.cnpj)) throw new BadRequestException('CNPJ inválido');
      cnpj = normalizeCnpj(dto.cnpj);
      if (cnpj !== current.cnpj) {
        const dup = await this.prisma.scoped.company.findFirst({ where: { cnpj, id: { not: id } } });
        if (dup) throw new ConflictException('Já existe uma empresa com este CNPJ no escritório');
      }
    }

    const updated = await this.prisma.scoped.company.update({
      where: { id },
      data: {
        ...dto,
        cnpj,
        uf: dto.uf?.toUpperCase(),
        dataAbertura: dto.dataAbertura ? new Date(dto.dataAbertura) : undefined,
      },
    });
    await this.audit.log({
      action: 'companies.update',
      entity: 'Company',
      entityId: id,
      before: { razaoSocial: current.razaoSocial, status: current.status, riskLevel: current.riskLevel },
      after: dto,
    });
    return updated;
  }

  async remove(id: string) {
    const current = await this.prisma.scoped.company.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Empresa não encontrada');
    await this.prisma.scoped.company.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    // Obrigações da empresa deixam de gerar tarefas
    await this.prisma.scoped.obligation.updateMany({ where: { companyId: id }, data: { active: false } });
    await this.audit.log({ action: 'companies.delete', entity: 'Company', entityId: id });
    return { deleted: true };
  }

  // --- Contatos ---

  async addContact(companyId: string, dto: CreateContactDto) {
    await this.ensureCompany(companyId);
    const contact = await this.prisma.scoped.companyContact.create({
      data: { ...dto, companyId, tenantId: this.tid() },
    });
    await this.audit.log({ action: 'companies.contacts.add', entity: 'CompanyContact', entityId: contact.id, after: dto });
    return contact;
  }

  async removeContact(companyId: string, contactId: string) {
    const contact = await this.prisma.scoped.companyContact.findFirst({ where: { id: contactId, companyId } });
    if (!contact) throw new NotFoundException('Contato não encontrado');
    await this.prisma.scoped.companyContact.delete({ where: { id: contactId } });
    await this.audit.log({ action: 'companies.contacts.remove', entity: 'CompanyContact', entityId: contactId });
    return { deleted: true };
  }

  // --- Responsáveis por área ---

  async setResponsible(companyId: string, dto: SetResponsibleDto) {
    await this.ensureCompany(companyId);
    const user = await this.prisma.scoped.user.findFirst({ where: { id: dto.userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuário não encontrado no escritório');

    const existing = await this.prisma.scoped.companyResponsible.findFirst({
      where: { companyId, area: dto.area },
    });
    const responsible = existing
      ? await this.prisma.scoped.companyResponsible.update({
          where: { id: existing.id },
          data: { userId: dto.userId },
        })
      : await this.prisma.scoped.companyResponsible.create({
          data: { companyId, area: dto.area, userId: dto.userId, tenantId: this.tid() },
        });
    await this.audit.log({
      action: 'companies.responsibles.set',
      entity: 'CompanyResponsible',
      entityId: responsible.id,
      before: existing ? { userId: existing.userId } : undefined,
      after: { area: dto.area, userId: dto.userId },
    });
    return responsible;
  }

  async removeResponsible(companyId: string, area: string) {
    const existing = await this.prisma.scoped.companyResponsible.findFirst({
      where: { companyId, area: area as never },
    });
    if (!existing) throw new NotFoundException('Responsável não encontrado para esta área');
    await this.prisma.scoped.companyResponsible.delete({ where: { id: existing.id } });
    await this.audit.log({ action: 'companies.responsibles.remove', entity: 'CompanyResponsible', entityId: existing.id });
    return { deleted: true };
  }

  // --- Importação CSV (requisito 32) ---

  static readonly IMPORT_HEADER = ['razao_social', 'cnpj', 'nome_fantasia', 'regime_tributario', 'uf', 'municipio', 'email', 'telefone'];
  static readonly IMPORT_TEMPLATE =
    '﻿' +
    CompaniesService.IMPORT_HEADER.join(';') +
    '\r\nContabilidade Exemplo LTDA;12.345.678/0001-90;Exemplo;SIMPLES_NACIONAL;SP;São Paulo;contato@exemplo.com.br;(11) 99999-0000\r\n';

  /** Cabeçalhos alternativos aceitos (planilhas reais dos escritórios variam muito). */
  private static readonly HEADER_ALIASES: Record<string, string> = {
    empresa: 'razao_social',
    cliente: 'razao_social',
    nome: 'razao_social',
    razao: 'razao_social',
    'cnpj/cpf': 'cnpj',
    cnpj_cpf: 'cnpj',
    'cpf/cnpj': 'cnpj',
    cpf_cnpj: 'cnpj',
    cpf: 'cnpj',
    documento: 'cnpj',
    regime: 'regime_tributario',
    tributacao: 'regime_tributario',
    apuracao: 'regime_tributario',
    tipo_apuracao: 'regime_tributario',
    tipo_apuracao_impostos: 'regime_tributario',
    tipo_de_apuracao: 'regime_tributario',
    'e-mail': 'email',
    e_mail: 'email',
    fone: 'telefone',
    celular: 'telefone',
    phone: 'telefone',
    fantasia: 'nome_fantasia',
    estado: 'uf',
    cidade: 'municipio',
    responsavel: 'contato',
  };

  /** Regimes escritos por extenso na planilha → valor canônico do sistema. */
  private static readonly REGIME_ALIASES: Record<string, string> = {
    SIMPLES: 'SIMPLES_NACIONAL',
    PRESUMIDO: 'LUCRO_PRESUMIDO',
    REAL: 'LUCRO_REAL',
    IMUNE: 'IMUNE_ISENTA',
    ISENTA: 'IMUNE_ISENTA',
  };

  /** minúsculas, sem acento, espaços viram _ — e aplica os apelidos conhecidos. */
  private static normalizeHeaderCell(raw: string): string {
    const flat = raw
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_');
    return CompaniesService.HEADER_ALIASES[flat] ?? flat;
  }

  /**
   * Importa empresas de um CSV. confirm=false = pré-visualização (valida tudo,
   * não grava nada); confirm=true = grava apenas as linhas válidas.
   * Aceita cabeçalhos flexíveis (EMPRESA, CNPJ/CPF, TIPO APURAÇÃO IMPOSTOS...),
   * CPF além de CNPJ, e cria o contato da empresa quando a coluna "contato" existe.
   */
  async importCsv(fileBuffer: Buffer, confirm: boolean) {
    const rows = parseCsv(fileBuffer.toString('utf8'));
    if (rows.length < 2) throw new BadRequestException('CSV vazio — baixe o modelo em /companies/import/template');

    const header = rows[0].map((h) => CompaniesService.normalizeHeaderCell(h));
    const col = (name: string) => header.indexOf(name);
    if (col('razao_social') === -1 || col('cnpj') === -1) {
      throw new BadRequestException(
        'Cabeçalho inválido: preciso de uma coluna com o nome da empresa (razao_social/EMPRESA) e uma com o documento (cnpj/CNPJ/CPF)',
      );
    }

    const REGIMES = ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI', 'IMUNE_ISENTA', 'OUTRO'];
    const existing = await this.prisma.scoped.company.findMany({ select: { cnpj: true } });
    const existingCnpjs = new Set(existing.map((c) => c.cnpj));
    const seenInFile = new Set<string>();
    const errors: Array<{ line: number; error: string }> = [];
    const valid: Array<{
      razaoSocial: string; cnpj: string; nomeFantasia?: string; regimeTributario?: string;
      uf?: string; municipio?: string; email?: string; phone?: string; contato?: string;
    }> = [];

    rows.slice(1).forEach((row, index) => {
      const line = index + 2; // linha real no arquivo
      const get = (name: string) => (col(name) >= 0 ? (row[col(name)] ?? '').trim() : '');
      const razaoSocial = get('razao_social');
      const rawCnpj = get('cnpj');
      const regimeRaw = CompaniesService.normalizeHeaderCell(get('regime_tributario')).toUpperCase();
      const regime = CompaniesService.REGIME_ALIASES[regimeRaw] ?? regimeRaw;
      const uf = get('uf').toUpperCase();

      if (!razaoSocial) return errors.push({ line, error: 'nome da empresa vazio' });
      if (!isValidCnpjOrCpf(rawCnpj)) return errors.push({ line, error: `CNPJ/CPF inválido: "${rawCnpj}"` });
      const cnpj = normalizeCnpj(rawCnpj);
      if (seenInFile.has(cnpj)) return errors.push({ line, error: `CNPJ duplicado no arquivo: ${cnpj}` });
      if (existingCnpjs.has(cnpj)) return errors.push({ line, error: `CNPJ já cadastrado no escritório: ${cnpj}` });
      if (regime && !REGIMES.includes(regime)) {
        return errors.push({ line, error: `regime_tributario inválido: "${get('regime_tributario')}" (use ${REGIMES.join(', ')})` });
      }
      if (uf && uf.length !== 2) return errors.push({ line, error: `UF inválida: "${uf}"` });

      seenInFile.add(cnpj);
      valid.push({
        razaoSocial,
        cnpj,
        nomeFantasia: get('nome_fantasia') || undefined,
        regimeTributario: regime || undefined,
        uf: uf || undefined,
        municipio: get('municipio') || undefined,
        email: get('email') || undefined,
        phone: get('telefone') || undefined,
        contato: get('contato') || undefined,
      });
    });

    let created = 0;
    if (confirm && valid.length > 0) {
      // Limite do plano considerado sobre o total final
      const tenant = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: this.tid() },
        include: { plan: true },
      });
      const current = await this.prisma.scoped.company.count({ where: { deletedAt: null } });
      if (tenant.plan && current + valid.length > tenant.plan.maxCompanies) {
        throw new BadRequestException(
          `A importação excederia o limite do plano (${tenant.plan.maxCompanies} empresas; atuais: ${current}, no arquivo: ${valid.length})`,
        );
      }
      const tenantId = this.tid();
      const result = await this.prisma.company.createMany({
        data: valid.map(({ contato: _contato, ...v }) => ({
          ...v,
          tenantId,
          regimeTributario: v.regimeTributario as never,
        })),
        skipDuplicates: true,
      });
      created = result.count;

      // Coluna "contato" na planilha vira o contato principal da empresa
      const contactRows = valid.filter((v) => v.contato);
      if (contactRows.length > 0) {
        const companies = await this.prisma.scoped.company.findMany({
          where: { cnpj: { in: contactRows.map((v) => v.cnpj) } },
          select: { id: true, cnpj: true },
        });
        const idByCnpj = new Map(companies.map((c) => [c.cnpj, c.id]));
        await this.prisma.companyContact.createMany({
          data: contactRows.flatMap((v) => {
            const companyId = idByCnpj.get(v.cnpj);
            return companyId
              ? [{ tenantId, companyId, name: v.contato!, email: v.email ?? null, phone: v.phone ?? null }]
              : [];
          }),
        });
      }
      await this.audit.log({
        action: 'companies.import',
        entity: 'Company',
        after: { totalRows: rows.length - 1, created, errors: errors.length },
      });
    }

    return {
      totalRows: rows.length - 1,
      validRows: valid.length,
      errorRows: errors.length,
      created,
      confirmed: confirm,
      errors: errors.slice(0, 100),
      preview: confirm ? [] : valid.slice(0, 10),
    };
  }

  // --- Acesso de clientes ao portal ---

  /** Vincula um usuário com papel "client" à empresa (o que ele vê no portal). */
  async linkClient(companyId: string, userId: string) {
    await this.ensureCompany(companyId);
    const user = await this.prisma.scoped.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado no escritório');
    if (!user.roles.some((r) => r.role.slug === 'client')) {
      throw new BadRequestException('Apenas usuários com papel "Cliente do Escritório" podem ser vinculados ao portal');
    }
    const existing = await this.prisma.scoped.companyClientAccess.findFirst({
      where: { companyId, userId },
    });
    if (existing) return existing;
    const access = await this.prisma.scoped.companyClientAccess.create({
      data: { companyId, userId, tenantId: this.tid() },
    });
    await this.audit.log({
      action: 'companies.clients.link',
      entity: 'CompanyClientAccess',
      entityId: access.id,
      after: { companyId, userId },
    });
    return access;
  }

  async unlinkClient(companyId: string, userId: string) {
    const existing = await this.prisma.scoped.companyClientAccess.findFirst({
      where: { companyId, userId },
    });
    if (!existing) throw new NotFoundException('Vínculo não encontrado');
    await this.prisma.scoped.companyClientAccess.delete({ where: { id: existing.id } });
    await this.audit.log({
      action: 'companies.clients.unlink',
      entity: 'CompanyClientAccess',
      entityId: existing.id,
    });
    return { deleted: true };
  }

  private async ensureCompany(id: string) {
    const company = await this.prisma.scoped.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  /** tenantId do contexto (a extensão scoped revalida em toda query). */
  private tid(): string {
    const tenantId = TenantContext.get()?.tenantId;
    if (!tenantId) throw new ForbiddenException('Operação exige contexto de escritório');
    return tenantId;
  }
}
