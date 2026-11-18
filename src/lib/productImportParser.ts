import * as XLSX from 'xlsx';

export interface ParsedCatalogItem {
  sku: string;
  name: string;
  priceReais: number;
  costReais: number;
  stockQty: number;
  categoryName: string;
}

export interface ParsedSalesItem {
  sku: string;
  name: string;
  soldUnits: number;
  priceReais: number;
}

function normalizeHeader(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseLocaleNumber(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const raw = String(val ?? '')
    .replace(/r\$/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!raw) return 0;
  // Handle Brazilian formatting like "1.234,56" vs standard "1234.56"
  const normalized =
    raw.includes(',') && raw.includes('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.includes(',')
      ? raw.replace(',', '.')
      : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function pickField(normRow: Record<string, unknown>, candidates: string[]): unknown {
  for (const cand of candidates) {
    if (normRow[cand] !== undefined && normRow[cand] !== null && String(normRow[cand]).trim() !== '') {
      return normRow[cand];
    }
  }
  // Partial key fallback
  const keys = Object.keys(normRow);
  for (const cand of candidates) {
    const found = keys.find((k) => k.includes(cand));
    if (found && normRow[found] !== undefined && String(normRow[found]).trim() !== '') {
      return normRow[found];
    }
  }
  return undefined;
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[normalizeHeader(k)] = v;
  }
  return out;
}

export function parseCatalogSpreadsheet(buffer: ArrayBuffer): {
  items: ParsedCatalogItem[];
  csvPreview: string;
} {
  const wb = XLSX.read(buffer, { type: 'array', cellHTML: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).slice(0, 5000);
  const csvPreview = XLSX.utils.sheet_to_csv(sheet).slice(0, 15000);

  const items: ParsedCatalogItem[] = [];
  for (const row of rawRows) {
    const norm = normalizeRowKeys(row);
    const sku = String(
      pickField(norm, ['codigo', 'cod', 'sku', 'referencia', 'ref', 'id_produto']) ?? ''
    ).trim();
    const name = String(
      pickField(norm, ['nome_produto', 'nome', 'produto', 'item', 'descricao', 'titulo']) ?? ''
    ).trim();
    if (!name && !sku) continue;

    const priceReais = Math.max(
      0,
      parseLocaleNumber(
        pickField(norm, ['preco_unitario', 'preco', 'valor_unitario', 'valor', 'preco_venda', 'price'])
      )
    );
    const costReais = Math.max(
      0,
      parseLocaleNumber(
        pickField(norm, ['custo_unitario', 'custo', 'custo_aquisicao', 'cost'])
      )
    );
    const stockQty = Math.max(
      0,
      Math.round(
        parseLocaleNumber(
          pickField(norm, ['estoque_atual', 'estoque', 'qtd_estoque', 'quantidade_estoque', 'saldo', 'quantidade', 'qtd', 'stock'])
        )
      )
    );
    const categoryName = String(
      pickField(norm, ['categoria', 'grupo', 'linha', 'departamento', 'category']) ?? ''
    ).trim();

    items.push({
      sku,
      name: name || sku,
      priceReais,
      costReais,
      stockQty,
      categoryName,
    });
  }

  return { items, csvPreview };
}

export function parseSalesUnitsSpreadsheet(buffer: ArrayBuffer): {
  items: ParsedSalesItem[];
  csvPreview: string;
} {
  const wb = XLSX.read(buffer, { type: 'array', cellHTML: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).slice(0, 5000);
  const csvPreview = XLSX.utils.sheet_to_csv(sheet).slice(0, 15000);

  const items: ParsedSalesItem[] = [];
  for (const row of rawRows) {
    const norm = normalizeRowKeys(row);
    const sku = String(
      pickField(norm, ['codigo', 'cod', 'sku', 'referencia', 'ref', 'id_produto']) ?? ''
    ).trim();
    const name = String(
      pickField(norm, ['nome_produto', 'nome', 'produto', 'item', 'descricao', 'titulo']) ?? ''
    ).trim();
    if (!name && !sku) continue;

    const soldUnits = Math.max(
      0,
      Math.round(
        parseLocaleNumber(
          pickField(norm, [
            'unidades_vendidas',
            'qtd_vendida',
            'quantidade_vendida',
            'vendidas',
            'vendas',
            'unidades',
            'quantidade',
            'qtd',
            'volume',
            'sold',
          ])
        )
      )
    );
    const priceReais = Math.max(
      0,
      parseLocaleNumber(
        pickField(norm, ['preco_unitario', 'preco', 'valor_unitario', 'valor'])
      )
    );

    items.push({
      sku,
      name: name || sku,
      soldUnits,
      priceReais,
    });
  }

  return { items, csvPreview };
}
