import path from 'path';

export interface ValidatedUpload {
  ok: boolean;
  error?: string;
  safeFileName: string;
  detectedMimeType: string;
  buffer: Buffer;
  sizeBytes: number;
}

export function sanitizeUploadFileName(fileName: string, fallback = 'arquivo'): string {
  const base = path.basename(String(fileName || fallback));
  const cleaned = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '');
  return (cleaned || fallback).slice(0, 120);
}

function matchesPng(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

function matchesJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function matchesWebp(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function matchesPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-';
}

function matchesZipOrXlsx(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05) &&
    (buf[3] === 0x04 || buf[3] === 0x06)
  );
}

function matchesOleXls(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0 &&
    buf[4] === 0xa1 &&
    buf[5] === 0xb1 &&
    buf[6] === 0x1a &&
    buf[7] === 0xe1
  );
}

function containsExecutableOrScriptSignature(buf: Buffer): boolean {
  if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) return true; // PE/EXE MZ
  if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true; // ELF
  if (buf.length >= 2 && buf[0] === 0x23 && buf[1] === 0x21) return true; // shebang #!
  const headText = buf.subarray(0, 2048).toString('utf8').toLowerCase();
  if (
    headText.includes('<script') ||
    headText.includes('<?php') ||
    headText.includes('<svg') ||
    headText.includes('<html')
  ) {
    return true;
  }
  return false;
}

export function inspectImageUpload(params: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  maxBytes?: number;
}): ValidatedUpload {
  const maxBytes = params.maxBytes ?? 2.5 * 1024 * 1024;
  const safeFileName = sanitizeUploadFileName(params.fileName, 'imagem.png');

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(params.mimeType)) {
    return {
      ok: false,
      error: 'Formato permitido: PNG, JPEG ou WEBP.',
      safeFileName,
      detectedMimeType: '',
      buffer: Buffer.alloc(0),
      sizeBytes: 0,
    };
  }

  const cleanBase64 = params.dataBase64.includes(',')
    ? params.dataBase64.split(',')[1]
    : params.dataBase64;
  const estimatedBytes = Math.ceil((cleanBase64.length * 3) / 4);
  if (estimatedBytes > maxBytes + 1024) {
    return {
      ok: false,
      error: 'Imagem excede o limite de 2,5 MB.',
      safeFileName,
      detectedMimeType: '',
      buffer: Buffer.alloc(0),
      sizeBytes: estimatedBytes,
    };
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes) {
    return {
      ok: false,
      error: buffer.length === 0 ? 'Arquivo vazio.' : 'Imagem excede o limite de 2,5 MB.',
      safeFileName,
      detectedMimeType: '',
      buffer: Buffer.alloc(0),
      sizeBytes: buffer.length,
    };
  }

  let detectedMime = '';
  if (matchesPng(buffer)) detectedMime = 'image/png';
  else if (matchesJpeg(buffer)) detectedMime = 'image/jpeg';
  else if (matchesWebp(buffer)) detectedMime = 'image/webp';

  if (!detectedMime || detectedMime !== params.mimeType) {
    return {
      ok: false,
      error: 'Assinatura binária da imagem inválida ou incompatível com o tipo declarado.',
      safeFileName,
      detectedMimeType: detectedMime,
      buffer: Buffer.alloc(0),
      sizeBytes: buffer.length,
    };
  }

  return {
    ok: true,
    safeFileName,
    detectedMimeType: detectedMime,
    buffer,
    sizeBytes: buffer.length,
  };
}

