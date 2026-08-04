import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentRequestStatus, RequestItemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantContext } from '../common/tenant-context';
import { CreateDocumentRequestDto, ReviewItemDto, UpdateDocumentRequestDto } from './dto/documents.dto';

@Injectable()
export class DocumentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateDocumentRequestDto) {
    const tenantId = this.tid();
    const company = await this.prisma.scoped.company.findFirst({
      where: { id: dto.companyId, deletedAt: null },
      include: { clientAccesses: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } } },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const createdById = TenantContext.get()?.userId ?? null;
    const request = await this.prisma.scoped.documentRequest.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        title: dto.title,
        message: dto.message,
        competence: dto.competence,
        dueDate: dto.dueDate ? new Date(`${dto.dueDate}T00:00:00.000Z`) : undefined,
        remindersEnabled: dto.remindersEnabled ?? true,
        createdById,
        items: {
          create: dto.items.map((name) => ({ tenantId, name: name.trim() })),
        },
      },
      include: { items: true },
    });

    // Notifica os clientes vinculados (ou o e-mail da empresa como fallback)
    const clients = company.clientAccesses.filter((a) => a.user.isActive);
    const dueText = dto.dueDate ? ` Prazo: ${dto.dueDate.split('-').reverse().join('/')}.` : '';
    const body =
      `${company.razaoSocial}: o escritório solicitou ${dto.items.length} documento(s) — ` +
      `${dto.items.join('; ')}.${dueText}` +
      (dto.message ? `\n\nMensagem: ${dto.message}` : '') +
      '\n\nAcesse o portal para enviar os arquivos.';
    if (clients.length > 0) {
      for (const access of clients) {
        await this.notifications.create({
          tenantId,
          userId: access.user.id,
          type: 'SOLICITACAO_CRIADA',
          title: `Documentos solicitados — ${dto.title}`,
          body,
          emailTo: access.user.email,
          meta: { requestId: request.id },
        });
      }
    } else if (company.email) {
      await this.notifications.create({
        tenantId,
        type: 'SOLICITACAO_CRIADA',
        title: `Documentos solicitados — ${dto.title}`,
        body,
        emailTo: company.email,
        meta: { requestId: request.id },
      });
    }

    await this.audit.log({
      action: 'document_requests.create',
      entity: 'DocumentRequest',
      entityId: request.id,
      after: { title: dto.title, companyId: dto.companyId, items: dto.items.length, notifiedClients: clients.length },
    });
    return request;
  }

  list(companyId?: string, status?: string) {
    return this.prisma.scoped.documentRequest.findMany({
      where: {
        deletedAt: null,
        ...(companyId ? { companyId } : {}),
        ...(status ? { status: status as DocumentRequestStatus } : {}),
      },
      include: {
        company: { select: { id: true, razaoSocial: true } },
        items: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(id: string) {
    const request = await this.prisma.scoped.documentRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        company: { select: { id: true, razaoSocial: true, cnpj: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            documents: {
              where: { deletedAt: null },
              include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
            },
            reviewedBy: { select: { id: true, name: true } },
          },
        },
        reminders: { orderBy: { sentAt: 'desc' } },
      },
    });
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    return request;
  }

  async update(id: string, dto: UpdateDocumentRequestDto) {
    const current = await this.prisma.scoped.documentRequest.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Solicitação não encontrada');

    const updated = await this.prisma.scoped.documentRequest.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: new Date(`${dto.dueDate}T00:00:00.000Z`) } : {}),
        ...(dto.remindersEnabled !== undefined ? { remindersEnabled: dto.remindersEnabled } : {}),
      },
    });
    await this.audit.log({
      action: 'document_requests.update',
      entity: 'DocumentRequest',
      entityId: id,
      before: { status: current.status, dueDate: current.dueDate, remindersEnabled: current.remindersEnabled },
      after: dto,
    });
    return updated;
  }

  /** Conferência do escritório: aprova ou rejeita um item já recebido. */
  async reviewItem(itemId: string, dto: ReviewItemDto) {
    const item = await this.prisma.scoped.documentRequestItem.findFirst({
      where: { id: itemId },
      include: { request: { include: { company: { include: { clientAccesses: { include: { user: true } } } } } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    if (item.status !== 'RECEBIDO' && !(item.status === 'APROVADO' && dto.status === 'REJEITADO')) {
      throw new BadRequestException('Só é possível conferir itens com documento recebido');
    }
    if (dto.status === 'REJEITADO' && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('Informe o motivo da rejeição — o cliente precisa saber o que corrigir');
    }

    const reviewerId = TenantContext.get()?.userId ?? null;
    const updated = await this.prisma.scoped.documentRequestItem.update({
      where: { id: itemId },
      data: {
        status: dto.status,
        rejectionReason: dto.status === 'REJEITADO' ? dto.rejectionReason : null,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });
    await this.recomputeStatus(item.requestId);

    // Notifica os clientes do resultado da conferência
    for (const access of item.request.company.clientAccesses) {
      if (!access.user.isActive) continue;
      await this.notifications.create({
        tenantId: item.tenantId,
        userId: access.user.id,
        type: dto.status === 'APROVADO' ? 'DOCUMENTO_APROVADO' : 'DOCUMENTO_REJEITADO',
        title:
          dto.status === 'APROVADO'
            ? `Documento aprovado — ${item.name}`
            : `Documento precisa de correção — ${item.name}`,
        body:
          dto.status === 'APROVADO'
            ? `O documento "${item.name}" da solicitação "${item.request.title}" foi conferido e aprovado.`
            : `O documento "${item.name}" foi rejeitado. Motivo: ${dto.rejectionReason}. Reenvie pelo portal.`,
        emailTo: access.user.email,
        meta: { requestId: item.requestId, itemId },
      });
    }

    await this.audit.log({
      action: dto.status === 'APROVADO' ? 'document_requests.item_approved' : 'document_requests.item_rejected',
      entity: 'DocumentRequestItem',
      entityId: itemId,
      before: { status: item.status },
      after: dto,
    });
    return updated;
  }

  /** Recalcula o status agregado da solicitação a partir dos itens. */
  async recomputeStatus(requestId: string) {
    const items = await this.prisma.scoped.documentRequestItem.findMany({ where: { requestId } });
    let status: DocumentRequestStatus = 'ABERTA';
    if (items.length > 0 && items.every((i) => i.status === 'APROVADO')) {
      status = 'CONCLUIDA';
    } else if (items.some((i) => (['RECEBIDO', 'APROVADO'] as RequestItemStatus[]).includes(i.status))) {
      status = 'PARCIAL';
    }
    await this.prisma.scoped.documentRequest.updateMany({
      where: { id: requestId, status: { not: 'CANCELADA' } },
      data: { status },
    });
    return status;
  }

  private tid(): string {
    const tenantId = TenantContext.get()?.tenantId;
    if (!tenantId) throw new ForbiddenException('Operação exige contexto de escritório');
    return tenantId;
  }
}
