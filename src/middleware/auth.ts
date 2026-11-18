import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import { recordSecurityEvent } from '../server/securityLogger.ts';
import { extractClientSecurityContext } from './security.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    fullName: string;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const ctx = extractClientSecurityContext(req);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    void recordSecurityEvent({
      eventType: 'AUTH_INVALID',
      severity: 'low',
      ip: ctx.ip,
      method: req.method,
      path: req.path,
      cfRay: ctx.cfRay,
      cfCountry: ctx.cfCountry,
      userAgent: ctx.userAgent,
      details: { reason: 'MISSING_BEARER_TOKEN' },
    });
    return res.status(401).json({ error: 'Não autorizado: token ausente.' });
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length > 8192) {
    void recordSecurityEvent({
      eventType: 'AUTH_INVALID',
      severity: 'medium',
      ip: ctx.ip,
      method: req.method,
      path: req.path,
      cfRay: ctx.cfRay,
      cfCountry: ctx.cfCountry,
      userAgent: ctx.userAgent,
      details: { reason: 'MALFORMED_TOKEN_SIZE' },
    });
    return res.status(401).json({ error: 'Não autorizado: token inválido.' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || `${decodedToken.uid}@usuario.local`,
      typeof decodedToken.name === 'string' ? decodedToken.name : undefined
    );
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error instanceof Error ? error.message : 'invalid');
    void recordSecurityEvent({
      eventType: 'AUTH_INVALID',
      severity: 'medium',
      ip: ctx.ip,
      method: req.method,
      path: req.path,
      cfRay: ctx.cfRay,
      cfCountry: ctx.cfCountry,
      userAgent: ctx.userAgent,
      details: { reason: 'TOKEN_VERIFICATION_FAILED' },
    });
    return res.status(401).json({ error: 'Não autorizado: token inválido ou expirado.' });
  }
};
