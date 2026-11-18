import net from 'net';

export function parsePositiveIntParam(raw: unknown): number | null {
  const str = String(raw ?? '').trim();
  if (!/^\d{1,12}$/.test(str)) return null;
  const num = Number(str);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  return num;
}

export function sanitizePlainText(raw: unknown, maxLength = 2000): string {
  const s = String(raw ?? '')
    .replace(/\0/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|svg|style)[^>]*>/gi, '')
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .trim();
  return s.slice(0, maxLength);
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^metadata\.google\.internal$/i,
  /^169\.254\./,
  /^127\./,
  /^10\./,
  /^0\.0\.0\.0$/,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

export function isPrivateOrMetadataHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (PRIVATE_HOST_PATTERNS.some((rx) => rx.test(h))) return true;
  if (net.isIP(h)) {
    if (
      h.startsWith('127.') ||
      h.startsWith('10.') ||
      h.startsWith('169.254.') ||
      h.startsWith('192.168.') ||
      h === '0.0.0.0' ||
      h === '::1'
    ) {
      return true;
    }
  }
  return false;
}

export function sanitizeHttpUrl(
  raw: unknown,
  options: { allowRelativeAsset?: boolean; maxLength?: number } = {}
): string {
  const maxLength = options.maxLength ?? 1024;
  const val = String(raw ?? '').replace(/\0/g, '').trim();
  if (!val) return '';

  if (options.allowRelativeAsset && /^\/api\/beta\/assets\/\d+\?cid=\d+&sig=[a-f0-9]+$/i.test(val)) {
    return val.slice(0, maxLength);
  }

  const withProto = /^https?:\/\//i.test(val) ? val : `https://${val}`;
  try {
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    if (isPrivateOrMetadataHost(parsed.hostname)) {
      return '';
    }
    return parsed.toString().slice(0, maxLength);
  } catch {
    return '';
  }
}

export function sanitizeEmail(raw: unknown): string {
  const val = String(raw ?? '')
    .replace(/\0/g, '')
    .trim()
    .toLowerCase()
    .slice(0, 180);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return '';
  return val;
}

export function sanitizeCnpj(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 14);
}

export function sanitizePeriodMonth(raw: unknown): string {
  const val = String(raw ?? '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(val)) return val;
  return new Date().toISOString().slice(0, 7);
}

const FORBIDDEN_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function stripPrototypeKeys<T>(input: T, depth = 0): T {
  if (depth > 14 || input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripPrototypeKeys(item, depth + 1)) as unknown as T;
  }
  const cleanObj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN_PROTO_KEYS.has(k)) continue;
    cleanObj[k] = stripPrototypeKeys(v, depth + 1);
  }
  return cleanObj as T;
}

export function sanitizeErrorForClient(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const lower = raw.toLowerCase();
  if (
    lower.includes('sql') ||
    lower.includes('postgres') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('stack') ||
    lower.includes('api_key') ||
    lower.includes('password') ||
    raw.trim().startsWith('{')
  ) {
    return fallback;
  }
  return raw ? raw.slice(0, 220) : fallback;
}
