/**
 * Contratos compartilhados entre api, web e worker.
 * Fonte única de verdade para papéis, permissões, filas e o motor de datas.
 */

export * from './due-date';
export * from './cnpj';

export const ROLES = {
  SUPERADMIN: 'superadmin',
  TENANT_ADMIN: 'tenant_admin',
  ACCOUNTANT: 'accountant',
  CLIENT: 'client',
  AUDITOR: 'auditor',
} as const;
export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  TENANTS_MANAGE: 'tenants.manage',
  PLANS_MANAGE: 'plans.manage',
  USERS_MANAGE: 'users.manage',
  COMPANIES_READ: 'companies.read',
  COMPANIES_WRITE: 'companies.write',
  TASKS_READ: 'tasks.read',
  TASKS_WRITE: 'tasks.write',
  TASKS_APPROVE: 'tasks.approve',
  DOCUMENTS_READ: 'documents.read',
  DOCUMENTS_WRITE: 'documents.write',
  DOCUMENTS_REQUEST: 'documents.request',
  REPORTS_READ: 'reports.read',
  AUDIT_READ: 'audit.read',
  SETTINGS_MANAGE: 'settings.manage',
} as const;
export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Filas BullMQ — nomes centralizados para api (produtor) e worker (consumidor). */
export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  RECURRENCE: 'recurrence',
  REMINDERS: 'reminders',
  MAINTENANCE: 'maintenance',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Job de envio de e-mail (worker atualiza a Notification com o resultado). */
export interface NotificationJob {
  notificationId: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Tipos de documento mais solicitados (sugestões da UI; texto livre também vale). */
export const COMMON_DOCUMENT_TYPES = [
  'Extratos bancários',
  'Notas fiscais emitidas',
  'Notas fiscais recebidas',
  'Arquivos XML',
  'Notas de serviços',
  'Comprovantes de pagamento',
  'Folha de pagamento',
  'Documentos de admissão',
  'Documentos de demissão',
  'Movimentações financeiras',
  'Contratos',
  'Inventário',
] as const;

/** Upload: extensões e MIME permitidos + tamanho máximo (requisito 13). */
export const UPLOAD_ALLOWED_EXTENSIONS = [
  'pdf', 'xml', 'xls', 'xlsx', 'csv', 'jpg', 'jpeg', 'png', 'zip', 'txt', 'ofx',
] as const;
export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** Cores de status usadas em todo o produto (requisito 7). */
export const STATUS_COLORS = {
  regular: 'green',
  atencao: 'yellow',
  critico: 'red',
  naoIniciado: 'gray',
  emAndamento: 'blue',
} as const;
