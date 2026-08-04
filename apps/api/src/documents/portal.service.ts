import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TimelineService } from '../timeline/timeline.service';
import { TenantContext } from '../common/tenant-context';
import { DocumentsService, UploadedFileLike } from './documents.service';
import { DocumentRequestsService } from './document-requests.service';

/**
 * Portal do cliente. TODA consulta é dupla-filtrada: pelo tenant (extensão
 * scoped) e pelo vínculo explícito usuário-empresa (CompanyClientAccess) —
 * um cliente jamais enxerga outra empresa, nem do próprio escritório.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly requests: DocumentRequestsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  private async linkedCompanyIds(): Promise<string[]> {
    const userId = TenantContext.get()?.userId;
    if (!userId) return [];
    const accesses = await this.prisma.scoped.companyClientAccess.findMany({ where: { userId } });
    return accesses.map((a) => a.companyId);
  }

  async overview() {
    const companyIds = await this.linkedCompanyIds();
    const [companies, openRequests] = await Promise.all([
      this.prisma.scoped.company.findMany({
        where: { id: { in: companyIds }, deletedAt: null },
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
      }),
      this.prisma.scoped.documentRequest.count({
        where: { companyId: { in: companyIds }, deletedAt: null, status: { in: ['ABERTA', 'PARCIAL'] } },
      }),
    ]);
    return { companies, openRequests };
  }

  async listRequests() {
    const companyIds = await this.linkedCompanyIds();
    return this.prisma.scoped.documentRequest.findMany({
      where: { companyId: { in: companyIds }, deletedAt: null, status: { not: 'CANCELADA' } },
      include: {
        company: { select: { id: true, razaoSocial: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
      take: 50,
    });
  }

  /** Upload do cliente para um item solicitado (reenvio gera nova versão). */
  async uploadToItem(itemId: string, file: UploadedFileLike) {
    this.documents.validateFile(file);
    const companyIds = await this.linkedCompanyIds();

    const item = await this.prisma.scoped.documentRequestItem.findFirst({
      where: { id: itemId, request: { companyId: { in: companyIds }, deletedAt: null, status: { not: 'CANCELADA' } } },
      include: {
        request: { include: { createdBy: { select: { id: true, name: true, email: true } } } },
        documents: { where: { deletedAt: null }, take: 1 },
      },
    });
    if (!item) throw new NotFoundException('Item de solicitação não encontrado');

    const stored = await this.documents.storeUpload(
      {
        companyId: item.request.companyId,
        documentId: item.documents[0]?.id, // reenvio -> nova versão do mesmo documento
        requestItemId: item.id,
        name: item.name,
        competence: item.request.competence ?? undefined,
      },
      file,
    );

    await this.prisma.scoped.documentRequestItem.update({
      where: { id: itemId },
      data: { status: 'RECEBIDO', rejectionReason: null },
    });
    await this.requests.recomputeStatus(item.requestId);

    // Avisa quem solicitou
    if (item.request.createdBy) {
      await this.notifications.create({
        tenantId: item.tenantId,
        userId: item.request.createdBy.id,
        type: 'DOCUMENTO_RECEBIDO',
        title: `Documento recebido — ${item.name}`,
        body: `O cliente enviou "${file.originalname}" para a solicitação "${item.request.title}" (versão ${stored.version.version}).`,
        emailTo: item.request.createdBy.email,
        meta: { requestId: item.requestId, itemId, documentId: stored.document.id },
      });
    }

    await this.audit.log({
      action: 'portal.upload',
      entity: 'DocumentRequestItem',
      entityId: itemId,
      after: { file: file.originalname, size: file.size, version: stored.version.version },
    });
    await this.timeline.record({
      companyId: item.request.companyId,
      competence: item.request.competence,
      event: 'documento.recebido',
      description: `Cliente enviou "${file.originalname}" para o item "${item.name}" (versão ${stored.version.version}, ${Math.ceil(file.size / 1024)} KB)`,
      entity: 'Document',
      entityId: stored.document.id,
      meta: { checksum: stored.version.checksum },
    });
    return { itemId, status: 'RECEBIDO', documentId: stored.document.id, version: stored.version.version };
  }

  async listDocuments() {
    const companyIds = await this.linkedCompanyIds();
    return this.prisma.scoped.document.findMany({
      where: { companyId: { in: companyIds }, deletedAt: null },
      include: {
        company: { select: { id: true, razaoSocial: true } },
        versions: { orderBy: { version: 'desc' }, take: 1 },
        requestItem: { select: { name: true, status: true, rejectionReason: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Download pelo cliente: só de documentos das empresas vinculadas. */
  async downloadUrl(documentId: string) {
    const companyIds = await this.linkedCompanyIds();
    const document = await this.prisma.scoped.document.findFirst({
      where: { id: documentId, companyId: { in: companyIds }, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Documento não encontrado');
    return this.documents.downloadUrl(documentId);
  }
}
