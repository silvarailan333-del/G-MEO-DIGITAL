import { NextFunction, Request, Response } from 'express';
import { recordSecurityEvent, type SecurityEventType } from '../server/securityLogger.ts';
import { isPrivateOrMetadataHost, stripPrototypeKeys } from '../server/validation.ts';

export interface ClientSecurityContext {
  ip: string;
  protocol: 'http' | 'https';
  cfRay: string;
  cfCountry: string;
  userAgent: string;
}

export interface SecuredRequest extends Request {
  clientSecurity?: ClientSecurityContext;
}

export function extractClientSecurityContext(req: Request): ClientSecurityContext {
  const cfIp = typeof req.headers['cf-connecting-ip'] === 'string' ? req.headers['cf-connecting-ip'].trim() : '';
  const xffRaw = typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : '';
  const firstXff = xffRaw ? xffRaw.split(',')[0].trim() : '';
  const ip = cfIp || firstXff || req.ip || req.socket.remoteAddress || 'unknown';

  let protocol: 'http' | 'https' = req.secure ? 'https' : 'http';
  const cfVisitor = typeof req.headers['cf-visitor'] === 'string' ? req.headers['cf-visitor'] : '';
  if (cfVisitor.includes('"https"')) {
    protocol = 'https';
  } else if (typeof req.headers['x-forwarded-proto'] === 'string') {
    const proto = req.headers['x-forwarded-proto'].split(',')[0].trim().toLowerCase();
    if (proto === 'https') protocol = 'https';
  }

  return {
    ip,
    protocol,
    cfRay: typeof req.headers['cf-ray'] === 'string' ? req.headers['cf-ray'].trim() : '',
    cfCountry: typeof req.headers['cf-ipcountry'] === 'string' ? req.headers['cf-ipcountry'].trim() : '',
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
  };
}

function isLocalHostRequest(req: Request): boolean {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
}

export function httpsAndSecurityHeadersMiddleware(req: SecuredRequest, res: Response, next: NextFunction) {
  const ctx = extractClientSecurityContext(req);
  req.clientSecurity = ctx;

  // Enforce HTTPS behind Cloudflare / reverse proxy when enabled or in production (never break localhost)
  const enforceHttps = process.env.ENFORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production';
  if (enforceHttps && !isLocalHostRequest(req) && ctx.protocol === 'http') {
    const targetHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/[\r\n]/g, '');
    if (targetHost && req.method === 'GET') {
      return res.redirect(301, `https://${targetHost}${req.originalUrl}`);
    }
  }

  // HSTS when over HTTPS or in production
  if (ctx.protocol === 'https' || process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Core OWASP security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // Must allow popups for Firebase signInWithPopup (Google OAuth)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  const isDev = process.env.NODE_ENV !== 'production';
  const frameAncestors =
    process.env.CSP_FRAME_ANCESTORS ||
    "'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com";

  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    // Google Maps JS, Firebase Auth, Tailwind/Vite runtime scripts
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com https://www.gstatic.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com https://*.googleusercontent.com",
    "connect-src 'self' https://*.googleapis.com https://maps.googleapis.com https://maps.gstatic.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.firebaseio.com https://api.bcb.gov.br https://servicodados.ibge.gov.br https://brasilapi.com.br wss://*.firebaseio.com",
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com https://www.google.com",
    "worker-src 'self' blob:",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  if (req.path.startsWith('/api/beta/') || req.path === '/api/chat') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}

// Temporary IP strike/ban tracker for repeated WAF or DDoS violations
const ipViolationMap = new Map<string, { strikes: number; blockedUntil: number; lastSeen: number }>();

const SCANNER_UA_REGEX =
  /\b(sqlmap|nikto|acunetix|nuclei|masscan|wpscan|dirbuster|gobuster|havij|zgrab|nessus|openvas|nmap|ffuf)\b/i;

const PROBE_PATH_REGEX =
  /(\/\.env|\/\.git|\/\.htaccess|\/\.htpasswd|\/wp-admin|\/wp-login\.php|\/wp-content|\/phpmyadmin|\/pma\/|\/cgi-bin|\/etc\/passwd|\/server-status|\/actuator\/|\/xmlrpc\.php)/i;

const PATH_TRAVERSAL_REGEX = /(\.\.[/\\]|%2e%2e[%2f%5c]|%252e%252e)/i;

