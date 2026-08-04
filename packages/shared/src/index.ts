/**
 * Contratos compartilhados entre api, web e worker.
 * Fonte única de verdade para papéis, permissões e nomes de filas.
 */

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
  MAINTENANCE: 'maintenance',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Job de notificação (fase 3 liga o envio real de e-mail). */
export interface NotificationJob {
  tenantId: string;
  userId?: string;
  channel: 'email' | 'system';
  template: string;
  to: string;
  data: Record<string, unknown>;
}

/** Cores de status usadas em todo o produto (requisito 7). */
export const STATUS_COLORS = {
  regular: 'green',
  atencao: 'yellow',
  critico: 'red',
  naoIniciado: 'gray',
  emAndamento: 'blue',
} as const;
