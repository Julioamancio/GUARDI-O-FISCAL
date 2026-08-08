import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';

/**
 * Armazenamento de arquivos (MinIO/S3). Bucket PRIVADO — nenhum objeto é
 * acessível por URL pública; download apenas via link assinado com expiração
 * curta (requisito 17: "não permita acesso público direto aos arquivos").
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env.MINIO_BUCKET_DOCUMENTS ?? 'documentos';
  private readonly client = new Client({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ROOT_USER ?? '',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? '',
  });

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" criado`);
      }
    } catch (error) {
      // A API sobe mesmo com MinIO fora do ar; uploads falharão com erro claro.
      this.logger.error(`MinIO indisponível no boot: ${(error as Error).message}`);
    }
  }

  async putObject(objectKey: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  /** Link temporário de download (padrão 5 min), com nome amigável no navegador. */
  async presignedDownloadUrl(objectKey: string, filename: string, expirySeconds = 300): Promise<string> {
    const safeName = filename.replace(/[^\p{L}\p{N}._ -]/gu, '_');
    return this.client.presignedGetObject(this.bucket, objectKey, expirySeconds, {
      'response-content-disposition': `attachment; filename="${safeName}"`,
    });
  }

  async removeObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }

  /** Baixa o objeto inteiro em memória (uso interno: espelho de pastas). */
  async getObjectBuffer(objectKey: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }
}