const SQLI_PROBE_REGEX =
  /(\bunion\s+(all\s+)?select\b|\bselect\b.+\bfrom\s+information_schema\b|(\bor\b|\band\b)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?|\b(pg_sleep|waitfor\s+delay|benchmark|sleep)\s*\(|;\s*(drop|truncate|alter|delete|insert|update)\s+(table|from|into)\b|--\s*$)/i;

const XSS_PROBE_REGEX =
  /(<\s*script\b|javascript\s*:|vbscript\s*:|\bon(error|load|mouseover|focus|click)\s*=|<\s*iframe\b|<\s*svg\b[^>]*on\w+=)/i;

const SSRF_METADATA_REGEX =
  /(169\.254\.169\.254|metadata\.google\.internal|100\.100\.100\.200)/i;

const SKIP_INSPECTION_KEYS = new Set([
  'base64Data',
  'dataBase64',
  'textContent',
  'history',
  'commentText',
]);

function recordWafStrike(ip: string): boolean {
  const now = Date.now();
  const entry = ipViolationMap.get(ip) || { strikes: 0, blockedUntil: 0, lastSeen: now };
  if (now - entry.lastSeen > 15 * 60 * 1000) {
    entry.strikes = 0;
  }
  entry.strikes += 1;
  entry.lastSeen = now;
  if (entry.strikes >= 8) {
    entry.blockedUntil = now + 5 * 60 * 1000;
  }
  ipViolationMap.set(ip, entry);
  return entry.blockedUntil > now;
}

function inspectObjectForAttacks(
  value: unknown,
  parentKey = '',
  depth = 0
): { hit: boolean; type: SecurityEventType; field: string } | null {
  if (depth > 8 || value === null || value === undefined) return null;
  if (SKIP_INSPECTION_KEYS.has(parentKey)) return null;

  if (typeof value === 'string') {
    if (value.length > 25000) return null; // binary/long payloads handled by upload/body limiters
    if (SQLI_PROBE_REGEX.test(value)) {
      return { hit: true, type: 'SQLI_PROBE', field: parentKey || 'query/body' };
    }
    if (XSS_PROBE_REGEX.test(value)) {
      return { hit: true, type: 'XSS_PROBE', field: parentKey || 'query/body' };
    }
    if (SSRF_METADATA_REGEX.test(value)) {
      return { hit: true, type: 'SSRF_ATTEMPT', field: parentKey || 'query/body' };
    }
    if (
      (parentKey === 'url' || parentKey === 'website' || parentKey === 'storeUrl' || parentKey === 'sourceUrl') &&
      /^https?:\/\//i.test(value)
    ) {
      try {
        const parsed = new URL(value);
        if (isPrivateOrMetadataHost(parsed.hostname)) {
          return { hit: true, type: 'SSRF_ATTEMPT', field: parentKey };
        }
      } catch {
        // invalid URL handled by route validator
      }
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < Math.min(value.length, 60); i++) {
      const res = inspectObjectForAttacks(value[i], parentKey, depth + 1);
      if (res) return res;
    }
    return null;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
        return { hit: true, type: 'WAF_BLOCK', field: k };
      }
      const res = inspectObjectForAttacks(v, k, depth + 1);
      if (res) return res;
    }
  }
  return null;
}

