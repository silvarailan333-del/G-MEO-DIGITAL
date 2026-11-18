import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export interface FinancialSalesRow {
  id: number;
  periodMonth: string;
  categoryName: string;
  productName: string;
  unitsSold: number;
  unitPriceCents: number;
  unitCostCents: number;
  notes?: string;
}

export interface FinancialCostRow {
  id: number;
  periodMonth: string;
  categoryName: string;
  cmvSourceMode: string; // 'auto_vendas' | 'manual'
  cmvCents: number;
  freightCents: number;
  packagingCents: number;
  cardFeesCents: number;
  marketplaceFeesCents: number;
  lossesDamagesCents: number;
  otherVariableCostsCents: number;
  notes?: string;
}

export interface FinancialExpenseRow {
  id: number;
  periodMonth: string;
  costCenter: string;
  rentCents: number;
  payrollCents: number;
  waterCents: number;
  energyCents: number;
  internetCents: number;
  marketingCents: number;
  accountingCents: number;
  systemsCents: number;
  otherExpensesCents: number;
  notes?: string;
}

export interface InventoryControlRow {
  id: number;
  periodMonth: string;
  categoryName: string;
  sku: string;
  itemName: string;
  initialStock: number;
  purchasesQty: number;
  salesQty: number;
  lossesQty: number;
  unitCostCents: number;
  reorderPoint: number;
  periodDays: number;
  notes?: string;
}

export interface ComputedSalesRow extends FinancialSalesRow {
  revenueCents: number;
  cmvCents: number;
  grossProfitCents: number;
  grossMarginPct: number;
}

export interface ComputedCostRow extends FinancialCostRow {
  salesDerivedCmvCents: number;
  effectiveCmvCents: number;
  variableExtrasCents: number;
  totalCostsCents: number;
}

export interface ComputedExpenseRow extends FinancialExpenseRow {
  totalExpensesCents: number;
}

export type ReplenishmentStatus = 'ruptura' | 'repor' | 'atencao' | 'adequado';

export interface ComputedInventoryRow extends InventoryControlRow {
  finalStock: number;
  stockValueCents: number;
  dailySalesRate: number;
  coverageDays: number | null;
  replenishmentStatus: ReplenishmentStatus;
  replenishmentLabel: string;
  needsReplenishment: boolean;
}

export interface MonthlyDreRow {
  periodMonth: string;
  unitsSold: number;
  revenueCents: number;
  cmvCents: number;
  grossProfitCents: number;
  grossMarginPct: number;
  otherVariableCostsCents: number;
  contributionMarginCents: number;
  operatingExpensesCents: number;
  operatingResultCents: number;
  operatingMarginPct: number;
}

export interface CategorySalesAggregate {
  categoryName: string;
  unitsSold: number;
  revenueCents: number;
  cmvCents: number;
  grossProfitCents: number;
  grossMarginPct: number;
  inventoryValueCents: number;
  needsReplenishmentCount: number;
}

export interface FinancialSummaryBundle {
  hasData: boolean;
  totalRevenueCents: number;
  totalCmvCents: number;
  grossProfitCents: number;
  grossMarginPct: number;
  totalVariableCostsCents: number;
  totalCostsWithCmvCents: number;
  totalOperatingExpensesCents: number;
  operatingResultCents: number;
  operatingMarginPct: number;
  totalUnitsSold: number;
  totalInventoryValueCents: number;
  categoriesNeedingReplenishment: string[];
  criticalStockItemsCount: number;
  salesRows: ComputedSalesRow[];
  costRows: ComputedCostRow[];
  expenseRows: ComputedExpenseRow[];
  inventoryRows: ComputedInventoryRow[];
  monthlyDre: MonthlyDreRow[];
  byCategory: CategorySalesAggregate[];
  costBreakdown: {
    cmvCents: number;
    freightCents: number;
    packagingCents: number;
    cardFeesCents: number;
    marketplaceFeesCents: number;
    lossesDamagesCents: number;
    otherVariableCostsCents: number;
  };
  expenseBreakdown: {
    rentCents: number;
    payrollCents: number;
    waterCents: number;
    energyCents: number;
    internetCents: number;
    marketingCents: number;
    accountingCents: number;
    systemsCents: number;
    otherExpensesCents: number;
  };
}

export function formatBrlFromCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatPct(val: number): string {
  return `${Number.isFinite(val) ? val.toFixed(1).replace('.', ',') : '0,0'}%`;
}

