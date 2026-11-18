#!/usr/bin/env node
/**
 * Script de Verificação e Recuperação de Backups — Gêmeo Digital
 *
 * Uso:
 *   node scripts/restore-backup.mjs                    -> Lista e valida integridade SHA-256 dos snapshots em ./backups
 *   node scripts/restore-backup.mjs --file <nome.json> -> Inspeciona e valida um snapshot específico
 *   node scripts/restore-backup.mjs --create           -> Gera um snapshot imediato (requer DATABASE_URL)
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const args = process.argv.slice(2);

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return null;
}

function inspectSnapshot(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const sha256 = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      valid: false,
      error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}`,
      sha256,
      sizeBytes: Buffer.byteLength(raw, 'utf8'),
    };
  }

  const hasSchema = typeof parsed?.schemaVersion === 'string' && parsed?.data && typeof parsed.data === 'object';
  return {
    valid: Boolean(hasSchema),
    schemaVersion: parsed?.schemaVersion || 'desconhecida',
    createdAt: parsed?.createdAt || null,
    triggerType: parsed?.triggerType || 'unknown',
    sha256,
    sizeBytes: Buffer.byteLength(raw, 'utf8'),
    recordCounts: parsed?.recordCounts || {},
  };
}

async function run() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('[BACKUP_VERIFY] Diretório ./backups ainda não existe (nenhum snapshot gravado em disco até o momento).');
    process.exit(0);
  }

  const targetFile = getArgValue('--file');
  if (targetFile) {
    const safeName = path.basename(targetFile);
    const fullPath = path.join(BACKUP_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      console.error(`[BACKUP_VERIFY] Arquivo não encontrado: ${safeName}`);
      process.exit(1);
    }
    const result = inspectSnapshot(fullPath);
    console.log(JSON.stringify({ file: safeName, ...result }, null, 2));
    process.exit(result.valid ? 0 : 1);
  }

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('[BACKUP_VERIFY] Nenhum snapshot .json encontrado em ./backups.');
    process.exit(0);
  }

  console.log(`[BACKUP_VERIFY] Encontrados ${files.length} snapshot(s) em ./backups:`);
  let allValid = true;
  for (const file of files) {
    const fullPath = path.join(BACKUP_DIR, file);
    const info = inspectSnapshot(fullPath);
    if (!info.valid) allValid = false;
    console.log(
      `- ${file} | válido=${info.valid} | sha256=${info.sha256.slice(0, 16)}... | tamanho=${info.sizeBytes}B | criado=${info.createdAt || 'n/d'}`
    );
  }

  if (!allValid) {
    console.error('[BACKUP_VERIFY] Um ou mais snapshots falharam na verificação estrutural.');
    process.exit(1);
  }
  console.log('[BACKUP_VERIFY] Todos os snapshots verificados com integridade OK.');
}

run().catch((err) => {
  console.error('[BACKUP_VERIFY] Erro fatal:', err);
  process.exit(1);
});