export function wafAndBotProtectionMiddleware(req: SecuredRequest, res: Response, next: NextFunction) {
  const ctx = req.clientSecurity || extractClientSecurityContext(req);
  const now = Date.now();

  if (req.originalUrl.length > 4096) {
    void recordSecurityEvent({
      eventType: 'WAF_BLOCK',
      severity: 'medium',
      ip: ctx.ip,
      method: req.method,
      path: req.path,
      cfRay: ctx.cfRay,
      cfCountry: ctx.cfCountry,
      userAgent: ctx.userAgent,
      details: { reason: 'URL_TOO_LONG' },
    });
    return res.status(414).json({ error: 'Requisição rejeitada: URI excede o limite permitido.' });
  }

  const ban = ipViolationMap.get(ctx.ip);
  if (ban && ban.blockedUntil > now) {
    return res.status(429).json({
      error: 'Acesso temporariamente bloqueado por múltiplas atividades suspeitas.',
    });
  }

  // 1. Offensive security scanner User-Agent blocking
  if (ctx.userAgent && SCANNER_UA_REGEX.test(ctx.userAgent)) {
    recordWafStrike(ctx.ip);
    void recordSecurityEvent({
      eventType: 'BOT_BLOCKED',
      severity: 'high',
      ip: ctx.ip,
      method: req.method,
      path: req.path,
      cfRay: ctx.cfRay,
      cfCountry: ctx.cfCountry,
      userAgent: ctx.userAgent,
      details: { reason: 'SCANNER_UA' },
    });
    return res.status(403).json({ error: 'Requisição bloqueada pela política de segurança.' });
  }

  // 2. Path traversal & sensitive file probes
  let decodedPath = req.path;
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch {
    decodedPath = req.path;
  }

  if (PATH_TRAVERSAL_REGEX.test(req.originalUrl) || PATH_TRAVERSAL_REGEX.test(decodedPath)) {
    recordWafStrike(ctx.ip);
    void recordSecurityEvent({
      eventType: 'PATH_TRAVERSAL',
      severity: 'high',
      ip: ctx.ip,
      method: req.method,
      path: req.path,
      cfRay: ctx.cfRay,
      cfCountry: ctx.cfCountry,
      userAgent: ctx.userAgent,
    });
    return res.status(403).json({ error: 'Caminho inválido bloqueado pela proteção de segurança.' });
  }

  if (PROBE_PATH_REGEX.test(decodedPath)) {
    recordWafStrike(ctx.ip);
    void recordSecurityEvent({
      eventType: 'SCANNER_PROBE',
      severity: 'medium',
      ip: ctx.ip,
      method: req.method,
      path: req.path,
      cfRay: ctx.cfRay,
      cfCountry: ctx.cfCountry,
      userAgent: ctx.userAgent,
    });
    return res.status(404).json({ error: 'Recurso não encontrado.' });
  }

  // 3. Strip prototype-pollution keys safely from query & body
  if (req.query && typeof req.query === 'object') {
    const queryCheck = inspectObjectForAttacks(req.query, 'query');
    if (queryCheck) {
      recordWafStrike(ctx.ip);
      void recordSecurityEvent({
        eventType: queryCheck.type,
        severity: 'high',
        ip: ctx.ip,
        method: req.method,
        path: req.path,
        cfRay: ctx.cfRay,
        cfCountry: ctx.cfCountry,
        userAgent: ctx.userAgent,
        details: { location: 'query', field: queryCheck.field },
      });
      return res.status(403).json({ error: 'Parâmetros bloqueados pelo firewall de aplicação.' });
    }
  }

  if (req.body && typeof req.body === 'object') {
    const bodyCheck = inspectObjectForAttacks(req.body, 'body');
    if (bodyCheck) {
      recordWafStrike(ctx.ip);
      void recordSecurityEvent({
        eventType: bodyCheck.type,
        severity: 'high',
        ip: ctx.ip,
        method: req.method,
        path: req.path,
        cfRay: ctx.cfRay,
        cfCountry: ctx.cfCountry,
        userAgent: ctx.userAgent,
        details: { location: 'body', field: bodyCheck.field },
      });
      return res.status(403).json({ error: 'Conteúdo bloqueado pelo firewall de aplicação.' });
    }
    req.body = stripPrototypeKeys(req.body);
  }

  next();
}

function getAllowedHostSet(req: Request): Set<string> {
  const hosts = new Set<string>();
  const hostHeader = String(req.headers.host || '').trim().toLowerCase();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').trim().toLowerCase();
  if (hostHeader) hosts.add(hostHeader);
  if (forwardedHost) hosts.add(forwardedHost);

  if (process.env.APP_URL) {
    try {
      hosts.add(new URL(process.env.APP_URL).host.toLowerCase());
    } catch {
      // ignore invalid APP_URL
    }
  }
  if (process.env.ALLOWED_ORIGINS) {
    for (const item of process.env.ALLOWED_ORIGINS.split(',')) {
      const cleaned = item.trim().toLowerCase();
      if (!cleaned) continue;
      try {
        hosts.add(cleaned.includes('://') ? new URL(cleaned).host.toLowerCase() : cleaned);
      } catch {
        hosts.add(cleaned);
      }
    }
  }
  return hosts;
}

