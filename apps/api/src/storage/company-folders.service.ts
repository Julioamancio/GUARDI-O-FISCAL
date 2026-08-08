import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { bibliotecaFolderSegments } from '@guardiao/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

// Caracteres proibidos em nomes de arquivo (Windows-safe, por causa de SFTP/cópias)
const FORBIDDEN_CHARS = new RegExp('[<>:"/\\\\|?*]', 'g');

/**
 * Espelho documental em PASTAS reais no disco da VPS.
 * Estrutura: <PASTAS_DIR>/<escritório>/<CNPJ - Razão Social>/<competência>/vN - nome - arquivo
 *
 * O MinIO continua sendo a fonte da verdade (links assinados, versões, checksum);
 * as pastas são a cópia organizada para consulta humana, SFTP e backup.
 * Regra de ouro: falha no espelho NUNCA derruba um upload — só loga.
 *
 * O diretório vem de PASTAS_DIR (padrão /dados-empresas, bind mount no compose).
 * Ressincronização: no boot e a cada 6 horas, baixa do MinIO o que faltar no disco
 * (cobre uploads feitos antes do recurso existir e restaurações de backup).
 */
@Injectable()
export class CompanyFoldersService implements OnModuleInit {
  private readonly logger = new Logger(CompanyFoldersService.name);
  private readonly baseDir = process.env.PASTAS_DIR ?? '/dados-empresas';

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    // Boot: espera a API assentar e ressincroniza; depois, a cada 6h.
    const timer = setTimeout(() => void this.resync(), 15_000);
    timer.unref?.();
    const loop = setInterval(() => void this.resync(), 6 * 60 * 60 * 1000);
    loop.unref?.();
  }

  /** Nome seguro para pasta/arquivo. */
  private sanitize(name: string): string {
    const clean = name.replace(FORBIDDEN_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    return clean || 'sem-nome';
  }

  /** Grava uma versão de documento na pasta da empresa (busca tudo pelo id da versão). */
  async mirrorVersion(versionId: string, buffer?: Buffer): Promise<void> {
    try {
      const version = await this.prisma.documentVersion.findUnique({
        where: { id: versionId },
        include: {
          document: { include: { company: { include: { tenant: { select: { slug: true } } } } } },
        },
      });
      if (!version) return;
      const company = version.document.company;
      // Categoria da Biblioteca vira subpasta legível (ex.: Declarações/PGDAS-D)
      const categoria = bibliotecaFolderSegments(version.document.category).map((s) => this.sanitize(s));
      const dir = join(
        this.baseDir,
        this.sanitize(company.tenant.slug),
        this.sanitize(`${company.cnpj} - ${company.razaoSocial}`),
        ...categoria,
        this.sanitize(version.document.competence ?? 'geral'),
      );
      const originalName = version.objectKey.split('/').pop()?.replace(/^v\d+-[0-9a-f]{8}-/, '') ?? 'arquivo';
      const fileName = this.sanitize(`v${version.version} - ${version.document.name} - ${originalName}`);
      const target = join(dir, fileName);

      const exists = await access(target).then(
        () => true,
        () => false,
      );
      if (exists) return;

      const data = buffer ?? (await this.storage.getObjectBuffer(version.objectKey));
      await mkdir(dir, { recursive: true });
      await writeFile(target, data);
    } catch (error) {
      this.logger.warn(`Espelho de pasta falhou para versão ${versionId}: ${(error as Error).message}`);
    }
  }

  /** Garante que todo documento do banco exista na pasta da sua empresa. */
  async resync(): Promise<void> {
    try {
      const versions = await this.prisma.documentVersion.findMany({
        where: { document: { deletedAt: null, company: { deletedAt: null } } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      for (const v of versions) {
        await this.mirrorVersion(v.id);
      }
      if (versions.length > 0) {
        this.logger.log(`Espelho de pastas conferido: ${versions.length} versão(ões) de documento`);
      }
    } catch (error) {
      this.logger.warn(`Ressincronização das pastas falhou: ${(error as Error).message}`);
    }
  }
}
