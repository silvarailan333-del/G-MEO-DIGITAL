import crypto from 'crypto';
import { db } from '../db/index.ts';
import { securityEvents } from '../db/schema.ts';

export type SecurityEventType =
  | 'WAF_BLOCK'
  | 'SQLI_PROBE'
  | 'XSS_PROBE'
  | 'SSRF_ATTEMPT'
  | 'PATH_TRAVERSAL'
  | 'RATE_LIMIT'
  | 'BOT_BLOCKED'
  | 'AUTH_INVALID'
  | 'TENANT_FORBIDDEN'
  | 'UPLOAD_REJECTED'
  | 'CSRF_MISMATCH'
  | 'SCANNER_PROBE';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

const IP_HASH_SALT =
  process.env.SESSION_SECRET ||
  process.env.SQL_PASSWORD ||
  crypto.randomBytes(16).toString('hex');

export function hashIpAddress(ip: string): string {
  const normalized = (ip || 'unknown').trim();
  return crypto
    .createHmac('sha256', IP_HASH_SALT)
    .update(normalized)
    .digest('hex')
    .slice(0, 20);
}

export async function recordSecurityEvent(params: {
  eventType: SecurityEventType;
  severity?: SecuritySeverity;
  ip?: string;
  method?: string;
  path?: string;
  userId?: number | null;
  companyId?: number | null;
  cfRay?: string;
  cfCountry?: string;
  userAgent?: string;
  blocked?: boolean;
  details?: Record<string, unknown>;
}): Promise<void> {
  const severity = params.severity || 'medium';
  const ipHash = hashIpAddress(params.ip || 'unknown');
  const safePath = String(params.path || '').slice(0, 240);
  const safeMethod = String(params.method || '').slice(0, 12);
  const safeUa = String(params.userAgent || '').slice(0, 220);

  console.warn(
    JSON.stringify({
      tag: 'SECURITY_EVENT',
      timestamp: new Date().toISOString(),
      eventType: params.eventType,
      severity,
      ipHash,
      method: safeMethod,
      path: safePath,
      blocked: params.blocked ?? true,
      cfRay: params.cfRay || '',
      companyId: params.companyId ?? null,
    })
  );

  try {
    await db.insert(securityEvents).values({
      eventType: params.eventType,
      severity,
      ipHash,
      method: safeMethod,
      path: safePath,
      userId: params.userId ?? null,
      companyId: params.companyId ?? null,
      cfRay: String(params.cfRay || '').slice(0, 64),
      cfCountry: String(params.cfCountry || '').slice(0, 16),
      userAgent: safeUa,
      blocked: params.blocked ?? true,
      detailsJson: params.details || {},
    });
  } catch (err) {
    console.error(
      'Failed to persist security event:',
      err instanceof Error ? err.message : 'unknown'
    );
  }
}