export function inspectDocumentOrImageUpload(params: {
  fileName: string;
  mimeType: string;
  base64Data?: string;
  maxBytes?: number;
}): ValidatedUpload {
  const maxBytes = params.maxBytes ?? 6 * 1024 * 1024;
  const safeFileName = sanitizeUploadFileName(params.fileName, 'documento');
  const ext = path.extname(safeFileName).toLowerCase();

  if (!params.base64Data) {
    return {
      ok: true,
      safeFileName,
      detectedMimeType: params.mimeType || 'text/plain',
      buffer: Buffer.alloc(0),
      sizeBytes: 0,
    };
  }

  const cleanBase64 = params.base64Data.includes(',')
    ? params.base64Data.split(',')[1]
    : params.base64Data;
  const estimatedBytes = Math.ceil((cleanBase64.length * 3) / 4);
  if (estimatedBytes > maxBytes + 1024) {
    return {
      ok: false,
      error: 'Arquivo excede o limite de 6 MB.',
      safeFileName,
      detectedMimeType: '',
      buffer: Buffer.alloc(0),
      sizeBytes: estimatedBytes,
    };
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes) {
    return {
      ok: false,
      error: buffer.length === 0 ? 'Arquivo vazio.' : 'Arquivo excede o limite de 6 MB.',
      safeFileName,
      detectedMimeType: '',
      buffer: Buffer.alloc(0),
      sizeBytes: buffer.length,
    };
  }

  if (containsExecutableOrScriptSignature(buffer)) {
    return {
      ok: false,
      error: 'Arquivo bloqueado por conter assinatura executável ou script potencialmente malicioso.',
      safeFileName,
      detectedMimeType: '',
      buffer: Buffer.alloc(0),
      sizeBytes: buffer.length,
    };
  }

  if (ext === '.pdf' || params.mimeType === 'application/pdf') {
    if (!matchesPdf(buffer)) {
      return {
        ok: false,
        error: 'Arquivo PDF com assinatura binária inválida.',
        safeFileName,
        detectedMimeType: '',
        buffer: Buffer.alloc(0),
        sizeBytes: buffer.length,
      };
    }
    return { ok: true, safeFileName, detectedMimeType: 'application/pdf', buffer, sizeBytes: buffer.length };
  }

  if (ext === '.xlsx' || ext === '.xlsm') {
    if (!matchesZipOrXlsx(buffer)) {
      return {
        ok: false,
        error: 'Planilha XLSX com assinatura binária inválida.',
        safeFileName,
        detectedMimeType: '',
        buffer: Buffer.alloc(0),
        sizeBytes: buffer.length,
      };
    }
    return {
      ok: true,
      safeFileName,
      detectedMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
      sizeBytes: buffer.length,
    };
  }

  if (ext === '.xls') {
    if (!matchesOleXls(buffer) && !matchesZipOrXlsx(buffer)) {
      return {
        ok: false,
        error: 'Planilha XLS com assinatura binária inválida.',
        safeFileName,
        detectedMimeType: '',
        buffer: Buffer.alloc(0),
        sizeBytes: buffer.length,
      };
    }
    return { ok: true, safeFileName, detectedMimeType: 'application/vnd.ms-excel', buffer, sizeBytes: buffer.length };
  }

  if (matchesPng(buffer)) return { ok: true, safeFileName, detectedMimeType: 'image/png', buffer, sizeBytes: buffer.length };
  if (matchesJpeg(buffer)) return { ok: true, safeFileName, detectedMimeType: 'image/jpeg', buffer, sizeBytes: buffer.length };
  if (matchesWebp(buffer)) return { ok: true, safeFileName, detectedMimeType: 'image/webp', buffer, sizeBytes: buffer.length };

  if (ext === '.csv' || ext === '.txt' || params.mimeType.startsWith('text/')) {
    if (buffer.includes(0x00)) {
      return {
        ok: false,
        error: 'Arquivo texto contém bytes nulos inválidos.',
        safeFileName,
        detectedMimeType: '',
        buffer: Buffer.alloc(0),
        sizeBytes: buffer.length,
      };
    }
    return { ok: true, safeFileName, detectedMimeType: 'text/csv', buffer, sizeBytes: buffer.length };
  }

  return {
    ok: false,
    error: 'Tipo de arquivo não permitido. Use PNG, JPEG, WEBP, PDF, CSV ou XLSX.',
    safeFileName,
    detectedMimeType: '',
    buffer: Buffer.alloc(0),
    sizeBytes: buffer.length,
  };
}

export function verifyImageBufferSignature(buffer: Buffer, expectedMime: string): boolean {
  if (expectedMime === 'image/png') return matchesPng(buffer);
  if (expectedMime === 'image/jpeg') return matchesJpeg(buffer);
  if (expectedMime === 'image/webp') return matchesWebp(buffer);
  return false;
}