export function computeFinancialSummary(params: {
  sales: FinancialSalesRow[];
  costs: FinancialCostRow[];
  expenses: FinancialExpenseRow[];
  inventory: InventoryControlRow[];
}): FinancialSummaryBundle {
  // 1. Vendas
  const salesRows: ComputedSalesRow[] = params.sales.map((s) => {
    const units = Math.max(0, Number(s.unitsSold || 0));
    const unitPrice = Math.max(0, Number(s.unitPriceCents || 0));
    const unitCost = Math.max(0, Number(s.unitCostCents || 0));
    const revenueCents = units * unitPrice;
    const cmvCents = units * unitCost;
    const grossProfitCents = revenueCents - cmvCents;
    const grossMarginPct = revenueCents > 0 ? (grossProfitCents / revenueCents) * 100 : 0;
    return {
      ...s,
      unitsSold: units,
      unitPriceCents: unitPrice,
      unitCostCents: unitCost,
      revenueCents,
      cmvCents,
      grossProfitCents,
      grossMarginPct,
    };
  });

  // Auto CMV map per periodMonth from Vendas
  const salesCmvByMonth: Record<string, number> = {};
  const salesRevenueByMonth: Record<string, number> = {};
  const salesUnitsByMonth: Record<string, number> = {};
  for (const sr of salesRows) {
    salesCmvByMonth[sr.periodMonth] = (salesCmvByMonth[sr.periodMonth] || 0) + sr.cmvCents;
    salesRevenueByMonth[sr.periodMonth] = (salesRevenueByMonth[sr.periodMonth] || 0) + sr.revenueCents;
    salesUnitsByMonth[sr.periodMonth] = (salesUnitsByMonth[sr.periodMonth] || 0) + sr.unitsSold;
  }

  // 2. Custos
  const costRows: ComputedCostRow[] = params.costs.map((c) => {
    const salesDerivedCmvCents = salesCmvByMonth[c.periodMonth] || 0;
    const effectiveCmvCents =
      c.cmvSourceMode === 'manual' ? Math.max(0, c.cmvCents) : salesDerivedCmvCents > 0 ? salesDerivedCmvCents : Math.max(0, c.cmvCents);
    const variableExtrasCents =
      Math.max(0, c.freightCents) +
      Math.max(0, c.packagingCents) +
      Math.max(0, c.cardFeesCents) +
      Math.max(0, c.marketplaceFeesCents) +
      Math.max(0, c.lossesDamagesCents) +
      Math.max(0, c.otherVariableCostsCents);
    const totalCostsCents = effectiveCmvCents + variableExtrasCents;
    return {
      ...c,
      salesDerivedCmvCents,
      effectiveCmvCents,
      variableExtrasCents,
      totalCostsCents,
    };
  });

  // 3. Despesas
  const expenseRows: ComputedExpenseRow[] = params.expenses.map((e) => {
    const totalExpensesCents =
      Math.max(0, e.rentCents) +
      Math.max(0, e.payrollCents) +
      Math.max(0, e.waterCents) +
      Math.max(0, e.energyCents) +
      Math.max(0, e.internetCents) +
      Math.max(0, e.marketingCents) +
      Math.max(0, e.accountingCents) +
      Math.max(0, e.systemsCents) +
      Math.max(0, e.otherExpensesCents);
    return {
      ...e,
      totalExpensesCents,
    };
  });

  // 4. Estoque
  const inventoryRows: ComputedInventoryRow[] = params.inventory.map((inv) => {
    const finalStock = Math.max(
      0,
      Number(inv.initialStock || 0) +
        Number(inv.purchasesQty || 0) -
        Number(inv.salesQty || 0) -
        Number(inv.lossesQty || 0)
    );
    const stockValueCents = finalStock * Math.max(0, Number(inv.unitCostCents || 0));
    const days = Math.max(1, Number(inv.periodDays || 30));
    const dailySalesRate = inv.salesQty > 0 ? inv.salesQty / days : 0;
    const coverageDays =
      dailySalesRate > 0 ? Math.round(finalStock / dailySalesRate) : null;

    let replenishmentStatus: ReplenishmentStatus = 'adequado';
    let replenishmentLabel = 'Estoque adequado';
    if (finalStock <= 0) {
      replenishmentStatus = 'ruptura';
      replenishmentLabel = 'Ruptura — repor imediatamente';
    } else if (finalStock <= inv.reorderPoint) {
      replenishmentStatus = 'repor';
      replenishmentLabel = 'Abaixo/no ponto de reposição';
    } else if (coverageDays !== null && coverageDays <= 15) {
      replenishmentStatus = 'atencao';
      replenishmentLabel = `Atenção (${coverageDays} dias de cobertura)`;
    }

    const needsReplenishment =
      replenishmentStatus === 'ruptura' ||
      replenishmentStatus === 'repor' ||
      replenishmentStatus === 'atencao';

    return {
      ...inv,
      finalStock,
      stockValueCents,
      dailySalesRate,
      coverageDays,
      replenishmentStatus,
      replenishmentLabel,
      needsReplenishment,
    };
  });

  // 5. Resultado (DRE) agrupado por mês
  const allMonthsSet = new Set<string>();
  for (const r of salesRows) allMonthsSet.add(r.periodMonth);
  for (const r of costRows) allMonthsSet.add(r.periodMonth);
  for (const r of expenseRows) allMonthsSet.add(r.periodMonth);
  const sortedMonths = Array.from(allMonthsSet).filter(Boolean).sort();

  const monthlyDre: MonthlyDreRow[] = sortedMonths.map((month) => {
    const monthSales = salesRows.filter((s) => s.periodMonth === month);
    const monthCosts = costRows.filter((c) => c.periodMonth === month);
    const monthExpenses = expenseRows.filter((e) => e.periodMonth === month);

    const unitsSold = monthSales.reduce((a, b) => a + b.unitsSold, 0);
    const revenueCents = monthSales.reduce((a, b) => a + b.revenueCents, 0);
    const salesCmv = monthSales.reduce((a, b) => a + b.cmvCents, 0);

    // If month has manual CMV records in Custos and no Vendas CMV, or explicit manual override
    const manualCmv = monthCosts
      .filter((c) => c.cmvSourceMode === 'manual')
      .reduce((a, b) => a + b.cmvCents, 0);
    const fallbackCmv = monthCosts
      .filter((c) => c.cmvSourceMode !== 'manual')
      .reduce((a, b) => a + b.cmvCents, 0);
    const cmvCents =
      salesCmv > 0
        ? manualCmv > 0
          ? manualCmv
          : salesCmv
        : manualCmv + fallbackCmv;

    const grossProfitCents = revenueCents - cmvCents;
    const grossMarginPct = revenueCents > 0 ? (grossProfitCents / revenueCents) * 100 : 0;
    const otherVariableCostsCents = monthCosts.reduce((a, b) => a + b.variableExtrasCents, 0);
    const contributionMarginCents = grossProfitCents - otherVariableCostsCents;
    const operatingExpensesCents = monthExpenses.reduce((a, b) => a + b.totalExpensesCents, 0);
    const operatingResultCents = contributionMarginCents - operatingExpensesCents;
    const operatingMarginPct =
      revenueCents > 0 ? (operatingResultCents / revenueCents) * 100 : 0;

    return {
      periodMonth: month,
      unitsSold,
      revenueCents,
      cmvCents,
      grossProfitCents,
      grossMarginPct,
      otherVariableCostsCents,
      contributionMarginCents,
      operatingExpensesCents,
      operatingResultCents,
      operatingMarginPct,
    };
  });

  // 6. Resumo Consolidado
  const totalRevenueCents = monthlyDre.reduce((a, b) => a + b.revenueCents, 0);
  const totalCmvCents = monthlyDre.reduce((a, b) => a + b.cmvCents, 0);
  const grossProfitCents = totalRevenueCents - totalCmvCents;
  const grossMarginPct =
    totalRevenueCents > 0 ? (grossProfitCents / totalRevenueCents) * 100 : 0;
  const totalVariableCostsCents = monthlyDre.reduce((a, b) => a + b.otherVariableCostsCents, 0);
  const totalCostsWithCmvCents = totalCmvCents + totalVariableCostsCents;
  const totalOperatingExpensesCents = monthlyDre.reduce(
    (a, b) => a + b.operatingExpensesCents,
    0
  );
  const operatingResultCents =
    grossProfitCents - totalVariableCostsCents - totalOperatingExpensesCents;
  const operatingMarginPct =
    totalRevenueCents > 0 ? (operatingResultCents / totalRevenueCents) * 100 : 0;
  const totalUnitsSold = salesRows.reduce((a, b) => a + b.unitsSold, 0);
  const totalInventoryValueCents = inventoryRows.reduce((a, b) => a + b.stockValueCents, 0);

  const criticalItems = inventoryRows.filter((i) => i.needsReplenishment);
  const categoriesNeedingReplenishment = Array.from(
    new Set(criticalItems.map((i) => i.categoryName).filter(Boolean))
  );

  // Category Breakdown
  const catMap: Record<string, CategorySalesAggregate> = {};
  const ensureCat = (catName: string) => {
    const key = catName.trim() || 'Sem categoria';
    if (!catMap[key]) {
      catMap[key] = {
        categoryName: key,
        unitsSold: 0,
        revenueCents: 0,
        cmvCents: 0,
        grossProfitCents: 0,
        grossMarginPct: 0,
        inventoryValueCents: 0,
        needsReplenishmentCount: 0,
      };
    }
    return catMap[key];
  };

  for (const sr of salesRows) {
    const agg = ensureCat(sr.categoryName);
    agg.unitsSold += sr.unitsSold;
    agg.revenueCents += sr.revenueCents;
    agg.cmvCents += sr.cmvCents;
    agg.grossProfitCents += sr.grossProfitCents;
  }
  for (const inv of inventoryRows) {
    const agg = ensureCat(inv.categoryName);
    agg.inventoryValueCents += inv.stockValueCents;
    if (inv.needsReplenishment) agg.needsReplenishmentCount += 1;
  }
  const byCategory = Object.values(catMap)
    .map((c) => ({
      ...c,
      grossMarginPct: c.revenueCents > 0 ? (c.grossProfitCents / c.revenueCents) * 100 : 0,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  const costBreakdown = {
    cmvCents: totalCmvCents,
    freightCents: costRows.reduce((a, b) => a + b.freightCents, 0),
    packagingCents: costRows.reduce((a, b) => a + b.packagingCents, 0),
    cardFeesCents: costRows.reduce((a, b) => a + b.cardFeesCents, 0),
    marketplaceFeesCents: costRows.reduce((a, b) => a + b.marketplaceFeesCents, 0),
    lossesDamagesCents: costRows.reduce((a, b) => a + b.lossesDamagesCents, 0),
    otherVariableCostsCents: costRows.reduce((a, b) => a + b.otherVariableCostsCents, 0),
  };

  const expenseBreakdown = {
    rentCents: expenseRows.reduce((a, b) => a + b.rentCents, 0),
    payrollCents: expenseRows.reduce((a, b) => a + b.payrollCents, 0),
    waterCents: expenseRows.reduce((a, b) => a + b.waterCents, 0),
    energyCents: expenseRows.reduce((a, b) => a + b.energyCents, 0),
    internetCents: expenseRows.reduce((a, b) => a + b.internetCents, 0),
    marketingCents: expenseRows.reduce((a, b) => a + b.marketingCents, 0),
    accountingCents: expenseRows.reduce((a, b) => a + b.accountingCents, 0),
    systemsCents: expenseRows.reduce((a, b) => a + b.systemsCents, 0),
    otherExpensesCents: expenseRows.reduce((a, b) => a + b.otherExpensesCents, 0),
  };

  return {
    hasData:
      salesRows.length > 0 ||
      costRows.length > 0 ||
      expenseRows.length > 0 ||
      inventoryRows.length > 0,
    totalRevenueCents,
    totalCmvCents,
    grossProfitCents,
    grossMarginPct,
    totalVariableCostsCents,
    totalCostsWithCmvCents,
    totalOperatingExpensesCents,
    operatingResultCents,
    operatingMarginPct,
    totalUnitsSold,
    totalInventoryValueCents,
    categoriesNeedingReplenishment,
    criticalStockItemsCount: criticalItems.length,
    salesRows,
    costRows,
    expenseRows,
    inventoryRows,
    monthlyDre,
    byCategory,
    costBreakdown,
    expenseBreakdown,
  };
}

// Helper to parse flexible PT-BR numbers/currency strings to cents
function parseMoneyToCents(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw * 100) : 0;
  }
  const str = String(raw ?? '')
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!str) return 0;
  // Handle 1.234,56 vs 1234.56
  const normalized =
    str.includes(',') && str.includes('.')
      ? str.replace(/\./g, '').replace(',', '.')
      : str.includes(',')
      ? str.replace(',', '.')
      : str;
  const num = Number(normalized);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function parseIntSafe(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : 0;
  const normalized = String(raw ?? '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalizeHeaderKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pickField(row: Record<string, unknown>, candidates: string[]): unknown {
  const entries = Object.entries(row).map(([k, v]) => [normalizeHeaderKey(k), v] as const);
  for (const cand of candidates) {
    const found = entries.find(([k]) => k === cand || k.includes(cand));
    if (found && found[1] !== undefined && found[1] !== '') return found[1];
  }
  return '';
}

function normalizeMonthString(raw: unknown): string {
  const str = String(raw ?? '').trim();
  if (!str) return new Date().toISOString().slice(0, 7);
  if (/^\d{4}-\d{2}/.test(str)) return str.slice(0, 7);
  const brMatch = str.match(/^(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[2]}-${brMatch[1]}`;
  return str.slice(0, 7);
}

export interface ParsedFinancialWorkbookResult {
  sales: Array<Omit<FinancialSalesRow, 'id'>>;
  costs: Array<Omit<FinancialCostRow, 'id'>>;
  expenses: Array<Omit<FinancialExpenseRow, 'id'>>;
  inventory: Array<Omit<InventoryControlRow, 'id'>>;
  detectedSheets: string[];
}

export function parseFinancialWorkbookBuffer(buffer: ArrayBuffer): ParsedFinancialWorkbookResult {
  if (buffer.byteLength > 6 * 1024 * 1024) {
    throw new Error('Planilha excede o limite de segurança de 6 MB.');
  }
  const wb = XLSX.read(buffer, { type: 'array', cellHTML: false });
  const sales: Array<Omit<FinancialSalesRow, 'id'>> = [];
  const costs: Array<Omit<FinancialCostRow, 'id'>> = [];
  const expenses: Array<Omit<FinancialExpenseRow, 'id'>> = [];
  const inventory: Array<Omit<InventoryControlRow, 'id'>> = [];

  for (const sheetName of wb.SheetNames.slice(0, 20)) {
    const normSheet = normalizeHeaderKey(sheetName);
    const sheet = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const rows = rawRows.slice(0, 5000).map((row) => {
      const safe: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        safe[k] = v;
      }
      return safe;
    });
    if (rows.length === 0) continue;

    if (normSheet.includes('venda')) {
      for (const r of rows) {
        const cat = String(pickField(r, ['categoria', 'category', 'segmento']) || '').trim();
        const units = parseIntSafe(pickField(r, ['unidades_vendidas', 'unidades', 'qtd', 'quantidade']));
        const unitPriceCents = parseMoneyToCents(pickField(r, ['preco_unitario', 'preco', 'valor_unitario']));
        const unitCostCents = parseMoneyToCents(pickField(r, ['custo_unitario', 'custo']));
        if (!cat && units === 0 && unitPriceCents === 0) continue;
        sales.push({
          periodMonth: normalizeMonthString(pickField(r, ['mes', 'periodo', 'competencia', 'data'])),
          categoryName: cat || 'Geral',
          productName: String(pickField(r, ['produto', 'item', 'descricao']) || '').trim(),
          unitsSold: Math.max(0, units),
          unitPriceCents: Math.max(0, unitPriceCents),
          unitCostCents: Math.max(0, unitCostCents),
          notes: String(pickField(r, ['obs', 'observacoes', 'nota']) || '').trim(),
        });
      }
    } else if (normSheet.includes('custo')) {
      for (const r of rows) {
        const freightCents = parseMoneyToCents(pickField(r, ['frete']));
        const packagingCents = parseMoneyToCents(pickField(r, ['embalagem', 'embalagens']));
        const cardFeesCents = parseMoneyToCents(pickField(r, ['cartao', 'taxas_cartao', 'taxa_cartao']));
        const marketplaceFeesCents = parseMoneyToCents(pickField(r, ['marketplace', 'taxas_marketplace']));
        const lossesDamagesCents = parseMoneyToCents(pickField(r, ['perdas', 'avarias', 'perdas_e_avarias']));
        const cmvCents = parseMoneyToCents(pickField(r, ['cmv']));
        const otherVariableCostsCents = parseMoneyToCents(pickField(r, ['outros', 'outros_custos']));
        if (
          freightCents +
            packagingCents +
            cardFeesCents +
            marketplaceFeesCents +
            lossesDamagesCents +
            cmvCents +
            otherVariableCostsCents ===
          0
        ) {
          continue;
        }
        costs.push({
          periodMonth: normalizeMonthString(pickField(r, ['mes', 'periodo', 'competencia'])),
          categoryName: String(pickField(r, ['categoria', 'centro']) || 'Geral').trim(),
          cmvSourceMode: cmvCents > 0 ? 'manual' : 'auto_vendas',
          cmvCents,
          freightCents,
          packagingCents,
          cardFeesCents,
          marketplaceFeesCents,
          lossesDamagesCents,
          otherVariableCostsCents,
          notes: String(pickField(r, ['obs', 'observacoes']) || '').trim(),
        });
      }
    } else if (normSheet.includes('despesa')) {
      for (const r of rows) {
        const rentCents = parseMoneyToCents(pickField(r, ['aluguel']));
        const payrollCents = parseMoneyToCents(pickField(r, ['salarios', 'encargos', 'folha']));
        const waterCents = parseMoneyToCents(pickField(r, ['agua']));
        const energyCents = parseMoneyToCents(pickField(r, ['energia', 'luz']));
        const internetCents = parseMoneyToCents(pickField(r, ['internet', 'telefone']));
        const marketingCents = parseMoneyToCents(pickField(r, ['marketing', 'publicidade']));
        const accountingCents = parseMoneyToCents(pickField(r, ['contabilidade', 'contador']));
        const systemsCents = parseMoneyToCents(pickField(r, ['sistemas', 'software', 'erp']));
        const otherExpensesCents = parseMoneyToCents(pickField(r, ['outras', 'outras_despesas']));
        if (
          rentCents +
            payrollCents +
            waterCents +
            energyCents +
            internetCents +
            marketingCents +
            accountingCents +
            systemsCents +
            otherExpensesCents ===
          0
        ) {
          continue;
        }
        expenses.push({
          periodMonth: normalizeMonthString(pickField(r, ['mes', 'periodo', 'competencia'])),
          costCenter: String(pickField(r, ['centro', 'unidade', 'categoria']) || 'Operação').trim(),
          rentCents,
          payrollCents,
          waterCents,
          energyCents,
          internetCents,
          marketingCents,
          accountingCents,
          systemsCents,
          otherExpensesCents,
          notes: String(pickField(r, ['obs', 'observacoes']) || '').trim(),
        });
      }
    } else if (normSheet.includes('estoque')) {
      for (const r of rows) {
        const itemName = String(pickField(r, ['item', 'produto', 'nome', 'descricao']) || '').trim();
        const categoryName = String(pickField(r, ['categoria', 'grupo']) || 'Geral').trim();
        const initialStock = parseIntSafe(pickField(r, ['estoque_inicial', 'inicial']));
        const purchasesQty = parseIntSafe(pickField(r, ['compras', 'entradas']));
        const salesQty = parseIntSafe(pickField(r, ['vendas', 'saidas']));
        const lossesQty = parseIntSafe(pickField(r, ['perdas', 'avarias']));
        const unitCostCents = parseMoneyToCents(pickField(r, ['custo_unitario', 'custo']));
        const reorderPoint = Math.max(0, parseIntSafe(pickField(r, ['ponto_reposicao', 'ponto_de_reposicao', 'minimo'])) || 10);
        const periodDays = Math.max(1, parseIntSafe(pickField(r, ['dias', 'periodo_dias'])) || 30);
        if (!itemName && initialStock === 0 && purchasesQty === 0) continue;
        inventory.push({
          periodMonth: normalizeMonthString(pickField(r, ['mes', 'periodo', 'competencia'])),
          categoryName,
          sku: String(pickField(r, ['sku', 'codigo']) || '').trim(),
          itemName: itemName || categoryName,
          initialStock: Math.max(0, initialStock),
          purchasesQty: Math.max(0, purchasesQty),
          salesQty: Math.max(0, salesQty),
          lossesQty: Math.max(0, lossesQty),
          unitCostCents: Math.max(0, unitCostCents),
          reorderPoint,
          periodDays,
          notes: String(pickField(r, ['obs', 'observacoes']) || '').trim(),
        });
      }
    }
  }

  return {
    sales,
    costs,
    expenses,
    inventory,
    detectedSheets: wb.SheetNames,
  };
}

export function downloadFinancialBlankTemplateExcel(companyName: string) {
  const wb = XLSX.utils.book_new();
  const currentMonth = new Date().toISOString().slice(0, 7);

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Indicador: 'Este arquivo segue a estrutura das 6 abas (Resumo, Vendas, Custos, Despesas, Resultado, Estoque).',
        Empresa: companyName,
        Instrucao: 'Preencha apenas suas abas de Vendas, Custos, Despesas e Estoque com dados reais da sua empresa.',
      },
    ]),
    'Resumo'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Mes: currentMonth,
        Categoria: '',
        Produto: '',
        Unidades_Vendidas: '',
        Preco_Unitario_R$: '',
        Custo_Unitario_R$: '',
        Observacoes: '',
      },
    ]),
    'Vendas'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Mes: currentMonth,
        Categoria: 'Geral',
        CMV_Manual_Opcional_R$: '',
        Frete_R$: '',
        Embalagens_R$: '',
        Taxas_Cartao_R$: '',
        Taxas_Marketplace_R$: '',
        Perdas_e_Avarias_R$: '',
        Outros_Custos_Variaveis_R$: '',
        Observacoes: '',
      },
    ]),
    'Custos'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Mes: currentMonth,
        Centro_Custo: 'Operação',
        Aluguel_R$: '',
        Salarios_Encargos_R$: '',
        Agua_R$: '',
        Energia_R$: '',
        Internet_R$: '',
        Marketing_R$: '',
        Contabilidade_R$: '',
        Sistemas_R$: '',
        Outras_Despesas_R$: '',
        Observacoes: '',
      },
    ]),
    'Despesas'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Mes: currentMonth,
        Observacao: 'Calculado automaticamente pela plataforma a partir das abas Vendas, Custos e Despesas.',
      },
    ]),
    'Resultado'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Mes: currentMonth,
        Categoria: '',
        SKU: '',
        Item: '',
        Estoque_Inicial: '',
        Compras: '',
        Vendas: '',
        Perdas: '',
        Custo_Unitario_R$: '',
        Ponto_de_Reposicao: 10,
        Periodo_Dias: 30,
        Observacoes: '',
      },
    ]),
    'Estoque'
  );

  XLSX.writeFile(wb, 'Modelo_6_Abas_Vendas_Custos_Despesas_Estoque.xlsx');
}

export function exportFinancialWorkbookExcel(
  companyName: string,
  summary: FinancialSummaryBundle
) {
  const wb = XLSX.utils.book_new();

  // 1. Resumo
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Indicador: 'Empresa', Valor: companyName },
      { Indicador: 'Receita Total (R$)', Valor: Number((summary.totalRevenueCents / 100).toFixed(2)) },
      { Indicador: 'CMV Total (R$)', Valor: Number((summary.totalCmvCents / 100).toFixed(2)) },
      { Indicador: 'Lucro Bruto (R$)', Valor: Number((summary.grossProfitCents / 100).toFixed(2)) },
      { Indicador: 'Margem Bruta (%)', Valor: Number(summary.grossMarginPct.toFixed(2)) },
      { Indicador: 'Outros Custos Variáveis (R$)', Valor: Number((summary.totalVariableCostsCents / 100).toFixed(2)) },
      { Indicador: 'Despesas Operacionais (R$)', Valor: Number((summary.totalOperatingExpensesCents / 100).toFixed(2)) },
      { Indicador: 'Resultado Operacional (R$)', Valor: Number((summary.operatingResultCents / 100).toFixed(2)) },
      { Indicador: 'Margem Operacional (%)', Valor: Number(summary.operatingMarginPct.toFixed(2)) },
      { Indicador: 'Unidades Vendidas', Valor: summary.totalUnitsSold },
      { Indicador: 'Valor em Estoque (R$)', Valor: Number((summary.totalInventoryValueCents / 100).toFixed(2)) },
      {
        Indicador: 'Categorias que Precisam Reposição',
        Valor: summary.categoriesNeedingReplenishment.join(', ') || 'Nenhuma',
      },
    ]),
    'Resumo'
  );

  // 2. Vendas
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summary.salesRows.map((s) => ({
        Mes: s.periodMonth,
        Categoria: s.categoryName,
        Produto: s.productName || '-',
        Unidades_Vendidas: s.unitsSold,
        Preco_Unitario_R$: Number((s.unitPriceCents / 100).toFixed(2)),
        Custo_Unitario_R$: Number((s.unitCostCents / 100).toFixed(2)),
        Receita_R$: Number((s.revenueCents / 100).toFixed(2)),
        CMV_R$: Number((s.cmvCents / 100).toFixed(2)),
        Lucro_Bruto_R$: Number((s.grossProfitCents / 100).toFixed(2)),
        Margem_Bruta_Pct: Number(s.grossMarginPct.toFixed(2)),
      }))
    ),
    'Vendas'
  );

  // 3. Custos
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summary.costRows.map((c) => ({
        Mes: c.periodMonth,
        Categoria: c.categoryName,
        CMV_R$: Number((c.effectiveCmvCents / 100).toFixed(2)),
        Frete_R$: Number((c.freightCents / 100).toFixed(2)),
        Embalagens_R$: Number((c.packagingCents / 100).toFixed(2)),
        Taxas_Cartao_R$: Number((c.cardFeesCents / 100).toFixed(2)),
        Taxas_Marketplace_R$: Number((c.marketplaceFeesCents / 100).toFixed(2)),
        Perdas_Avarias_R$: Number((c.lossesDamagesCents / 100).toFixed(2)),
        Outros_Custos_Variaveis_R$: Number((c.otherVariableCostsCents / 100).toFixed(2)),
        Total_Custos_R$: Number((c.totalCostsCents / 100).toFixed(2)),
      }))
    ),
    'Custos'
  );

  // 4. Despesas
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summary.expenseRows.map((e) => ({
        Mes: e.periodMonth,
        Centro_Custo: e.costCenter,
        Aluguel_R$: Number((e.rentCents / 100).toFixed(2)),
        Salarios_Encargos_R$: Number((e.payrollCents / 100).toFixed(2)),
        Agua_R$: Number((e.waterCents / 100).toFixed(2)),
        Energia_R$: Number((e.energyCents / 100).toFixed(2)),
        Internet_R$: Number((e.internetCents / 100).toFixed(2)),
        Marketing_R$: Number((e.marketingCents / 100).toFixed(2)),
        Contabilidade_R$: Number((e.accountingCents / 100).toFixed(2)),
        Sistemas_R$: Number((e.systemsCents / 100).toFixed(2)),
        Outras_Despesas_R$: Number((e.otherExpensesCents / 100).toFixed(2)),
        Total_Despesas_R$: Number((e.totalExpensesCents / 100).toFixed(2)),
      }))
    ),
    'Despesas'
  );

  // 5. Resultado (DRE)
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summary.monthlyDre.map((d) => ({
        Mes: d.periodMonth,
        Unidades_Vendidas: d.unitsSold,
        Receita_Bruta_R$: Number((d.revenueCents / 100).toFixed(2)),
        CMV_R$: Number((d.cmvCents / 100).toFixed(2)),
        Lucro_Bruto_R$: Number((d.grossProfitCents / 100).toFixed(2)),
        Margem_Bruta_Pct: Number(d.grossMarginPct.toFixed(2)),
        Outros_Custos_Variaveis_R$: Number((d.otherVariableCostsCents / 100).toFixed(2)),
        Despesas_Operacionais_R$: Number((d.operatingExpensesCents / 100).toFixed(2)),
        Resultado_Operacional_R$: Number((d.operatingResultCents / 100).toFixed(2)),
        Margem_Operacional_Pct: Number(d.operatingMarginPct.toFixed(2)),
      }))
    ),
    'Resultado'
  );

  // 6. Estoque
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summary.inventoryRows.map((i) => ({
        Mes: i.periodMonth,
        Categoria: i.categoryName,
        SKU: i.sku || '-',
        Item: i.itemName,
        Estoque_Inicial: i.initialStock,
        Compras: i.purchasesQty,
        Vendas: i.salesQty,
        Perdas: i.lossesQty,
        Estoque_Final: i.finalStock,
        Custo_Unitario_R$: Number((i.unitCostCents / 100).toFixed(2)),
        Valor_em_Estoque_R$: Number((i.stockValueCents / 100).toFixed(2)),
        Ponto_Reposicao: i.reorderPoint,
        Cobertura_Dias: i.coverageDays ?? 'Sem giro',
        Alerta: i.replenishmentLabel,
      }))
    ),
    'Estoque'
  );

  const safeSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 32);
  XLSX.writeFile(wb, `gemeo-digital-dre-estoque-${safeSlug || 'empresa'}.xlsx`);
}

export function exportFinancialDrePdf(
  companyName: string,
  summary: FinancialSummaryBundle
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 44;
  const pushLine = (text: string, bold = false, size = 10) => {
    if (y > 780) {
      doc.addPage();
      y = 44;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, 510);
    doc.text(wrapped, 42, y);
    y += wrapped.length * (size + 4) + 2;
  };

  pushLine(`Gêmeo Digital — Relatório Financeiro, DRE e Estoque`, true, 15);
  pushLine(`Empresa: ${companyName} · Emitido em ${new Date().toLocaleString('pt-BR')}`, false, 9);
  y += 10;

  pushLine('1. RESUMO CONSOLIDADO', true, 12);
  pushLine(`Receita Total: ${formatBrlFromCents(summary.totalRevenueCents)} | Unidades Vendidas: ${summary.totalUnitsSold}`);
  pushLine(`CMV Total: ${formatBrlFromCents(summary.totalCmvCents)} | Lucro Bruto: ${formatBrlFromCents(summary.grossProfitCents)} (${formatPct(summary.grossMarginPct)})`);
  pushLine(`Outros Custos Variáveis: ${formatBrlFromCents(summary.totalVariableCostsCents)} | Despesas Operacionais: ${formatBrlFromCents(summary.totalOperatingExpensesCents)}`);
  pushLine(`Resultado Operacional: ${formatBrlFromCents(summary.operatingResultCents)} (Margem: ${formatPct(summary.operatingMarginPct)})`);
  pushLine(`Valor Total em Estoque: ${formatBrlFromCents(summary.totalInventoryValueCents)} | Categorias em alerta de reposição: ${summary.categoriesNeedingReplenishment.join(', ') || 'Nenhuma'}`);
  y += 8;

  pushLine('2. DEMONSTRATIVO MENSAL SIMPLIFICADO (DRE)', true, 12);
  for (const m of summary.monthlyDre) {
    pushLine(
      `${m.periodMonth} | Receita: ${formatBrlFromCents(m.revenueCents)} | CMV: ${formatBrlFromCents(m.cmvCents)} | Lucro Bruto: ${formatBrlFromCents(m.grossProfitCents)} (${formatPct(m.grossMarginPct)}) | Custos Var.: ${formatBrlFromCents(m.otherVariableCostsCents)} | Despesas: ${formatBrlFromCents(m.operatingExpensesCents)} | Resultado Op.: ${formatBrlFromCents(m.operatingResultCents)} (${formatPct(m.operatingMarginPct)})`,
      false,
      9
    );
  }
  y += 8;

  if (summary.inventoryRows.length > 0) {
    pushLine('3. POSIÇÃO E ALERTAS DE ESTOQUE', true, 12);
    for (const inv of summary.inventoryRows.slice(0, 30)) {
      pushLine(
        `${inv.itemName} (${inv.categoryName}) | Final: ${inv.finalStock} un. | Valor: ${formatBrlFromCents(inv.stockValueCents)} | Reposição: ${inv.reorderPoint} | Cobertura: ${inv.coverageDays !== null ? `${inv.coverageDays}d` : 'N/A'} | Status: ${inv.replenishmentLabel}`,
        false,
        9
      );
    }
  }

  doc.save(`gemeo-digital-dre-${companyName.toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 24)}.pdf`);
}
