import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { auditLogs, companies, companyMembers } from '../db/schema.ts';
import { recordSecurityEvent } from '../server/securityLogger.ts';

export async function getUserCompanyAccess(userId: number, companyId: number) {
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(companyId) || companyId <= 0) {
    return null;
  }
  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      return null;
    }

    if (company.ownerUserId === userId) {
      return { company, role: 'owner' as const };
    }

    const [membership] = await db
      .select()
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.companyId, companyId),
          eq(companyMembers.userId, userId),
          eq(companyMembers.status, 'active')
        )
      );

    if (!membership) {
      void recordSecurityEvent({
        eventType: 'TENANT_FORBIDDEN',
        severity: 'high',
        userId,
        companyId,
        details: { reason: 'CROSS_TENANT_ACCESS_DENIED' },
      });
      return null;
    }

    return { company, role: membership.role as 'owner' | 'admin' | 'editor' | 'viewer' };
  } catch (error) {
    console.error('Database query failed in getUserCompanyAccess:', error instanceof Error ? error.message : 'unknown');
    throw new Error('Erro ao validar permissões da empresa.');
  }
}

export async function recordAuditLog(params: {
  companyId: number;
  userId?: number;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId?: string | number;
  details?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      companyId: params.companyId,
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? '',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId !== undefined ? String(params.entityId) : '',
      detailsJson: params.details ?? {},
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
