import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { UPLOAD_ALLOWED_EXTENSIONS, UPLOAD_MAX_BYTES } from '@guardiao/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';
import { UploadDocumentDto } from './dto/documents.dto';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_MIME_PREFIXES = [
  'application/pdf',
  'application/xml',
  'text/xml',
  'text/csv',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'application/octet-stream', // alguns navegadores enviam OFX/XML assim; a extensão decide
];

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Validação de upload (requisitos 13/23): extensão, MIME e tamanho. */
  validateFile(file?: UploadedFileLike): asserts file is UploadedFileLike {
    if (!file || !file.buffer) throw new BadRequestException('Nenhum arquivo enviado (campo "file")');
    if (file.size > UPLOAD_MAX_BYTES) {
      throw new BadRequestException(`Arquivo excede o limite de ${UPLOAD_MAX_BYTES / 1024 / 1024} MB`);
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!UPLOAD_ALLOWED_EXTENSIONS.includes(ext as never)) {
      throw new BadRequestException(
        `Extensão ".${ext}" não permitida. Aceitas: ${UPLOAD_ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }
    if (!ALLOWED_MIME_PREFIXES.some((m) => file.mimetype.startsWith(m))) {
      throw new BadRequestException(`Tipo de conteúdo "${file.mimetype}" não permitido`);
    }
  }

  /** Cria documento novo ou anexa versão, gravando o binário no MinIO. */
  async storeUpload(
    dto: { companyId: string; documentId?: string; requestItemId?: string; name?: string; category?: string; competence?: string },
    file: UploadedFileLike,
  ) {
    const tenantId = this.tid();
    const uploadedById = TenantContext.get()?.userId ?? null;

    let document =
      dto.documentId != null
        ? await this.prisma.scoped.document.findFirst({
            where: { id: dto.documentId, companyId: dto.companyId, deletedAt: null },
          })
        : null;
    if (dto.documentId && !document) throw new NotFoundException('Documento não encontrado');

    if (!document) {
      document = await this.prisma.scoped.document.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          requestItemId: dto.requestItemId,
          name: dto.name?.trim() || file.originalname,
          category: dto.category,
          competence: dto.competence,
          uploadedById,
        },
      });
    }

    const last = await this.prisma.scoped.documentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { version: 'desc' },
    });
    const version = (last?.version ?? 0) + 1;
    const safeName = file.originalname.replace(/[^\p{L}\p{N}._-]/gu, '_').slice(-100);
    const objectKey = `${tenantId}/${dto.companyId}/${dto.competence ?? 'geral'}/${document.id}/v${version}-${randomUUID().slice(0, 8)}-${safeName}`;

    await this.storage.putObject(objectKey, file.buffer, file.mimetype);

    const versionRow = await this.prisma.scoped.documentVersion.create({
      data: {
        tenantId,
        documentId: document.id,
        version,
        objectKey,
        size: file.size,
        mimeType: file.mimetype,
        checksum: createHash('sha256').update(file.buffer).digest('hex'),
        uploadedById,
      },
    });

    await this.audit.log({
      action: 'documents.upload',
      entity: 'Document',
      entityId: document.id,
      after: { name: document.name, version, size: file.size, companyId: dto.companyId },
    });
    return { document, version: versionRow };
  }

  /** Upload direto pelo escritório (fora de solicitação). */
  async uploadByAccountant(dto: UploadDocumentDto, file: UploadedFileLike) {
    this.validateFile(file);
    const company = await this.prisma.scoped.company.findFirst({
      where: { id: dto.companyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return this.storeUpload(dto, file);
  }

  async list(companyId?: string, competence?: string) {
    return this.prisma.scoped.document.findMany({
      where: {
        deletedAt: null,
        ...(companyId ? { companyId } : {}),
        ...(competence ? { competence } : {}),
      },
      include: {
        company: { select: { id: true, razaoSocial: true } },
        uploadedBy: { select: { id: true, name: true } },
        versions: { orderBy: { version: 'desc' }, take: 1 },
        requestItem: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** Link temporário de download da última versão (auditado). */
  async downloadUrl(documentId: string) {
    const document = await this.prisma.scoped.document.findFirst({
      where: { id: documentId, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!document || document.versions.length === 0) {
      throw new NotFoundException('Documento não encontrado');
    }
    const latest = document.versions[0];
    const url = await this.storage.presignedDownloadUrl(latest.objectKey, document.name);
    await this.audit.log({
      action: 'documents.download',
      entity: 'Document',
      entityId: documentId,
      after: { version: latest.version },
    });
    return { url, expiresInSeconds: 300, name: document.name, version: latest.version };
  }

  private tid(): string {
    const tenantId = TenantContext.get()?.tenantId;
    if (!tenantId) throw new ForbiddenException('Operação exige contexto de escritório');
    return tenantId;
  }
}