function isOriginAllowed(originOrReferer: string, req: Request): boolean {
  try {
    const parsed = new URL(originOrReferer);
    const originHost = parsed.host.toLowerCase();
    const allowed = getAllowedHostSet(req);
    if (allowed.has(originHost)) return true;
    if (
      originHost.startsWith('localhost:') ||
      originHost === 'localhost' ||
      originHost.startsWith('127.0.0.1:') ||
      originHost === '127.0.0.1' ||
      originHost.endsWith('.run.app') ||
      originHost.endsWith('.aistudio.google.com')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function csrfAndOriginMiddleware(req: SecuredRequest, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) return next();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    return next();
  }

  const ctx = req.clientSecurity || extractClientSecurityContext(req);
  const contentType = String(req.headers['content-type'] || '').toLowerCase();

  // Reject simple cross-site HTML form POST MIME types on JSON APIs
  if (
    contentType &&
    (contentType.includes('application/x-www-form-urlencoded') || contentType.startsWith('text/plain'))
  ) {
    void recordSecurityEvent({
      eventType: 'CSRF_MISMATCH',
      severity: 'medium',
      ip: ctx.ip,
      method: req.method,
      path: req.path,
      cfRay: ctx.cfRay,
      cfCountry: ctx.cfCountry,
      userAgent: ctx.userAgent,
      details: { reason: 'DISALLOWED_CONTENT_TYPE', contentType },
    });
    return res.status(415).json({ error: 'Content-Type não permitido para mutações na API.' });
  }

  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (origin && !isOriginAllowed(origin, req)) {
    void recordSecurityEvent({
      eventType: 'CSRF_MISMATCH',
      severity: 'high',
      ip: ctx.ip,
      method: req.method,
      path: req.path,
      cfRay: ctx.cfRay,
      cfCountry: ctx.cfCountry,
      userAgent: ctx.userAgent,
      details: { reason: 'ORIGIN_MISMATCH', origin: origin.slice(0, 120) },
    });
    return res.status(403).json({ error: 'Origem da requisição não autorizada (proteção CSRF).' });
  }

  next();
}

interface RateLimitBucket {
  timestamps: number[];
}

export function createApiRateLimiter(options: {
  name: string;
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyByUser?: boolean;
}) {
  const buckets = new Map<string, RateLimitBucket>();

  // Periodic garbage collection for expired buckets
  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - options.windowMs;
    for (const [k, b] of buckets.entries()) {
      b.timestamps = b.timestamps.filter((t) => t > cutoff);
      if (b.timestamps.length === 0) buckets.delete(k);
    }
  }, Math.max(30000, options.windowMs));
  cleanupTimer.unref();

  return (req: SecuredRequest, res: Response, next: NextFunction) => {
    const ctx = req.clientSecurity || extractClientSecurityContext(req);
    const authReq = req as SecuredRequest & { dbUser?: { id: number } };
    const key =
      options.keyByUser && authReq.dbUser?.id
        ? `${options.name}:u:${authReq.dbUser.id}:${ctx.ip}`
        : `${options.name}:ip:${ctx.ip}`;

    const now = Date.now();
    const cutoff = now - options.windowMs;
    const bucket = buckets.get(key) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

    const remainingBefore = Math.max(0, options.maxRequests - bucket.timestamps.length);
    const resetSeconds = Math.ceil(options.windowMs / 1000);

    res.setHeader('RateLimit-Limit', String(options.maxRequests));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.timestamps.length >= options.maxRequests) {
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(Math.max(5, Math.ceil(resetSeconds / 2))));
      buckets.set(key, bucket);

      void recordSecurityEvent({
        eventType: 'RATE_LIMIT',
        severity: 'medium',
        ip: ctx.ip,
        method: req.method,
        path: req.path,
        userId: authReq.dbUser?.id ?? null,
        cfRay: ctx.cfRay,
        cfCountry: ctx.cfCountry,
        userAgent: ctx.userAgent,
        details: { limiter: options.name, maxRequests: options.maxRequests, windowMs: options.windowMs },
      });

      return res.status(429).json({
        error:
          options.message ||
          'Muitas requisições em curto período. Aguarde alguns instantes e tente novamente.',
      });
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);
    res.setHeader('RateLimit-Remaining', String(Math.max(0, remainingBefore - 1)));
    next();
  };
}
