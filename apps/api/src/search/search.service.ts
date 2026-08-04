import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant-context';

const LIMIT = 8;

/**
 * Pesquisa global (requisito 31). Cada categoria só é pesquisada se o usuário
 * tiver a permissão correspondente — o cliente do portal, por exemplo, não
 * encontra tarefas nem usuários.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string) {
    const q = query.trim();
    if (q.length < 2) throw new BadRequestException('Digite ao menos 2 caracteres');
    const perms = new Set(TenantContext.get()?.permissions ?? []);
    const digits = q.replace(/\D/g, '');

    const [companies, tasks, documents, requests, users] = await Promise.all([
      perms.has('companies.read')
        ? this.prisma.scoped.company.findMany({
            where: {
              deletedAt: null,
              OR: [
                { razaoSocial: { contains: q, mode: 'insensitive' } },
                { nomeFantasia: { contains: q, mode: 'insensitive' } },
                ...(digits.length >= 4 ? [{ cnpj: { contains: digits } }] : []),
              ],
            },
            select: { id: true, razaoSocial: true, cnpj: true },
            take: LIMIT,
          })
        : [],
      perms.has('tasks.read')
        ? this.prisma.scoped.task.findMany({
            where: {
              deletedAt: null,
              OR: [{ title: { contains: q, mode: 'insensitive' } }, { competence: q }],
            },
            select: {
              id: true,
              title: true,
              competence: true,
              status: true,
              dueDate: true,
              company: { select: { razaoSocial: true } },
            },
            orderBy: { dueDate: 'desc' },
            take: LIMIT,
          })
        : [],
      perms.has('documents.read')
        ? this.prisma.scoped.document.findMany({
            where: { deletedAt: null, name: { contains: q, mode: 'insensitive' } },
            select: { id: true, name: true, competence: true, company: { select: { razaoSocial: true } } },
            orderBy: { createdAt: 'desc' },
            take: LIMIT,
          })
        : [],
      perms.has('documents.read')
        ? this.prisma.scoped.documentRequest.findMany({
            where: { deletedAt: null, title: { contains: q, mode: 'insensitive' } },
            select: { id: true, title: true, status: true, company: { select: { razaoSocial: true } } },
            orderBy: { createdAt: 'desc' },
            take: LIMIT,
          })
        : [],
      perms.has('users.manage')
        ? this.prisma.scoped.user.findMany({
            where: {
              deletedAt: null,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, name: true, email: true },
            take: LIMIT,
          })
        : [],
    ]);

    return { query: q, companies, tasks, documents, requests, users };
  }
}
