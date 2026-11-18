import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Calculator,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  PackagePlus,
  Plus,
  Receipt,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  computeFinancialSummary,
  downloadFinancialBlankTemplateExcel,
  exportFinancialDrePdf,
  exportFinancialWorkbookExcel,
  formatBrlFromCents,
  formatPct,
  type FinancialCostRow,
  type FinancialExpenseRow,
  type FinancialSalesRow,
  type FinancialSummaryBundle,
  type InventoryControlRow,
} from '../lib/financialFormulas';
import { SimpleBarChart } from './SimpleBarChart';
import { TrendLineChart } from './Charts';
import { EmptyEvidenceBox, KpiStatCard, PageHeader, StatusBadge } from './ui/TwinUI';

type FinSubTab = 'resumo' | 'vendas' | 'custos' | 'despesas' | 'resultado' | 'estoque';

export interface CrossAnalysisDisplay {
  executiveDiagnosis?: string;
  correlations?: Array<{
    pillarPair: string;
    finding: string;
    evidenceType: string;
    financialOrOperationalImpact: string;
    recommendedAction: string;
  }>;
  priorityAlerts?: string[];
  unavailableOrMissingData?: string[];
  generatedAt?: string;
}

export const FinancialOperationsModule: React.FC<{
  companyId: number;
  companyName: string;
  categories: Array<{ id: number; name: string; slug: string }>;
  sales: FinancialSalesRow[];
  costs: FinancialCostRow[];
  expenses: FinancialExpenseRow[];
  inventory: InventoryControlRow[];
  precomputedSummary?: FinancialSummaryBundle;
  latestCrossAnalysis?: CrossAnalysisDisplay | null;
  consumersContextNote?: string;
  competitorsCount: number;
  macroActiveCount: number;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onRefresh: () => Promise<void> | void;
  onNotify: (msg: string) => void;
}> = ({
  companyId,
  companyName,
  categories,
  sales,
  costs,
  expenses,
  inventory,
  precomputedSummary,
  latestCrossAnalysis,
  consumersContextNote,
  competitorsCount,
  macroActiveCount,
  apiFetch,
  onRefresh,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<FinSubTab>('resumo');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [importingWorkbook, setImportingWorkbook] = useState(false);
  const [runningCrossAi, setRunningCrossAi] = useState(false);
  const [crossAiLocal, setCrossAiLocal] = useState<CrossAnalysisDisplay | null>(
    latestCrossAnalysis || null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync summary cleanly (supports optional month filter across tabs)
  const filteredSales = useMemo(
    () => (monthFilter === 'all' ? sales : sales.filter((s) => s.periodMonth === monthFilter)),
    [sales, monthFilter]
  );
  const filteredCosts = useMemo(
    () => (monthFilter === 'all' ? costs : costs.filter((c) => c.periodMonth === monthFilter)),
    [costs, monthFilter]
  );
  const filteredExpenses = useMemo(
    () => (monthFilter === 'all' ? expenses : expenses.filter((e) => e.periodMonth === monthFilter)),
    [expenses, monthFilter]
  );
  const filteredInventory = useMemo(
    () => (monthFilter === 'all' ? inventory : inventory.filter((i) => i.periodMonth === monthFilter)),
    [inventory, monthFilter]
  );

  const summary = useMemo(() => {
    if (monthFilter === 'all' && precomputedSummary) return precomputedSummary;
    return computeFinancialSummary({
      sales: filteredSales,
      costs: filteredCosts,
      expenses: filteredExpenses,
      inventory: filteredInventory,
    });
  }, [monthFilter, precomputedSummary, filteredSales, filteredCosts, filteredExpenses, filteredInventory]);

  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    for (const r of sales) if (r.periodMonth) s.add(r.periodMonth);
    for (const r of costs) if (r.periodMonth) s.add(r.periodMonth);
    for (const r of expenses) if (r.periodMonth) s.add(r.periodMonth);
    for (const r of inventory) if (r.periodMonth) s.add(r.periodMonth);
    return Array.from(s).sort().reverse();
  }, [sales, costs, expenses, inventory]);

  const currentMonthDefault = new Date().toISOString().slice(0, 7);

  // Customizable Category input
  const [newCatInput, setNewCatInput] = useState('');

  // Form states for Vendas, Custos, Despesas, Estoque
  const [salesForm, setSalesForm] = useState({
    periodMonth: currentMonthDefault,
    categoryName: categories[0]?.name || '',
    customCategory: '',
    productName: '',
    unitsSold: '',
    unitPriceReais: '',
    unitCostReais: '',
    notes: '',
  });

  const [costForm, setCostForm] = useState({
    periodMonth: currentMonthDefault,
    categoryName: 'Geral',
    cmvSourceMode: 'auto_vendas' as 'auto_vendas' | 'manual',
    cmvReais: '',
    freightReais: '',
    packagingReais: '',
    cardFeesReais: '',
    marketplaceFeesReais: '',
    lossesDamagesReais: '',
    otherVariableCostsReais: '',
    notes: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    periodMonth: currentMonthDefault,
    costCenter: 'Operação',
    rentReais: '',
    payrollReais: '',
    waterReais: '',
    energyReais: '',
    internetReais: '',
    marketingReais: '',
    accountingReais: '',
    systemsReais: '',
    otherExpensesReais: '',
    notes: '',
  });

  const [inventoryForm, setInventoryForm] = useState({
    periodMonth: currentMonthDefault,
    categoryName: categories[0]?.name || '',
    customCategory: '',
    sku: '',
    itemName: '',
    initialStock: '',
    purchasesQty: '',
    salesQty: '',
    lossesQty: '',
    unitCostReais: '',
    reorderPoint: '10',
    periodDays: '30',
    notes: '',
  });

  const effectiveCrossAi = crossAiLocal || latestCrossAnalysis || null;

  const handleWorkbookUpload = async (file: File) => {
    setImportingWorkbook(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
        reader.readAsDataURL(file);
      });

      const res = await apiFetch<{
        detectedSheets: string[];
        importedCounts: { sales: number; costs: number; expenses: number; inventory: number };
      }>(`/api/beta/companies/${companyId}/financial/import-workbook`, {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, base64Data }),
      });

      const total =
        res.importedCounts.sales +
        res.importedCounts.costs +
        res.importedCounts.expenses +
        res.importedCounts.inventory;
      if (total === 0) {
        onNotify(
          'Planilha lida, porém nenhuma linha compatível foi encontrada nas abas Vendas, Custos, Despesas ou Estoque. Baixe o modelo para conferir as colunas.'
        );
      } else {
        onNotify(
          `Planilha importada: ${res.importedCounts.sales} venda(s), ${res.importedCounts.costs} custo(s), ${res.importedCounts.expenses} despesa(s) e ${res.importedCounts.inventory} item(ns) de estoque.`
        );
        await onRefresh();
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao importar planilha.');
    } finally {
      setImportingWorkbook(false);
    }
  };

  const handleRunCrossAnalysis = async () => {
    setRunningCrossAi(true);
    try {
      const res = await apiFetch<CrossAnalysisDisplay>(
        `/api/beta/companies/${companyId}/cross-analysis`,
        { method: 'POST' }
      );
      setCrossAiLocal(res);
      onNotify('Cruzamento inteligente entre Macroeconomia, Consumidores, Concorrentes e Financeiro/Estoque atualizado!');
      await onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao executar cruzamento inteligente.');
    } finally {
      setRunningCrossAi(false);
    }
  };

  const dreChartData = summary.monthlyDre.map((m) => ({
    label: m.periodMonth,
    value: Math.round(m.revenueCents / 100),
    secondaryValue: Math.round((m.cmvCents + m.otherVariableCostsCents + m.operatingExpensesCents) / 100),
  }));

  const costCompositionChart = [
    { label: 'CMV', value: Math.round(summary.costBreakdown.cmvCents / 100) },
    { label: 'Frete', value: Math.round(summary.costBreakdown.freightCents / 100) },
    { label: 'Embalagem', value: Math.round(summary.costBreakdown.packagingCents / 100) },
    { label: 'Cartão', value: Math.round(summary.costBreakdown.cardFeesCents / 100) },
    { label: 'Marketplace', value: Math.round(summary.costBreakdown.marketplaceFeesCents / 100) },
    { label: 'Perdas/Outros', value: Math.round((summary.costBreakdown.lossesDamagesCents + summary.costBreakdown.otherVariableCostsCents) / 100) },
  ];

  // Live preview helpers
  const salesPreviewUnits = Number(salesForm.unitsSold || 0);
  const salesPreviewPrice = Number(salesForm.unitPriceReais || 0);
  const salesPreviewCost = Number(salesForm.unitCostReais || 0);
  const salesPreviewRev = salesPreviewUnits * salesPreviewPrice;
  const salesPreviewCmv = salesPreviewUnits * salesPreviewCost;
  const salesPreviewGross = salesPreviewRev - salesPreviewCmv;
  const salesPreviewMargin = salesPreviewRev > 0 ? (salesPreviewGross / salesPreviewRev) * 100 : 0;

  const invPreviewFinal = Math.max(
    0,
    Number(inventoryForm.initialStock || 0) +
      Number(inventoryForm.purchasesQty || 0) -
      Number(inventoryForm.salesQty || 0) -
      Number(inventoryForm.lossesQty || 0)
  );
  const invPreviewValue = invPreviewFinal * Number(inventoryForm.unitCostReais || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="GESTÃO FINANCEIRA, DRE & ESTOQUE"
        title="Vendas, Custos, Despesas, Resultado e Estoque"
        description={`Controle financeiro e operacional completo de ${companyName} em 6 módulos integrados com cálculo automático de DRE, giro de estoque e sincronização com Macroeconomia, Consumidores e Concorrentes.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleWorkbookUpload(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => downloadFinancialBlankTemplateExcel(companyName)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[#20C5D5] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#20C5D5]" />
              <span>Modelo 6 Abas (.xlsx)</span>
            </button>
            <button
              type="button"
              disabled={importingWorkbook}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#20C5D5]/50 bg-[#15365F] px-3 py-2 text-xs font-semibold text-[#20C5D5] hover:bg-[#1a4375] cursor-pointer disabled:opacity-60"
            >
              {importingWorkbook ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>{importingWorkbook ? 'Importando...' : 'Importar Planilha (.xlsx)'}</span>
            </button>
            <button
              type="button"
              disabled={!summary.hasData}
              onClick={() => exportFinancialWorkbookExcel(companyName, summary)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[#20C5D5] cursor-pointer disabled:opacity-40"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#22C58B]" />
              <span>Exportar Excel</span>
            </button>
            <button
              type="button"
              disabled={!summary.hasData}
              onClick={() => exportFinancialDrePdf(companyName, summary)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-3.5 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar DRE (PDF)</span>
            </button>
          </div>
        }
      />

      {/* Tab Navigation + Month Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'resumo', label: '1. Resumo', icon: BarChart3 },
              { id: 'vendas', label: '2. Vendas', icon: TrendingUp },
              { id: 'custos', label: '3. Custos', icon: Calculator },
              { id: 'despesas', label: '4. Despesas', icon: Receipt },
              { id: 'resultado', label: '5. Resultado (DRE)', icon: Layers },
              { id: 'estoque', label: '6. Estoque', icon: Boxes },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#20C5D5] text-[#06132D]'
                    : 'bg-[var(--bg-card-secondary)]/60 text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-secondary)]">Período:</span>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
          >
            <option value="all">Todos os meses consolidados</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ABA 1: RESUMO                                                    */}
      {/* ================================================================ */}
      {activeTab === 'resumo' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            <KpiStatCard
              title="Receita Total"
              value={formatBrlFromCents(summary.totalRevenueCents)}
              subtitle={`${summary.totalUnitsSold.toLocaleString('pt-BR')} un. vendidas`}
              tone="cyan"
            />
            <KpiStatCard
              title="CMV Total"
              value={formatBrlFromCents(summary.totalCmvCents)}
              subtitle="Custo das Mercadorias Vendidas"
            />
            <KpiStatCard
              title="Lucro Bruto"
              value={formatBrlFromCents(summary.grossProfitCents)}
              subtitle={`Margem Bruta: ${formatPct(summary.grossMarginPct)}`}
              tone={summary.grossProfitCents >= 0 ? 'green' : 'red'}
            />
            <KpiStatCard
              title="Outros Custos Variáveis"
              value={formatBrlFromCents(summary.totalVariableCostsCents)}
              subtitle="Frete, embalagens, cartão, perdas"
              tone="amber"
            />
            <KpiStatCard
              title="Despesas Operacionais"
              value={formatBrlFromCents(summary.totalOperatingExpensesCents)}
              subtitle="Aluguel, folha, energia, marketing..."
            />
            <KpiStatCard
              title="Resultado Operacional"
              value={formatBrlFromCents(summary.operatingResultCents)}
              subtitle={`Margem Operacional: ${formatPct(summary.operatingMarginPct)}`}
              tone={
                summary.operatingResultCents > 0
                  ? 'green'
                  : summary.operatingResultCents < 0
                  ? 'red'
                  : 'default'
              }
            />
            <KpiStatCard
              title="Valor do Estoque"
              value={formatBrlFromCents(summary.totalInventoryValueCents)}
              subtitle={`${summary.inventoryRows.length} item(ns) controlado(s)`}
              tone="cyan"
            />
            <KpiStatCard
              title="Reposição Necessária"
              value={summary.categoriesNeedingReplenishment.length}
              subtitle={
                summary.categoriesNeedingReplenishment.length > 0
                  ? summary.categoriesNeedingReplenishment.slice(0, 3).join(', ')
                  : 'Nenhuma categoria em alerta'
              }
              tone={summary.categoriesNeedingReplenishment.length > 0 ? 'red' : 'green'}
            />
          </div>

          {!summary.hasData && (
            <EmptyEvidenceBox
              title="Sem lançamentos financeiros ou de estoque reais ainda"
              description="Nenhum dado fictício foi inserido. Comece registrando suas Vendas, Custos, Despesas ou Estoque nas abas acima, ou importe sua planilha Excel (.xlsx) compatível."
              actionLabel="Lançar Primeira Venda"
              onAction={() => setActiveTab('vendas')}
            />
          )}

          {summary.categoriesNeedingReplenishment.length > 0 && (
            <div className="rounded-xl border border-[#F25F6E]/40 bg-[#F25F6E]/10 p-4 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-[#F25F6E]">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Categorias que precisam de reposição ({summary.categoriesNeedingReplenishment.length}):{' '}
                  {summary.categoriesNeedingReplenishment.join(' · ')}
                </span>
              </div>
              <p className="text-[var(--text-secondary)]">
                Há {summary.criticalStockItemsCount} item(ns) no Estoque igual ou abaixo do ponto de reposição / cobertura baixa.{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('estoque')}
                  className="text-[#20C5D5] underline cursor-pointer font-semibold"
                >
                  Abrir aba Estoque →
                </button>
              </p>
            </div>
          )}

          {summary.hasData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                <h3 className="text-sm font-bold">Receita vs. Custos + Despesas por Mês (R$)</h3>
                {dreChartData.length > 0 ? (
                  <SimpleBarChart
                    data={dreChartData}
                    primaryLabel="Receita Bruta (R$)"
                    secondaryLabel="CMV + Variáveis + Despesas (R$)"
                  />
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">Lance dados mensais para gerar o gráfico.</p>
                )}
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                <h3 className="text-sm font-bold">Evolução Mensal da DRE: Receita e Resultado (R$)</h3>
                {summary.monthlyDre.length > 0 ? (
                  <TrendLineChart
                    labels={summary.monthlyDre.map((m) => m.periodMonth)}
                    series={[
                      {
                        name: 'Receita (R$)',
                        color: '#20C5D5',
                        values: summary.monthlyDre.map((m) => Math.round(m.revenueCents / 100)),
                      },
                      {
                        name: 'Lucro Bruto (R$)',
                        color: '#22C58B',
                        values: summary.monthlyDre.map((m) => Math.round(m.grossProfitCents / 100)),
                      },
                      {
                        name: 'Resultado Operacional (R$)',
                        color: '#F2B84B',
                        values: summary.monthlyDre.map((m) => Math.round(m.operatingResultCents / 100)),
                      },
                    ]}
                  />
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">Lance pelo menos 1 mês de vendas/despesas.</p>
                )}
              </div>
            </div>
          )}

          {/* Cross-section AI synchronization block */}
          <div className="rounded-xl border border-[#20C5D5]/40 bg-[var(--bg-card)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">
                  SINCRONIZAÇÃO ENTRE MÓDULOS COM IA
                </div>
                <h3 className="text-base font-bold">
                  Cruzamento: Macroeconomia × Consumidores × Concorrentes × Financeiro & Estoque
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Status conectado: {macroActiveCount} indicador(es) macro · {competitorsCount} concorrente(s) ·{' '}
                  {consumersContextNote || 'Consumidores sincronizados'} · {summary.salesRows.length} venda(s) e{' '}
                  {summary.inventoryRows.length} item(ns) de estoque.
                </p>
              </div>
              <button
                type="button"
                disabled={runningCrossAi}
                onClick={handleRunCrossAnalysis}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
              >
                {runningCrossAi ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>{runningCrossAi ? 'Cruzando dados com IA...' : 'Atualizar Diagnóstico Cruzado IA'}</span>
              </button>
            </div>

            {effectiveCrossAi ? (
              <div className="space-y-4 text-xs">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/70 p-3.5 text-[var(--text-primary)] leading-relaxed">
                  {effectiveCrossAi.executiveDiagnosis}
                </div>

                {Array.isArray(effectiveCrossAi.correlations) && effectiveCrossAi.correlations.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {effectiveCrossAi.correlations.map((corr, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#20C5D5]">{corr.pillarPair}</span>
                          <StatusBadge
                            kind={
                              corr.evidenceType === 'Confirmado'
                                ? 'oportunidade'
                                : corr.evidenceType === 'Estimado'
                                ? 'alerta'
                                : 'movimento'
                            }
                            customLabel={corr.evidenceType}
                          />
                        </div>
                        <p className="text-[var(--text-primary)]">{corr.finding}</p>
                        {corr.financialOrOperationalImpact && (
                          <div className="text-[var(--text-secondary)]">
                            <strong>Impacto:</strong> {corr.financialOrOperationalImpact}
                          </div>
                        )}
                        {corr.recommendedAction && (
                          <div className="text-[#22C58B]">
                            <strong>Ação:</strong> {corr.recommendedAction}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(effectiveCrossAi.unavailableOrMissingData) &&
                  effectiveCrossAi.unavailableOrMissingData.length > 0 && (
                    <div className="rounded-lg border border-[#F2B84B]/30 bg-[#F2B84B]/10 p-3 text-[#F2B84B]">
                      <strong>Dados faltantes para ampliar a precisão:</strong>{' '}
                      {effectiveCrossAi.unavailableOrMissingData.join(' · ')}
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                Clique em &quot;Atualizar Diagnóstico Cruzado IA&quot; para que a inteligência artificial relacione automaticamente os números financeiros/estoque com inflação/juros, avaliações de clientes e posicionamento de concorrentes.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ABA 2: VENDAS                                                    */}
      {/* ================================================================ */}
      {activeTab === 'vendas' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                const chosenCat = salesForm.customCategory.trim() || salesForm.categoryName.trim() || 'Geral';
                await apiFetch(`/api/beta/companies/${companyId}/financial/sales`, {
                  method: 'POST',
                  body: JSON.stringify({
                    periodMonth: salesForm.periodMonth,
                    categoryName: chosenCat,
                    productName: salesForm.productName,
                    unitsSold: Number(salesForm.unitsSold || 0),
                    unitPriceReais: Number(salesForm.unitPriceReais || 0),
                    unitCostReais: Number(salesForm.unitCostReais || 0),
                    notes: salesForm.notes,
                  }),
                });
                setSalesForm((prev) => ({
                  ...prev,
                  customCategory: '',
                  productName: '',
                  unitsSold: '',
                  unitPriceReais: '',
                  unitCostReais: '',
                  notes: '',
                }));
                onNotify('Venda registrada e DRE recalculada automaticamente.');
                await onRefresh();
              } catch (err) {
                onNotify(err instanceof Error ? err.message : 'Erro ao salvar venda.');
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Registrar Vendas por Mês e Categoria</h2>
              <div className="text-[var(--text-secondary)]">
                Cálculo automático: Receita = Un. × Preço · CMV = Un. × Custo · Lucro Bruto = Receita − CMV
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Mês (AAAA-MM) *</label>
                <input
                  type="month"
                  required
                  value={salesForm.periodMonth}
                  onChange={(e) => setSalesForm({ ...salesForm, periodMonth: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Categoria *</label>
                <select
                  value={salesForm.categoryName}
                  onChange={(e) => setSalesForm({ ...salesForm, categoryName: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                >
                  <option value="">Selecionar ou digitar nova →</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Ou nova categoria personalizada</label>
                <input
                  type="text"
                  placeholder="Ex.: Bebidas, Calçados..."
                  value={salesForm.customCategory}
                  onChange={(e) => setSalesForm({ ...salesForm, customCategory: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Produto / Linha (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex.: Linha Premium"
                  value={salesForm.productName}
                  onChange={(e) => setSalesForm({ ...salesForm, productName: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Unidades Vendidas *</label>
                <input
                  type="number"
                  min={0}
                  required
                  placeholder="0"
                  value={salesForm.unitsSold}
                  onChange={(e) => setSalesForm({ ...salesForm, unitsSold: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Preço Unitário (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  placeholder="0.00"
                  value={salesForm.unitPriceReais}
                  onChange={(e) => setSalesForm({ ...salesForm, unitPriceReais: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Custo Unitário (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  placeholder="0.00"
                  value={salesForm.unitCostReais}
                  onChange={(e) => setSalesForm({ ...salesForm, unitCostReais: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{saving ? 'Salvando...' : 'Adicionar Venda'}</span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 px-3.5 py-2.5 flex flex-wrap gap-6">
              <span>
                Prévia Receita: <strong className="text-[#20C5D5]">{salesPreviewRev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </span>
              <span>
                CMV Calculado: <strong>{salesPreviewCmv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </span>
              <span>
                Lucro Bruto: <strong className="text-[#22C58B]">{salesPreviewGross.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </span>
              <span>
                Margem Bruta: <strong className="text-[#22C58B]">{formatPct(salesPreviewMargin)}</strong>
              </span>
            </div>
          </form>

          {summary.byCategory.length > 0 && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <h3 className="text-sm font-bold">Desempenho por Categoria Personalizada</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-secondary)]">
                      <th className="py-2 pr-3">Categoria</th>
                      <th className="py-2 pr-3">Unidades</th>
                      <th className="py-2 pr-3">Receita</th>
                      <th className="py-2 pr-3">CMV</th>
                      <th className="py-2 pr-3">Lucro Bruto</th>
                      <th className="py-2 pr-3">Margem Bruta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {summary.byCategory.map((cat) => (
                      <tr key={cat.categoryName}>
                        <td className="py-2 pr-3 font-semibold text-white">{cat.categoryName}</td>
                        <td className="py-2 pr-3">{cat.unitsSold.toLocaleString('pt-BR')}</td>
                        <td className="py-2 pr-3 text-[#20C5D5] font-mono">{formatBrlFromCents(cat.revenueCents)}</td>
                        <td className="py-2 pr-3 font-mono">{formatBrlFromCents(cat.cmvCents)}</td>
                        <td className="py-2 pr-3 text-[#22C58B] font-mono">{formatBrlFromCents(cat.grossProfitCents)}</td>
                        <td className="py-2 pr-3 font-semibold">{formatPct(cat.grossMarginPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
            <h3 className="text-sm font-bold">Registros de Vendas ({summary.salesRows.length})</h3>
            {summary.salesRows.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">Nenhuma venda registrada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-secondary)]">
                      <th className="py-2 pr-3">Mês</th>
                      <th className="py-2 pr-3">Categoria</th>
                      <th className="py-2 pr-3">Produto</th>
                      <th className="py-2 pr-3">Unid.</th>
                      <th className="py-2 pr-3">Preço Un.</th>
                      <th className="py-2 pr-3">Custo Un.</th>
                      <th className="py-2 pr-3">Receita</th>
                      <th className="py-2 pr-3">CMV</th>
                      <th className="py-2 pr-3">Lucro Bruto</th>
                      <th className="py-2 pr-3">Margem</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {summary.salesRows.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-3 font-mono">{row.periodMonth}</td>
                        <td className="py-2 pr-3 font-semibold">{row.categoryName}</td>
                        <td className="py-2 pr-3 text-[var(--text-secondary)]">{row.productName || '—'}</td>
                        <td className="py-2 pr-3">{row.unitsSold}</td>
                        <td className="py-2 pr-3 font-mono">{formatBrlFromCents(row.unitPriceCents)}</td>
                        <td className="py-2 pr-3 font-mono">{formatBrlFromCents(row.unitCostCents)}</td>
                        <td className="py-2 pr-3 font-mono text-[#20C5D5]">{formatBrlFromCents(row.revenueCents)}</td>
                        <td className="py-2 pr-3 font-mono">{formatBrlFromCents(row.cmvCents)}</td>
                        <td className="py-2 pr-3 font-mono text-[#22C58B]">{formatBrlFromCents(row.grossProfitCents)}</td>
                        <td className="py-2 pr-3 font-semibold">{formatPct(row.grossMarginPct)}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/beta/companies/${companyId}/financial/sales/${row.id}`, {
                                method: 'DELETE',
                              });
                              onNotify('Registro de venda removido.');
                              onRefresh();
                            }}
                            className="text-[var(--text-secondary)] hover:text-[#F25F6E] cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ABA 3: CUSTOS                                                    */}
      {/* ================================================================ */}
      {activeTab === 'custos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                  await apiFetch(`/api/beta/companies/${companyId}/financial/costs`, {
                    method: 'POST',
                    body: JSON.stringify(costForm),
                  });
                  setCostForm((prev) => ({
                    ...prev,
                    cmvReais: '',
                    freightReais: '',
                    packagingReais: '',
                    cardFeesReais: '',
                    marketplaceFeesReais: '',
                    lossesDamagesReais: '',
                    otherVariableCostsReais: '',
                    notes: '',
                  }));
                  onNotify('Custos variáveis salvos e sincronizados com a DRE.');
                  await onRefresh();
                } catch (err) {
                  onNotify(err instanceof Error ? err.message : 'Erro ao salvar custos.');
                } finally {
                  setSaving(false);
                }
              }}
              className="lg:col-span-7 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs"
            >
              <h2 className="text-sm font-bold">Lançar Custos Mensais (CMV, Frete, Embalagens, Taxas, Perdas)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Mês (AAAA-MM) *</label>
                  <input
                    type="month"
                    required
                    value={costForm.periodMonth}
                    onChange={(e) => setCostForm({ ...costForm, periodMonth: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Origem do CMV</label>
                  <select
                    value={costForm.cmvSourceMode}
                    onChange={(e) =>
                      setCostForm({ ...costForm, cmvSourceMode: e.target.value as 'auto_vendas' | 'manual' })
                    }
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  >
                    <option value="auto_vendas">Automático pela aba Vendas</option>
                    <option value="manual">Informar CMV manual abaixo</option>
                  </select>
                </div>
                {costForm.cmvSourceMode === 'manual' ? (
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">CMV Manual (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      value={costForm.cmvReais}
                      onChange={(e) => setCostForm({ ...costForm, cmvReais: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Categoria</label>
                    <input
                      type="text"
                      value={costForm.categoryName}
                      onChange={(e) => setCostForm({ ...costForm, categoryName: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Frete (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={costForm.freightReais}
                    onChange={(e) => setCostForm({ ...costForm, freightReais: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Embalagens (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={costForm.packagingReais}
                    onChange={(e) => setCostForm({ ...costForm, packagingReais: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Taxas de Cartão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={costForm.cardFeesReais}
                    onChange={(e) => setCostForm({ ...costForm, cardFeesReais: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Taxas Marketplace (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={costForm.marketplaceFeesReais}
                    onChange={(e) => setCostForm({ ...costForm, marketplaceFeesReais: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Perdas e Avarias (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={costForm.lossesDamagesReais}
                    onChange={(e) => setCostForm({ ...costForm, lossesDamagesReais: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Outros Custos Var. (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={costForm.otherVariableCostsReais}
                    onChange={(e) => setCostForm({ ...costForm, otherVariableCostsReais: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{saving ? 'Salvando...' : 'Salvar Lançamento de Custos'}</span>
              </button>
            </form>

            <div className="lg:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <h3 className="text-sm font-bold">Composição de Custos (R$)</h3>
              <SimpleBarChart data={costCompositionChart} primaryLabel="Valor Acumulado (R$)" />
              <div className="text-xs text-[var(--text-secondary)] flex justify-between pt-2 border-t border-[var(--border-subtle)]">
                <span>Total de Custos (CMV + Variáveis):</span>
                <strong className="text-white font-mono">{formatBrlFromCents(summary.totalCostsWithCmvCents)}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
            <h3 className="text-sm font-bold">Histórico de Custos Lançados ({summary.costRows.length})</h3>
            {summary.costRows.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">Nenhum lançamento de custos adicionais ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-secondary)]">
                      <th className="py-2 pr-3">Mês</th>
                      <th className="py-2 pr-3">CMV</th>
                      <th className="py-2 pr-3">Frete</th>
                      <th className="py-2 pr-3">Embalagens</th>
                      <th className="py-2 pr-3">Cartão</th>
                      <th className="py-2 pr-3">Marketplace</th>
                      <th className="py-2 pr-3">Perdas/Avarias</th>
                      <th className="py-2 pr-3">Total Custos</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {summary.costRows.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 pr-3 font-mono">{c.periodMonth}</td>
                        <td className="py-2 pr-3 font-mono">
                          {formatBrlFromCents(c.effectiveCmvCents)}{' '}
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            ({c.cmvSourceMode === 'manual' ? 'manual' : 'vendas'})
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-mono">{formatBrlFromCents(c.freightCents)}</td>
                        <td className="py-2 pr-3 font-mono">{formatBrlFromCents(c.packagingCents)}</td>
                        <td className="py-2 pr-3 font-mono">{formatBrlFromCents(c.cardFeesCents)}</td>
                        <td className="py-2 pr-3 font-mono">{formatBrlFromCents(c.marketplaceFeesCents)}</td>
                        <td className="py-2 pr-3 font-mono">{formatBrlFromCents(c.lossesDamagesCents)}</td>
                        <td className="py-2 pr-3 font-mono font-bold text-[#F2B84B]">{formatBrlFromCents(c.totalCostsCents)}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/beta/companies/${companyId}/financial/costs/${c.id}`, {
                                method: 'DELETE',
                              });
                              onNotify('Lançamento de custo removido.');
                              onRefresh();
                            }}
                            className="text-[var(--text-secondary)] hover:text-[#F25F6E] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ABA 4: DESPESAS                                                  */}
      {/* ================================================================ */}
      {activeTab === 'despesas' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                await apiFetch(`/api/beta/companies/${companyId}/financial/expenses`, {
                  method: 'POST',
                  body: JSON.stringify(expenseForm),
                });
                setExpenseForm((prev) => ({
                  ...prev,
                  rentReais: '',
                  payrollReais: '',
                  waterReais: '',
                  energyReais: '',
                  internetReais: '',
                  marketingReais: '',
                  accountingReais: '',
                  systemsReais: '',
                  otherExpensesReais: '',
                  notes: '',
                }));
                onNotify('Despesas operacionais salvas e DRE atualizada.');
                await onRefresh();
              } catch (err) {
                onNotify(err instanceof Error ? err.message : 'Erro ao salvar despesas.');
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs"
          >
            <h2 className="text-sm font-bold">Controle de Despesas Operacionais Mensais</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Mês (AAAA-MM) *</label>
                <input
                  type="month"
                  required
                  value={expenseForm.periodMonth}
                  onChange={(e) => setExpenseForm({ ...expenseForm, periodMonth: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Centro de Custo</label>
                <input
                  type="text"
                  value={expenseForm.costCenter}
                  onChange={(e) => setExpenseForm({ ...expenseForm, costCenter: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                />
              </div>
              {[
                { key: 'rentReais', label: 'Aluguel (R$)' },
                { key: 'payrollReais', label: 'Salários e Encargos (R$)' },
                { key: 'waterReais', label: 'Água (R$)' },
                { key: 'energyReais', label: 'Energia (R$)' },
                { key: 'internetReais', label: 'Internet (R$)' },
                { key: 'marketingReais', label: 'Marketing (R$)' },
                { key: 'accountingReais', label: 'Contabilidade (R$)' },
                { key: 'systemsReais', label: 'Sistemas / Software (R$)' },
                { key: 'otherExpensesReais', label: 'Outras Despesas (R$)' },
              ].map((fld) => (
                <div key={fld.key}>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">{fld.label}</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={expenseForm[fld.key as keyof typeof expenseForm]}
                    onChange={(e) => setExpenseForm({ ...expenseForm, [fld.key]: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  />
                </div>
              ))}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{saving ? 'Salvando...' : 'Salvar Despesas'}</span>
                </button>
              </div>
            </div>
          </form>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
            <h3 className="text-sm font-bold">Despesas Lançadas ({summary.expenseRows.length})</h3>
            {summary.expenseRows.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">Nenhuma despesa operacional lançada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-secondary)]">
                      <th className="py-2 pr-2">Mês</th>
                      <th className="py-2 pr-2">Aluguel</th>
                      <th className="py-2 pr-2">Salários</th>
                      <th className="py-2 pr-2">Água/Luz/Net</th>
                      <th className="py-2 pr-2">Marketing</th>
                      <th className="py-2 pr-2">Contab./Sist.</th>
                      <th className="py-2 pr-2">Outras</th>
                      <th className="py-2 pr-2">Total Despesas</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {summary.expenseRows.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 pr-2 font-mono">{e.periodMonth}</td>
                        <td className="py-2 pr-2 font-mono">{formatBrlFromCents(e.rentCents)}</td>
                        <td className="py-2 pr-2 font-mono">{formatBrlFromCents(e.payrollCents)}</td>
                        <td className="py-2 pr-2 font-mono">
                          {formatBrlFromCents(e.waterCents + e.energyCents + e.internetCents)}
                        </td>
                        <td className="py-2 pr-2 font-mono">{formatBrlFromCents(e.marketingCents)}</td>
                        <td className="py-2 pr-2 font-mono">
                          {formatBrlFromCents(e.accountingCents + e.systemsCents)}
                        </td>
                        <td className="py-2 pr-2 font-mono">{formatBrlFromCents(e.otherExpensesCents)}</td>
                        <td className="py-2 pr-2 font-mono font-bold text-[#F2B84B]">
                          {formatBrlFromCents(e.totalExpensesCents)}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/beta/companies/${companyId}/financial/expenses/${e.id}`, {
                                method: 'DELETE',
                              });
                              onNotify('Despesa removida.');
                              onRefresh();
                            }}
                            className="text-[var(--text-secondary)] hover:text-[#F25F6E] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ABA 5: RESULTADO (DRE SIMPLIFICADO MENSAL)                       */}
      {/* ================================================================ */}
      {activeTab === 'resultado' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">Demonstrativo de Resultado Mensal Simplificado (DRE)</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Fórmulas sincronizadas: Lucro Bruto = Receita − CMV · Margem de Contribuição = Lucro Bruto − Outros Custos Variáveis · Resultado Operacional = Margem de Contribuição − Despesas Operacionais.
                </p>
              </div>
            </div>

            {summary.monthlyDre.length === 0 ? (
              <EmptyEvidenceBox
                title="DRE aguardando lançamentos"
                description="Registre vendas, custos ou despesas nas abas anteriores para visualizar o demonstrativo mensal automático."
                actionLabel="Lançar Vendas"
                onAction={() => setActiveTab('vendas')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-secondary)]">
                      <th className="py-2.5 pr-3">Mês</th>
                      <th className="py-2.5 pr-3">Receita</th>
                      <th className="py-2.5 pr-3">(-) CMV</th>
                      <th className="py-2.5 pr-3">(=) Lucro Bruto</th>
                      <th className="py-2.5 pr-3">Margem Bruta</th>
                      <th className="py-2.5 pr-3">(-) Outros Custos Var.</th>
                      <th className="py-2.5 pr-3">(-) Despesas Op.</th>
                      <th className="py-2.5 pr-3">(=) Resultado Op.</th>
                      <th className="py-2.5 pr-3">Margem Op.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {summary.monthlyDre.map((m) => (
                      <tr key={m.periodMonth}>
                        <td className="py-2.5 pr-3 font-mono font-bold text-white">{m.periodMonth}</td>
                        <td className="py-2.5 pr-3 font-mono text-[#20C5D5]">{formatBrlFromCents(m.revenueCents)}</td>
                        <td className="py-2.5 pr-3 font-mono">{formatBrlFromCents(m.cmvCents)}</td>
                        <td className="py-2.5 pr-3 font-mono text-[#22C58B]">{formatBrlFromCents(m.grossProfitCents)}</td>
                        <td className="py-2.5 pr-3 font-semibold">{formatPct(m.grossMarginPct)}</td>
                        <td className="py-2.5 pr-3 font-mono text-[#F2B84B]">{formatBrlFromCents(m.otherVariableCostsCents)}</td>
                        <td className="py-2.5 pr-3 font-mono text-[#F2B84B]">{formatBrlFromCents(m.operatingExpensesCents)}</td>
                        <td
                          className={`py-2.5 pr-3 font-mono font-bold ${
                            m.operatingResultCents >= 0 ? 'text-[#22C58B]' : 'text-[#F25F6E]'
                          }`}
                        >
                          {formatBrlFromCents(m.operatingResultCents)}
                        </td>
                        <td
                          className={`py-2.5 pr-3 font-bold ${
                            m.operatingMarginPct >= 0 ? 'text-[#22C58B]' : 'text-[#F25F6E]'
                          }`}
                        >
                          {formatPct(m.operatingMarginPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#20C5D5]/40 bg-[#15365F]/50 font-bold">
                      <td className="py-2.5 pr-3">TOTAL CONSOLIDADO</td>
                      <td className="py-2.5 pr-3 font-mono text-[#20C5D5]">{formatBrlFromCents(summary.totalRevenueCents)}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatBrlFromCents(summary.totalCmvCents)}</td>
                      <td className="py-2.5 pr-3 font-mono text-[#22C58B]">{formatBrlFromCents(summary.grossProfitCents)}</td>
                      <td className="py-2.5 pr-3">{formatPct(summary.grossMarginPct)}</td>
                      <td className="py-2.5 pr-3 font-mono text-[#F2B84B]">{formatBrlFromCents(summary.totalVariableCostsCents)}</td>
                      <td className="py-2.5 pr-3 font-mono text-[#F2B84B]">{formatBrlFromCents(summary.totalOperatingExpensesCents)}</td>
                      <td
                        className={`py-2.5 pr-3 font-mono ${
                          summary.operatingResultCents >= 0 ? 'text-[#22C58B]' : 'text-[#F25F6E]'
                        }`}
                      >
                        {formatBrlFromCents(summary.operatingResultCents)}
                      </td>
                      <td
                        className={`py-2.5 pr-3 ${
                          summary.operatingMarginPct >= 0 ? 'text-[#22C58B]' : 'text-[#F25F6E]'
                        }`}
                      >
                        {formatPct(summary.operatingMarginPct)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ABA 6: ESTOQUE + CATEGORIAS PERSONALIZÁVEIS                      */}
      {/* ================================================================ */}
      {activeTab === 'estoque' && (
        <div className="space-y-6">
          {/* Categorias Personalizáveis por Empresa */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-[#20C5D5]" />
              <span className="font-bold">Categorias personalizáveis ({categories.length}):</span>
              {categories.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-2.5 py-1 text-[11px]"
                >
                  {c.name}
                </span>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newCatInput.trim()) return;
                await apiFetch(`/api/beta/companies/${companyId}/categories`, {
                  method: 'POST',
                  body: JSON.stringify({ name: newCatInput.trim() }),
                });
                setNewCatInput('');
                onNotify('Categoria personalizada adicionada.');
                onRefresh();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Nova categoria..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#20C5D5] px-3 py-1.5 font-semibold text-[#06132D] cursor-pointer"
              >
                + Categoria
              </button>
            </form>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                const chosenCat =
                  inventoryForm.customCategory.trim() ||
                  inventoryForm.categoryName.trim() ||
                  'Geral';
                await apiFetch(`/api/beta/companies/${companyId}/financial/inventory`, {
                  method: 'POST',
                  body: JSON.stringify({
                    periodMonth: inventoryForm.periodMonth,
                    categoryName: chosenCat,
                    sku: inventoryForm.sku,
                    itemName: inventoryForm.itemName,
                    initialStock: Number(inventoryForm.initialStock || 0),
                    purchasesQty: Number(inventoryForm.purchasesQty || 0),
                    salesQty: Number(inventoryForm.salesQty || 0),
                    lossesQty: Number(inventoryForm.lossesQty || 0),
                    unitCostReais: Number(inventoryForm.unitCostReais || 0),
                    reorderPoint: Number(inventoryForm.reorderPoint || 10),
                    periodDays: Number(inventoryForm.periodDays || 30),
                  }),
                });
                setInventoryForm((prev) => ({
                  ...prev,
                  customCategory: '',
                  sku: '',
                  itemName: '',
                  initialStock: '',
                  purchasesQty: '',
                  salesQty: '',
                  lossesQty: '',
                  unitCostReais: '',
                }));
                onNotify('Item salvo no controle de estoque.');
                await onRefresh();
              } catch (err) {
                onNotify(err instanceof Error ? err.message : 'Erro ao salvar item de estoque.');
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <PackagePlus className="h-4 w-4 text-[#20C5D5]" />
                <span>Controle de Estoque (Inicial + Compras − Vendas − Perdas = Final)</span>
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Mês *</label>
                <input
                  type="month"
                  required
                  value={inventoryForm.periodMonth}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, periodMonth: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Categoria *</label>
                <select
                  value={inventoryForm.categoryName}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, categoryName: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                >
                  <option value="">Selecionar ou digitar →</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Ou nova categoria</label>
                <input
                  type="text"
                  placeholder="Nova categoria..."
                  value={inventoryForm.customCategory}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, customCategory: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">SKU</label>
                <input
                  type="text"
                  placeholder="COD-01"
                  value={inventoryForm.sku}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, sku: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Nome do Item / Linha *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex.: Camisa Linho Branca"
                  value={inventoryForm.itemName}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, itemName: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Est. Inicial *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={inventoryForm.initialStock}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, initialStock: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Compras</label>
                <input
                  type="number"
                  min={0}
                  value={inventoryForm.purchasesQty}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, purchasesQty: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Vendas</label>
                <input
                  type="number"
                  min={0}
                  value={inventoryForm.salesQty}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, salesQty: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Perdas</label>
                <input
                  type="number"
                  min={0}
                  value={inventoryForm.lossesQty}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, lossesQty: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Custo Unit. (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={inventoryForm.unitCostReais}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, unitCostReais: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Ponto Reposição</label>
                <input
                  type="number"
                  min={0}
                  value={inventoryForm.reorderPoint}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, reorderPoint: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 px-3.5 py-2.5">
              <div className="flex flex-wrap gap-6">
                <span>
                  Estoque Final Calculado: <strong className="text-[#20C5D5]">{invPreviewFinal} un.</strong>
                </span>
                <span>
                  Valor em Estoque:{' '}
                  <strong className="text-[#22C58B]">
                    {invPreviewValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </span>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-1.5 font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{saving ? 'Salvando...' : 'Adicionar ao Estoque'}</span>
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">
                Posição de Estoque & Cobertura em Dias ({summary.inventoryRows.length})
              </h3>
              <span className="text-xs font-mono text-[#20C5D5]">
                Valor Total: {formatBrlFromCents(summary.totalInventoryValueCents)}
              </span>
            </div>

            {summary.inventoryRows.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">Nenhum item no controle de estoque ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-secondary)]">
                      <th className="py-2 pr-2">Mês</th>
                      <th className="py-2 pr-2">Categoria</th>
                      <th className="py-2 pr-2">Item / SKU</th>
                      <th className="py-2 pr-2">Inicial</th>
                      <th className="py-2 pr-2">Compras</th>
                      <th className="py-2 pr-2">Vendas</th>
                      <th className="py-2 pr-2">Perdas</th>
                      <th className="py-2 pr-2">Est. Final</th>
                      <th className="py-2 pr-2">Valor Est.</th>
                      <th className="py-2 pr-2">Ponto Rep.</th>
                      <th className="py-2 pr-2">Cobertura</th>
                      <th className="py-2 pr-2">Alerta</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {summary.inventoryRows.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-2 pr-2 font-mono">{inv.periodMonth}</td>
                        <td className="py-2 pr-2 font-semibold">{inv.categoryName}</td>
                        <td className="py-2 pr-2">
                          <div className="font-semibold text-white">{inv.itemName}</div>
                          {inv.sku && <div className="text-[10px] font-mono text-[var(--text-secondary)]">{inv.sku}</div>}
                        </td>
                        <td className="py-2 pr-2">{inv.initialStock}</td>
                        <td className="py-2 pr-2 text-[#22C58B]">+{inv.purchasesQty}</td>
                        <td className="py-2 pr-2 text-[#20C5D5]">-{inv.salesQty}</td>
                        <td className="py-2 pr-2 text-[#F25F6E]">-{inv.lossesQty}</td>
                        <td className="py-2 pr-2 font-bold text-white">{inv.finalStock}</td>
                        <td className="py-2 pr-2 font-mono">{formatBrlFromCents(inv.stockValueCents)}</td>
                        <td className="py-2 pr-2">{inv.reorderPoint}</td>
                        <td className="py-2 pr-2 font-mono">
                          {inv.coverageDays !== null ? `${inv.coverageDays} dias` : 'Sem giro'}
                        </td>
                        <td className="py-2 pr-2">
                          <StatusBadge
                            kind={
                              inv.replenishmentStatus === 'ruptura' || inv.replenishmentStatus === 'repor'
                                ? 'ameaca'
                                : inv.replenishmentStatus === 'atencao'
                                ? 'alerta'
                                : 'oportunidade'
                            }
                            customLabel={inv.replenishmentLabel}
                          />
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/beta/companies/${companyId}/financial/inventory/${inv.id}`, {
                                method: 'DELETE',
                              });
                              onNotify('Item removido do estoque.');
                              onRefresh();
                            }}
                            className="text-[var(--text-secondary)] hover:text-[#F25F6E] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
