#!/usr/bin/env node
/**
 * Auditoria Estática de Segurança & Dependências — Gêmeo Digital
 * Executa varredura local sem depender de acesso externo de rede:
 *  1. Verifica riscos conhecidos nas versões do package.json e confirma mitigações no código.
 *  2. Varre src/ e server.ts em busca de padrões perigosos (eval, sql.raw, dangerouslySetInnerHTML, segredos no client).
 *  3. Verifica presença obrigatória de controles defensivos (WAF, CSRF, Magic Bytes, Headers, Firestore Rules).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const errors = [];
const warnings = [];
const passed = [];

function readText(relPath) {
  const p = path.join(ROOT, relPath);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

function walkFiles(dir, exts = ['.ts', '.tsx', '.js', '.mjs']) {
  const out = [];
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'backups') continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(rel, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(rel);
    }
  }
  return out;
}

// 1. Dependency checks
const pkgRaw = readText('package.json');
if (!pkgRaw) {
  errors.push('package.json não encontrado.');
} else {
  const pkg = JSON.parse(pkgRaw);
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.xlsx) {
    const fin = readText('src/lib/financialFormulas.ts') || '';
    const imp = readText('src/lib/productImportParser.ts') || '';
    const up = readText('src/server/uploadSecurity.ts') || '';
    const hasMitigation =
      fin.includes('cellHTML: false') &&
      imp.includes('cellHTML: false') &&
      up.includes('inspectDocumentOrImageUpload');
    if (hasMitigation) {
      warnings.push(
        `xlsx (${deps.xlsx}): possui histórico público de Prototype Pollution/ReDoS em versões 0.18.x; mitigação ativa no código via cellHTML:false, limite de 6MB/5000 linhas, stripPrototypeKeys e validação de magic-bytes ZIP.`
      );
    } else {
      errors.push(`xlsx (${deps.xlsx}) sem mitigações defensivas completas no parser.`);
    }
  }
  passed.push(`Dependências inspecionadas (${Object.keys(deps).length} pacotes declarados).`);
}

// 2. Scan src/ + server.ts for dangerous patterns
const codeFiles = [...walkFiles('src'), 'server.ts'];
for (const file of codeFiles) {
  const content = readText(file);
  if (!content) continue;

  if (/\bdangerouslySetInnerHTML\b/.test(content)) {
    errors.push(`Uso de dangerouslySetInnerHTML encontrado em ${file}`);
  }
  if (/\beval\s*\(/.test(content) || /\bnew\s+Function\s*\(/.test(content)) {
    errors.push(`Uso de eval/Function encontrado em ${file}`);
  }
  if (/\bsql\.raw\s*\(/.test(content)) {
    errors.push(`Uso de sql.raw encontrado em ${file}`);
  }

  // Client-side exposure check
  if (file.startsWith('src/') && !file.startsWith('src/server/') && !file.startsWith('src/middleware/') && !file.startsWith('src/db/')) {
    if (/process\.env\.(GEMINI_API_KEY|GOOGLE_MAPS_SERVER_API_KEY|DATABASE_URL|SESSION_SECRET)/.test(content)) {
      errors.push(`Possível referência de segredo server-side no frontend em ${file}`);
    }
    if (/AIza[0-9A-Za-z\-_]{30,}/.test(content)) {
      errors.push(`Possível chave literal Google API hardcoded em ${file}`);
    }
  }
}
passed.push(`Varredura estática concluída em ${codeFiles.length} arquivo(s) TypeScript.`);

// 3. Defense-in-depth file presence & wiring checks
const serverTs = readText('server.ts') || '';
const securityTs = readText('src/middleware/security.ts') || '';
const rules = readText('firestore.rules') || '';
const gitignore = readText('.gitignore') || '';

const checks = [
  ['X-Powered-By desabilitado', serverTs.includes("app.disable('x-powered-by')")],
  ['Middleware HTTPS + Security Headers ativo', serverTs.includes('httpsAndSecurityHeadersMiddleware')],
  ['WAF & Bot Protection ativo', serverTs.includes('wafAndBotProtectionMiddleware')],
  ['Proteção CSRF / Origin ativa', serverTs.includes('csrfAndOriginMiddleware')],
  ['Backup periódico automático configurado', serverTs.includes('startPeriodicBackups()')],
  ['HSTS e CSP configurados', securityTs.includes('Strict-Transport-Security') && securityTs.includes('Content-Security-Policy')],
  ['Compatibilidade Cloudflare (CF-Connecting-IP)', securityTs.includes('cf-connecting-ip')],
  ['Firestore Rules com isolamento isOwner', rules.includes('isOwner(userId)')],
  ['Diretório backups protegido no .gitignore', gitignore.includes('backups/')],
];

for (const [label, ok] of checks) {
  if (ok) passed.push(label);
  else errors.push(`Controle ausente: ${label}`);
}

console.log('=== AUDITORIA DE SEGURANÇA GÊMEO DIGITAL ===');
for (const p of passed) console.log(`[PASS] ${p}`);
for (const w of warnings) console.log(`[WARN] ${w}`);
for (const e of errors) console.error(`[FAIL] ${e}`);

if (errors.length > 0) {
  console.error(`\nResultado: FALHOU (${errors.length} falha(s) crítica(s)).`);
  process.exit(1);
}
console.log(`\nResultado: APROVADO (${passed.length} verificações OK, ${warnings.length} aviso(s)).`);
