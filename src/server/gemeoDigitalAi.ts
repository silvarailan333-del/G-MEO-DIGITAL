import crypto from 'crypto';
import { GoogleGenAI, Type, type Content, type FunctionDeclaration, type Part } from '@google/genai';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { db } from '../db/index.ts';
import {
  aiActionProposals,
  aiUsageLogs,
  categories,
  companies,
  companyReputationProfiles,
  companyUnits,
  competitors,
  customerReviews,
  dataImports,
  financialCostRecords,
  financialExpenseRecords,
  financialSalesRecords,
  geoSavedEntities,
  geoSearchLogs,
  integrations,
  internalMetrics,
  inventoryControlItems,
  products,
  strategicItems,
} from '../db/schema.ts';
import { computeFinancialSummary, formatBrlFromCents, formatPct } from '../lib/financialFormulas.ts';
import { PLANS_CONFIG, type PlanCode } from '../config/plans.ts';
import { recordAuditLog } from '../middleware/tenant.ts';
import { getOfficialMacroBundle } from './externalData.ts';
import { inspectDocumentOrImageUpload } from './uploadSecurity.ts';
import { sanitizePlainText, stripPrototypeKeys } from './validation.ts';

export const GEMEO_AI_PRIMARY_MODEL = 'gemini-4-hydrogen';
export const GEMEO_AI_ROUTER_MODEL = 'gemini-3.1-flash-lite';

export const DAILY_COMPANY_AI_LIMITS: Record<PlanCode, number> = {
  basico: 80,
  profissional: 200,
  empresarial: 600,
};

export interface GemeoChatAttachmentInput {
  fileName: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
}

export interface GemeoPendingProposalDto {
  proposalToken: string;
  functionName: string;
  title: string;
  summary: string;
  args: Record<string, unknown>;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface GemeoGroundingLink {
  title: string;
  uri: string;
  sourceType: 'maps' | 'search';
}

export interface GemeoAiChatResponse {
  answer: string;
  toolUsed: 'cloudsql' | 'maps' | 'search' | 'general';
  groundingLinks: GemeoGroundingLink[];
  sourcesUsed: string[];
  toolsInvoked: string[];
  pendingProposals: GemeoPendingProposalDto[];
  attachmentSummary?: string;
  latencyMs: number;
  degraded?: boolean;
}

export interface GemeoExecutiveReport {
  companyName: string;
  segment: string;
  cityState: string;
  generatedAt: string;
  executiveSummary: string;
  sectorContext: string;
  financialHealth: {
    statusLabel: string;
    summary: string;
    keyNumbers: string[];
  };
  competitivePosition: {
    summary: string;
    advantages: string[];
    vulnerabilities: string[];
  };
  consumerDiagnosis: {
    summary: string;
    strengths: string[];
    painPoints: string[];
  };
  opportunities: Array<{ title: string; impact: string; action: string }>;
  risks: Array<{ title: string; severity: string; mitigation: string }>;
  strategicRecommendations: Array<{
    priority: string;
    title: string;
    rationale: string;
    suggestedKpi: string;
  }>;
  dataGaps: string[];
  groundingLinks: GemeoGroundingLink[];
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  try {
    if (!raw) return fallback;
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    return stripPrototypeKeys(JSON.parse(cleaned)) as T;
  } catch {
    return fallback;
  }
}

export function classifyAiErrorForUser(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error || '');
  const lower = raw.toLowerCase();

  if (raw === 'GEMINI_API_KEY_NOT_CONFIGURED' || lower.includes('api_key') || lower.includes('api key')) {
    return {
      status: 503,
      code: 'API_KEY_UNAVAILABLE',
      message:
        'O motor Gêmeo Digital AI está temporariamente indisponível por configuração da chave no servidor. Os demais módulos da plataforma continuam funcionando normalmente.',
    };
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message:
        'Limite temporário de consultas da API Gemini atingido no momento. Aguarde alguns instantes e tente novamente; seus dados permanecem preservados.',
    };
  }
  if (lower.includes('timeout') || lower.includes('econnreset') || lower.includes('fetch failed') || lower.includes('503')) {
    return {
      status: 503,
      code: 'UPSTREAM_UNAVAILABLE',
      message:
        'A API do Google Gemini não respondeu a tempo neste momento. O painel continua operando normalmente sem bloqueios.',
    };
  }
  return {
    status: 500,
    code: 'AI_EXECUTION_ERROR',
    message:
      'Não foi possível concluir a análise de inteligência neste momento. Tente novamente em instantes.',
  };
}

export async function recordAiUsage(params: {
  companyId: number | null;
  userId: number | null;
  module: string;
  model?: string;
  toolUsed?: string;
  status: 'success' | 'degraded' | 'quota_exceeded' | 'error';
  latencyMs: number;
  inputChars?: number;
  outputChars?: number;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.insert(aiUsageLogs).values({
      companyId: params.companyId,
      userId: params.userId,
      module: sanitizePlainText(params.module, 60) || 'gemeo_ai_chat',
      model: sanitizePlainText(params.model || GEMEO_AI_PRIMARY_MODEL, 80),
      toolUsed: sanitizePlainText(params.toolUsed || 'general', 60),
      status: params.status,
      latencyMs: Math.max(0, Math.round(params.latencyMs)),
      inputChars: Math.max(0, Math.round(params.inputChars || 0)),
      outputChars: Math.max(0, Math.round(params.outputChars || 0)),
      errorCode: sanitizePlainText(params.errorCode || '', 60),
      errorMessage: sanitizePlainText(params.errorMessage || '', 300),
    });
  } catch (err) {
    console.warn('AI usage log warning:', err instanceof Error ? err.message : err);
  }
}

export async function getCompanyAiStatus(companyId: number, planCode: PlanCode = 'profissional') {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since10m = new Date(Date.now() - 10 * 60 * 1000);
  const dailyLimit = DAILY_COMPANY_AI_LIMITS[planCode] || DAILY_COMPANY_AI_LIMITS.profissional;

  const [recentLogs, pendingRows] = await Promise.all([
    db
      .select()
      .from(aiUsageLogs)
      .where(and(eq(aiUsageLogs.companyId, companyId), gte(aiUsageLogs.createdAt, since24h)))
      .orderBy(desc(aiUsageLogs.createdAt))
      .limit(200),
    db
      .select()
      .from(aiActionProposals)
      .where(and(eq(aiActionProposals.companyId, companyId), eq(aiActionProposals.status, 'pending')))
      .orderBy(desc(aiActionProposals.createdAt))
      .limit(15),
  ]);

  const now = new Date();
  const activePending: GemeoPendingProposalDto[] = [];
  for (const row of pendingRows) {
    if (row.expiresAt <= now) {
      await db
        .update(aiActionProposals)
        .set({ status: 'expired', resolvedAt: now })
        .where(and(eq(aiActionProposals.id, row.id), eq(aiActionProposals.status, 'pending')));
      continue;
    }
    activePending.push({
      proposalToken: row.proposalToken,
      functionName: row.functionName,
      title: row.title,
      summary: row.summary,
      args: (row.argsJson as Record<string, unknown>) || {},
      status: row.status,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    });
  }

  const dailyUsed = recentLogs.length;
  const successLogs = recentLogs.filter((l) => l.status === 'success');
  const avgLatencyMs =
    successLogs.length > 0
      ? Math.round(successLogs.reduce((acc, l) => acc + l.latencyMs, 0) / successLogs.length)
      : 0;

  const last10mLogs = recentLogs.filter((l) => l.createdAt >= since10m);
  const recentFailures = last10mLogs.filter((l) => l.status !== 'success').length;
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY);

  let availability: 'online' | 'degraded' | 'unconfigured' = 'online';
  if (!aiConfigured) {
    availability = 'unconfigured';
  } else if (recentFailures >= 3 && last10mLogs[0]?.status !== 'success') {
    availability = 'degraded';
  }

  return {
    aiConfigured,
    availability,
    model: GEMEO_AI_PRIMARY_MODEL,
    planName: PLANS_CONFIG[planCode]?.name || 'Profissional',
    dailyUsed,
    dailyLimit,
    remainingToday: Math.max(0, dailyLimit - dailyUsed),
    avgLatencyMs,
    successCount24h: successLogs.length,
    errorCount24h: recentLogs.length - successLogs.length,
    recentCalls: recentLogs.slice(0, 10).map((l) => ({
      id: l.id,
      module: l.module,
      toolUsed: l.toolUsed,
      status: l.status,
      latencyMs: l.latencyMs,
      errorCode: l.errorCode,
      createdAt: l.createdAt.toISOString(),
    })),
    pendingProposals: activePending,
  };
}

export async function assertCompanyAiQuota(companyId: number, planCode: PlanCode = 'profissional'): Promise<void> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyLimit = DAILY_COMPANY_AI_LIMITS[planCode] || DAILY_COMPANY_AI_LIMITS.profissional;
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiUsageLogs)
    .where(and(eq(aiUsageLogs.companyId, companyId), gte(aiUsageLogs.createdAt, since24h)));

  const used = Number(countRow?.count || 0);
  if (used >= dailyLimit) {
    throw new Error(
      `DAILY_COMPANY_AI_QUOTA_REACHED:${used}:${dailyLimit}`
    );
  }
}

function prepareAttachmentForGemini(attachment?: GemeoChatAttachmentInput | null): {
  ok: boolean;
  error?: string;
  inlinePart?: Part;
  extractedTextBlock?: string;
  attachmentSummary?: string;
} {
  if (!attachment || (!attachment.base64Data && !attachment.textContent)) {
    return { ok: true };
  }

  const checked = inspectDocumentOrImageUpload({
    fileName: attachment.fileName || 'documento',
    mimeType: attachment.mimeType || 'application/octet-stream',
    base64Data: attachment.base64Data,
  });

  if (!checked.ok) {
    return { ok: false, error: checked.error || 'Arquivo inválido ou bloqueado pela política de segurança.' };
  }

  const fileName = checked.safeFileName;
  const mime = checked.detectedMimeType;

  if (mime === 'application/pdf' || mime.startsWith('image/')) {
    const cleanBase64 = checked.buffer.toString('base64');
    return {
      ok: true,
      inlinePart: {
        inlineData: {
          mimeType: mime,
          data: cleanBase64,
        },
      },
      attachmentSummary: `${fileName} (${mime}, ${Math.round(checked.sizeBytes / 1024)} KB)`,
    };
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel'
  ) {
    try {
      const wb = XLSX.read(checked.buffer, { type: 'buffer', cellHTML: false });
      const blocks: string[] = [];
      let totalRows = 0;
      for (const sheetName of wb.SheetNames.slice(0, 5)) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;
        const jsonRows = stripPrototypeKeys(
          XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).slice(0, 1500)
        );
        totalRows += jsonRows.length;
        const csv = XLSX.utils.sheet_to_csv(sheet).slice(0, 6000);
        blocks.push(`--- Aba "${sanitizePlainText(sheetName, 60)}" (${jsonRows.length} linhas visíveis) ---\n${csv}`);
      }
      const text = blocks.join('\n\n').slice(0, 22000);
      return {
        ok: true,
        extractedTextBlock: `PLANILHA ANEXADA PELO USUÁRIO (${fileName}):\n${text}`,
        attachmentSummary: `${fileName} (Planilha · ${wb.SheetNames.length} aba(s), ${totalRows} linha(s) analisadas)`,
      };
    } catch {
      return { ok: false, error: 'Não foi possível ler a planilha enviada. Verifique se o arquivo não está corrompido.' };
    }
  }

  const rawText = checked.buffer.length > 0
    ? checked.buffer.toString('utf8')
    : String(attachment.textContent || '');
  const cleanText = sanitizePlainText(rawText, 22000);
  if (!cleanText) {
    return { ok: false, error: 'O documento texto/CSV enviado está vazio.' };
  }

  return {
    ok: true,
    extractedTextBlock: `DOCUMENTO TEXTO/CSV ANEXADO (${fileName}):\n${cleanText}`,
    attachmentSummary: `${fileName} (${cleanText.length} caracteres)`,
  };
}

// =========================================================================
// GEMINI FUNCTION DECLARATIONS (READ-ONLY + PROPOSE-ONLY WRITE TOOLS)
// =========================================================================

const READ_TOOLS: FunctionDeclaration[] = [
  {
    name: 'get_company_overview',
    description:
      'Consulta o perfil completo da empresa ativa no Cloud SQL: nome, segmento, CNAE, operação, endereço, unidades, integrações conectadas e contagem de dados.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeUnits: { type: Type.BOOLEAN, description: 'Se deve listar as unidades/filiais cadastradas.' },
      },
    },
  },
  {
    name: 'get_financial_dre_and_inventory',
    description:
      'Consulta dados reais de vendas, CMV, lucro bruto, custos variáveis, despesas operacionais, resultado operacional (DRE), catálogo de produtos e itens de estoque/reposição da empresa ativa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        periodMonth: { type: Type.STRING, description: 'Filtro opcional de mês no formato YYYY-MM.' },
      },
    },
  },
  {
    name: 'get_competitors_and_geo_radar',
    description:
      'Consulta concorrentes cadastrados, fornecedores/parceiros/entidades salvos no Google Maps e buscas recentes de distância/raio no Cloud SQL.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER, description: 'Quantidade máxima de itens por lista (padrão 15).' },
      },
    },
  },
  {
    name: 'get_consumer_perception',
    description:
      'Consulta notas do Google Reviews, perfil e métricas do Reclame Aqui e comentários reais de consumidores da empresa ativa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER, description: 'Máximo de comentários recentes a retornar (padrão 15).' },
      },
    },
  },
  {
    name: 'get_strategic_items',
    description:
      'Consulta SWOT/FOFA, PESTEL, 5 Forças de Porter, Matriz TOWS, sinais do Radar de Mercado, decisões estratégicas e planos de ação atuais da empresa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        kind: {
          type: Type.STRING,
          description: 'Filtro opcional: all, radar, swot, pestel, porter, tows, decision, action_plan, opportunity.',
        },
      },
    },
  },
  {
    name: 'get_macro_indicators',
    description:
      'Consulta indicadores econômicos e tributários oficiais em tempo real (Selic, IPCA, Câmbio, PIB, Desemprego e ICMS estadual) via Banco Central, IBGE e SEFAZ.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        stateUf: { type: Type.STRING, description: 'Sigla opcional da UF (ex: SP, RJ, MG).' },
      },
    },
  },
  {
    name: 'get_imported_documents',
    description:
      'Consulta documentos, PDFs e planilhas já importados e resumidos anteriormente para a empresa ativa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER, description: 'Quantidade de importações recentes (padrão 8).' },
      },
    },
  },
];

const WRITE_PROPOSAL_TOOLS: FunctionDeclaration[] = [
  {
    name: 'propose_create_action_plan',
    description:
      'Propõe a criação de uma tarefa no Plano de Ação da empresa. NÃO grava imediatamente: gera uma proposta que o usuário deverá autorizar explicitamente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título objetivo da ação.' },
        description: { type: Type.STRING, description: 'Passo a passo prático de execução.' },
        priority: { type: Type.STRING, description: 'Prioridade: alta, media ou baixa.' },
        owner: { type: Type.STRING, description: 'Área ou responsável sugerido.' },
        dueDate: { type: Type.STRING, description: 'Prazo sugerido (ex: Em 15 dias ou YYYY-MM-DD).' },
        kpi: { type: Type.STRING, description: 'Indicador para medir sucesso da ação.' },
      },
      required: ['title', 'description', 'priority'],
    },
  },
  {
    name: 'propose_create_decision',
    description:
      'Propõe registrar uma nova Decisão Estratégica na Central de Decisões para avaliação do gestor mediante autorização explícita.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título da decisão.' },
        priority: { type: Type.STRING, description: 'Prioridade: alta, media ou baixa.' },
        problem: { type: Type.STRING, description: 'Problema ou oportunidade real identificada.' },
        evidence: { type: Type.STRING, description: 'Evidências reais observadas nos dados.' },
        suggestedAction: { type: Type.STRING, description: 'Ação recomendada.' },
        expectedOutcome: { type: Type.STRING, description: 'Resultado esperado.' },
        dueDate: { type: Type.STRING, description: 'Prazo sugerido.' },
      },
      required: ['title', 'problem', 'suggestedAction'],
    },
  },
  {
    name: 'propose_create_radar_signal',
    description:
      'Propõe salvar um sinal de oportunidade, ameaça ou movimento no Radar de Mercado da empresa após autorização do usuário.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: 'Categoria: Concorrência, Setor, Custos, Canais, Eventos, Tributação, Legislação ou Consumidor.' },
        signalKind: { type: Type.STRING, description: 'oportunidade, ameaca ou movimento.' },
        title: { type: Type.STRING, description: 'Título claro do sinal.' },
        description: { type: Type.STRING, description: 'Descrição factual do movimento observado.' },
        impactNote: { type: Type.STRING, description: 'Impacto potencial na empresa.' },
        recommendation: { type: Type.STRING, description: 'Recomendação prática.' },
      },
      required: ['category', 'title', 'description'],
    },
  },
  {
    name: 'propose_create_product',
    description:
      'Propõe cadastrar um novo produto no catálogo e estoque da empresa mediante autorização do usuário.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Nome do produto.' },
        sku: { type: Type.STRING, description: 'Código/SKU opcional.' },
        priceReais: { type: Type.NUMBER, description: 'Preço unitário de venda em R$.' },
        costReais: { type: Type.NUMBER, description: 'Custo unitário de aquisição em R$.' },
        stockQty: { type: Type.INTEGER, description: 'Quantidade em estoque.' },
        description: { type: Type.STRING, description: 'Descrição curta.' },
      },
      required: ['name', 'priceReais'],
    },
  },
  {
    name: 'propose_record_internal_metric',
    description:
      'Propõe lançar um registro de métrica interna (faturamento, pedidos, margem ou perdas) mediante autorização do usuário.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        periodDate: { type: Type.STRING, description: 'Data ou período (YYYY-MM-DD).' },
        revenueReais: { type: Type.NUMBER, description: 'Faturamento em reais.' },
        ordersCount: { type: Type.INTEGER, description: 'Quantidade de pedidos.' },
        lossesReais: { type: Type.NUMBER, description: 'Perdas/avarias em reais.' },
        grossMarginPct: { type: Type.STRING, description: 'Margem bruta percentual (ex: 42%).' },
      },
      required: ['revenueReais', 'ordersCount'],
    },
  },
];

async function executeReadTool(
  toolName: string,
  args: Record<string, unknown>,
  company: typeof companies.$inferSelect
): Promise<unknown> {
  const companyId = company.id;

  switch (toolName) {
    case 'get_company_overview': {
      const [units, ints, prods, comps, revs, imps] = await Promise.all([
        db.select().from(companyUnits).where(eq(companyUnits.companyId, companyId)),
        db.select().from(integrations).where(eq(integrations.companyId, companyId)),
        db.select({ id: products.id }).from(products).where(eq(products.companyId, companyId)),
        db.select({ id: competitors.id }).from(competitors).where(eq(competitors.companyId, companyId)),
        db.select({ id: customerReviews.id }).from(customerReviews).where(eq(customerReviews.companyId, companyId)),
        db.select({ id: dataImports.id }).from(dataImports).where(eq(dataImports.companyId, companyId)),
      ]);
      return {
        company: {
          id: company.id,
          name: company.name,
          legalName: company.legalName,
          cnpj: company.cnpj,
          cnae: company.cnae,
          segment: company.segment,
          operationType: company.operationType,
          address: company.address,
          city: company.city,
          state: company.state,
          website: company.website,
          description: company.description,
        },
        units: args.includeUnits !== false ? units.map((u) => ({ name: u.name, city: u.city, state: u.state, isPrimary: u.isPrimary })) : [],
        connectedIntegrations: ints.filter((i) => i.connectionStatus === 'connected').map((i) => i.accountLabel),
        counts: {
          products: prods.length,
          competitors: comps.length,
          reviews: revs.length,
          importedDocuments: imps.length,
        },
      };
    }

    case 'get_financial_dre_and_inventory': {
      const periodFilter = typeof args.periodMonth === 'string' && /^\d{4}-\d{2}$/.test(args.periodMonth)
        ? args.periodMonth
        : null;
      const [sales, costs, expenses, inventory, prods] = await Promise.all([
        db.select().from(financialSalesRecords).where(eq(financialSalesRecords.companyId, companyId)).orderBy(desc(financialSalesRecords.periodMonth)).limit(200),
        db.select().from(financialCostRecords).where(eq(financialCostRecords.companyId, companyId)).orderBy(desc(financialCostRecords.periodMonth)).limit(200),
        db.select().from(financialExpenseRecords).where(eq(financialExpenseRecords.companyId, companyId)).orderBy(desc(financialExpenseRecords.periodMonth)).limit(200),
        db.select().from(inventoryControlItems).where(eq(inventoryControlItems.companyId, companyId)).orderBy(desc(inventoryControlItems.periodMonth)).limit(200),
        db.select().from(products).where(eq(products.companyId, companyId)).orderBy(desc(products.soldUnits)).limit(30),
      ]);

      const fSales = periodFilter ? sales.filter((s) => s.periodMonth === periodFilter) : sales;
      const fCosts = periodFilter ? costs.filter((c) => c.periodMonth === periodFilter) : costs;
      const fExpenses = periodFilter ? expenses.filter((e) => e.periodMonth === periodFilter) : expenses;
      const fInventory = periodFilter ? inventory.filter((i) => i.periodMonth === periodFilter) : inventory;

      const summary = computeFinancialSummary({
        sales: fSales,
        costs: fCosts,
        expenses: fExpenses,
        inventory: fInventory,
      });

      return {
        periodApplied: periodFilter || 'Todos os períodos registrados',
        hasFinancialData: summary.hasData,
        dreFormatted: summary.hasData
          ? {
              receitaTotal: formatBrlFromCents(summary.totalRevenueCents),
              unidadesVendidas: summary.totalUnitsSold,
              cmvTotal: formatBrlFromCents(summary.totalCmvCents),
              lucroBruto: formatBrlFromCents(summary.grossProfitCents),
              margemBruta: formatPct(summary.grossMarginPct),
              outrosCustosVariaveis: formatBrlFromCents(summary.totalVariableCostsCents),
              despesasOperacionais: formatBrlFromCents(summary.totalOperatingExpensesCents),
              resultadoOperacional: formatBrlFromCents(summary.operatingResultCents),
              margemOperacional: formatPct(summary.operatingMarginPct),
              valorEstoque: formatBrlFromCents(summary.totalInventoryValueCents),
              itensCriticosEstoque: summary.criticalStockItemsCount,
              categoriasReposicao: summary.categoriesNeedingReplenishment,
            }
          : null,
        topProducts: prods.slice(0, 15).map((p) => ({
          name: p.name,
          sku: p.sku,
          price: formatBrlFromCents(p.priceCents),
          cost: formatBrlFromCents(p.acquisitionCostCents),
          stockQty: p.stockQty,
          soldUnits: p.soldUnits,
        })),
      };
    }

    case 'get_competitors_and_geo_radar': {
      const limit = Math.min(25, Math.max(1, Number(args.limit || 15)));
      const [comps, geoEnts, geoLogs] = await Promise.all([
        db.select().from(competitors).where(eq(competitors.companyId, companyId)).limit(limit),
        db.select().from(geoSavedEntities).where(eq(geoSavedEntities.companyId, companyId)).orderBy(desc(geoSavedEntities.lastUpdatedAt)).limit(limit),
        db.select().from(geoSearchLogs).where(eq(geoSearchLogs.companyId, companyId)).orderBy(desc(geoSearchLogs.createdAt)).limit(8),
      ]);
      return {
        competitors: comps.map((c) => ({
          name: c.name,
          segment: c.segment,
          positioning: c.positioning,
          priceRange: c.announcedPriceRange,
          priceComparison: c.priceComparison,
          publicRating: c.publicRating,
          threatLevel: c.threatLevel,
          complaintsNote: c.complaintsNote,
        })),
        geoSavedEntities: geoEnts.map((g) => ({
          entityKind: g.entityKind,
          classification: g.classification,
          name: g.name,
          address: g.address,
          distanceKm: g.distanceKm,
          travelTimeText: g.travelTimeText,
          rating: g.publicRating,
        })),
        recentGeoSearches: geoLogs.map((l) => ({
          type: l.searchType,
          query: l.query,
          center: l.centerAddress,
          radiusKm: l.radiusKm,
          resultsCount: l.resultsCount,
          alertsSummary: l.alertsSummary,
        })),
      };
    }

    case 'get_consumer_perception': {
      const limit = Math.min(25, Math.max(1, Number(args.limit || 15)));
      const [[rep], reviews] = await Promise.all([
        db.select().from(companyReputationProfiles).where(eq(companyReputationProfiles.companyId, companyId)),
        db.select().from(customerReviews).where(eq(customerReviews.companyId, companyId)).orderBy(desc(customerReviews.createdAt)).limit(limit),
      ]);
      return {
        reputationProfile: rep
          ? {
              googleRating: rep.googleRating,
              googleRatingsTotal: rep.googleRatingsTotal,
              googleSyncStatus: rep.googleSyncStatus,
              reclameAquiUrl: rep.reclameAquiUrl,
              reclameAquiScore: rep.reclameAquiScore,
              reclameAquiStatusLabel: rep.reclameAquiStatusLabel,
              reclameAquiResponseRatePct: rep.reclameAquiResponseRatePct,
              reclameAquiSolvedRatePct: rep.reclameAquiSolvedRatePct,
              aiDiagnosis: rep.aiDiagnosisJson,
            }
          : null,
        reviews: reviews.map((r) => ({
          source: r.source,
          rating: r.rating,
          sentiment: r.sentiment,
          commentText: r.commentText,
          reviewedAt: r.reviewedAt,
        })),
      };
    }

    case 'get_strategic_items': {
      const kind = typeof args.kind === 'string' ? args.kind.trim().toLowerCase() : 'all';
      const rows = await db
        .select()
        .from(strategicItems)
        .where(eq(strategicItems.companyId, companyId))
        .orderBy(desc(strategicItems.createdAt))
        .limit(80);
      const filtered = kind && kind !== 'all' ? rows.filter((r) => r.kind === kind) : rows;
      return {
        totalCount: filtered.length,
        items: filtered.slice(0, 40).map((s) => ({
          id: s.id,
          kind: s.kind,
          category: s.category,
          title: s.title,
          description: s.description,
          priority: s.priority,
          status: s.status,
          impactNote: s.impactNote,
          dueDate: s.dueDate,
        })),
      };
    }

    case 'get_macro_indicators': {
      const uf = sanitizePlainText(args.stateUf || company.state || 'SP', 2).toUpperCase();
      const bundle = await getOfficialMacroBundle(uf);
      return {
        stateUf: uf,
        fetchedAt: bundle.fetchedAt,
        indicators: bundle.indicators.map((m) => ({
          code: m.code,
          label: m.label,
          value: m.status === 'ok' ? `${m.value} ${m.unit}` : 'Indisponível',
          comparison: m.comparisonText,
          referenceDate: m.referenceDate,
          source: m.source,
        })),
      };
    }

    case 'get_imported_documents': {
      const limit = Math.min(12, Math.max(1, Number(args.limit || 8)));
      const docs = await db
        .select()
        .from(dataImports)
        .where(eq(dataImports.companyId, companyId))
        .orderBy(desc(dataImports.createdAt))
        .limit(limit);
      return {
        documents: docs.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          fileType: d.fileType,
          sourceOrigin: d.sourceOrigin,
          reliabilityLevel: d.reliabilityLevel,
          rowCount: d.rowCount,
          summaryText: d.summaryText,
          insights: d.insightsJson,
          createdAt: d.createdAt.toISOString(),
        })),
      };
    }

    default:
      return { error: 'Ferramenta desconhecida.' };
  }
}

function buildProposalDisplayAndSanitizedArgs(
  functionName: string,
  rawArgs: Record<string, unknown>
): {
  valid: boolean;
  title: string;
  summary: string;
  sanitizedArgs: Record<string, unknown>;
} {
  switch (functionName) {
    case 'propose_create_action_plan': {
      const title = sanitizePlainText(rawArgs.title, 180);
      if (!title) return { valid: false, title: '', summary: '', sanitizedArgs: {} };
      const priority = ['alta', 'media', 'baixa'].includes(String(rawArgs.priority || '').toLowerCase())
        ? String(rawArgs.priority).toLowerCase()
        : 'media';
      const sanitizedArgs = {
        title,
        description: sanitizePlainText(rawArgs.description, 1500),
        priority,
        owner: sanitizePlainText(rawArgs.owner || 'Gestor', 100) || 'Gestor',
        dueDate: sanitizePlainText(rawArgs.dueDate || 'Em 15 dias', 40) || 'Em 15 dias',
        kpi: sanitizePlainText(rawArgs.kpi || 'Acompanhar evolução semanal', 180),
      };
      return {
        valid: true,
        title: `Criar Plano de Ação: ${title}`,
        summary: `Prioridade ${priority} · Responsável: ${sanitizedArgs.owner} · Prazo: ${sanitizedArgs.dueDate}`,
        sanitizedArgs,
      };
    }

    case 'propose_create_decision': {
      const title = sanitizePlainText(rawArgs.title, 180);
      if (!title) return { valid: false, title: '', summary: '', sanitizedArgs: {} };
      const priority = ['alta', 'media', 'baixa'].includes(String(rawArgs.priority || '').toLowerCase())
        ? String(rawArgs.priority).toLowerCase()
        : 'media';
      const sanitizedArgs = {
        title,
        priority,
        problem: sanitizePlainText(rawArgs.problem, 1200),
        evidence: sanitizePlainText(rawArgs.evidence, 1200),
        suggestedAction: sanitizePlainText(rawArgs.suggestedAction, 1200),
        expectedOutcome: sanitizePlainText(rawArgs.expectedOutcome, 600),
        dueDate: sanitizePlainText(rawArgs.dueDate || 'Esta semana', 40),
      };
      return {
        valid: true,
        title: `Registrar Decisão Estratégica: ${title}`,
        summary: `Prioridade ${priority} · Ação sugerida: ${sanitizedArgs.suggestedAction.slice(0, 90)}`,
        sanitizedArgs,
      };
    }

    case 'propose_create_radar_signal': {
      const title = sanitizePlainText(rawArgs.title, 180);
      if (!title) return { valid: false, title: '', summary: '', sanitizedArgs: {} };
      const signalKind = ['oportunidade', 'ameaca', 'movimento'].includes(String(rawArgs.signalKind || '').toLowerCase())
        ? String(rawArgs.signalKind).toLowerCase()
        : 'movimento';
      const sanitizedArgs = {
        category: sanitizePlainText(rawArgs.category || 'Setor', 60) || 'Setor',
        signalKind,
        title,
        description: sanitizePlainText(rawArgs.description, 1500),
        impactNote: sanitizePlainText(rawArgs.impactNote, 600),
        recommendation: sanitizePlainText(rawArgs.recommendation, 800),
      };
      return {
        valid: true,
        title: `Registrar Sinal no Radar: ${title}`,
        summary: `Categoria: ${sanitizedArgs.category} · Tipo: ${signalKind}`,
        sanitizedArgs,
      };
    }

    case 'propose_create_product': {
      const name = sanitizePlainText(rawArgs.name, 160);
      if (!name) return { valid: false, title: '', summary: '', sanitizedArgs: {} };
      const priceReais = Math.max(0, Number(rawArgs.priceReais || 0) || 0);
      const costReais = Math.max(0, Number(rawArgs.costReais || 0) || 0);
      const stockQty = Math.max(0, Math.round(Number(rawArgs.stockQty || 0) || 0));
      const sanitizedArgs = {
        name,
        sku: sanitizePlainText(rawArgs.sku, 64),
        priceReais,
        costReais,
        stockQty,
        description: sanitizePlainText(rawArgs.description, 800),
      };
      return {
        valid: true,
        title: `Cadastrar Produto: ${name}`,
        summary: `Preço: R$ ${priceReais.toFixed(2)} · Estoque inicial: ${stockQty} un.`,
        sanitizedArgs,
      };
    }

    case 'propose_record_internal_metric': {
      const revenueReais = Math.max(0, Number(rawArgs.revenueReais || 0) || 0);
      const ordersCount = Math.max(0, Math.round(Number(rawArgs.ordersCount || 0) || 0));
      const lossesReais = Math.max(0, Number(rawArgs.lossesReais || 0) || 0);
      const periodDate = sanitizePlainText(rawArgs.periodDate || new Date().toISOString().slice(0, 10), 20);
      const sanitizedArgs = {
        periodDate,
        revenueReais,
        ordersCount,
        lossesReais,
        grossMarginPct: sanitizePlainText(rawArgs.grossMarginPct, 24),
        sourceOrigin: 'Gêmeo Digital AI (autorizado)',
      };
      return {
        valid: true,
        title: `Lançar Métrica Interna (${periodDate})`,
        summary: `Receita: R$ ${revenueReais.toLocaleString('pt-BR')} · Pedidos: ${ordersCount}`,
        sanitizedArgs,
      };
    }

    default:
      return { valid: false, title: '', summary: '', sanitizedArgs: {} };
  }
}

async function createPendingActionProposal(params: {
  companyId: number;
  userId: number;
  userRole: string;
  functionName: string;
  rawArgs: Record<string, unknown>;
}): Promise<{ created: boolean; proposal?: GemeoPendingProposalDto; note: string }> {
  if (params.userRole === 'viewer') {
    return {
      created: false,
      note: 'Usuário com perfil somente leitura (viewer) não possui permissão para executar alterações internas.',
    };
  }

  const built = buildProposalDisplayAndSanitizedArgs(params.functionName, params.rawArgs);
  if (!built.valid) {
    return {
      created: false,
      note: 'Parâmetros insuficientes ou inválidos para propor esta operação interna.',
    };
  }

  const proposalToken = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const [row] = await db
    .insert(aiActionProposals)
    .values({
      proposalToken,
      companyId: params.companyId,
      userId: params.userId,
      functionName: params.functionName,
      title: built.title,
      summary: built.summary,
      argsJson: built.sanitizedArgs,
      status: 'pending',
      expiresAt,
    })
    .returning();

  return {
    created: true,
    proposal: {
      proposalToken: row.proposalToken,
      functionName: row.functionName,
      title: row.title,
      summary: row.summary,
      args: built.sanitizedArgs,
      status: row.status,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    },
    note: `Proposta "${built.title}" criada e aguardando autorização explícita do usuário na interface antes de gravar no banco.`,
  };
}

export async function resolveAiActionProposal(params: {
  proposalToken: string;
  companyId: number;
  userId: number;
  userEmail: string;
  userRole: string;
  action: 'approve' | 'reject';
}): Promise<{
  ok: boolean;
  statusCode: number;
  status: string;
  message: string;
  entityType?: string;
  createdRecord?: unknown;
}> {
  if (params.userRole === 'viewer') {
    return {
      ok: false,
      statusCode: 403,
      status: 'forbidden',
      message: 'Usuários com papel viewer não podem autorizar nem executar alterações na empresa.',
    };
  }

  const token = sanitizePlainText(params.proposalToken, 80);
  if (!/^[a-f0-9]{16,64}$/i.test(token)) {
    return {
      ok: false,
      statusCode: 400,
      status: 'invalid',
      message: 'Token de proposta inválido.',
    };
  }

  const [proposal] = await db
    .select()
    .from(aiActionProposals)
    .where(and(eq(aiActionProposals.proposalToken, token), eq(aiActionProposals.companyId, params.companyId)));

  if (!proposal) {
    return {
      ok: false,
      statusCode: 404,
      status: 'not_found',
      message: 'Proposta de ação não encontrada para esta empresa.',
    };
  }

  if (proposal.status !== 'pending') {
    return {
      ok: false,
      statusCode: 409,
      status: proposal.status,
      message: `Esta proposta já foi processada anteriormente (${proposal.status}).`,
    };
  }

  const now = new Date();
  if (proposal.expiresAt <= now) {
    await db
      .update(aiActionProposals)
      .set({ status: 'expired', resolvedAt: now })
      .where(and(eq(aiActionProposals.id, proposal.id), eq(aiActionProposals.status, 'pending')));
    return {
      ok: false,
      statusCode: 410,
      status: 'expired',
      message: 'Esta proposta expirou (limite de 15 minutos). Solicite novamente à IA caso queira executá-la.',
    };
  }

  if (params.action === 'reject') {
    const [rejected] = await db
      .update(aiActionProposals)
      .set({
        status: 'rejected',
        approvedByUserId: params.userId,
        resolvedAt: now,
      })
      .where(and(eq(aiActionProposals.id, proposal.id), eq(aiActionProposals.status, 'pending')))
      .returning();

    if (!rejected) {
      return { ok: false, statusCode: 409, status: 'conflict', message: 'Proposta já processada.' };
    }

    await recordAuditLog({
      companyId: params.companyId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'AI_PROPOSAL_REJECTED',
      entityType: 'ai_action_proposal',
      entityId: rejected.id,
      details: { functionName: proposal.functionName, title: proposal.title },
    });

    return {
      ok: true,
      statusCode: 200,
      status: 'rejected',
      message: 'Operação sugerida pela IA foi cancelada pelo usuário. Nenhuma alteração foi feita.',
    };
  }

  // Re-validate and sanitize args from DB before executing
  const built = buildProposalDisplayAndSanitizedArgs(
    proposal.functionName,
    (proposal.argsJson as Record<string, unknown>) || {}
  );
  if (!built.valid) {
    return {
      ok: false,
      statusCode: 400,
      status: 'invalid',
      message: 'Os parâmetros da proposta falharam na validação de segurança.',
    };
  }

  // Atomic claim to prevent double execution
  const [claimed] = await db
    .update(aiActionProposals)
    .set({
      status: 'executed',
      approvedByUserId: params.userId,
      resolvedAt: now,
    })
    .where(and(eq(aiActionProposals.id, proposal.id), eq(aiActionProposals.status, 'pending')))
    .returning();

  if (!claimed) {
    return {
      ok: false,
      statusCode: 409,
      status: 'conflict',
      message: 'Esta proposta já foi autorizada ou processada.',
    };
  }

  const args = built.sanitizedArgs;
  let entityType = 'strategic_item';
  let createdRecord: Record<string, unknown> | null = null;

  if (proposal.functionName === 'propose_create_action_plan') {
    const [inserted] = await db
      .insert(strategicItems)
      .values({
        companyId: params.companyId,
        kind: 'action_plan',
        category: 'Execução IA',
        title: String(args.title),
        description: String(args.description || ''),
        priority: String(args.priority || 'media'),
        status: 'aberto',
        impactNote: `KPI: ${String(args.kpi || 'Acompanhamento semanal')}`,
        dueDate: String(args.dueDate || 'Em 15 dias'),
        metadataJson: {
          owner: String(args.owner || 'Gestor'),
          kpi: String(args.kpi || ''),
          completionPct: 0,
          createdByAiProposalToken: proposal.proposalToken,
        },
      })
      .returning();
    createdRecord = inserted as unknown as Record<string, unknown>;
  } else if (proposal.functionName === 'propose_create_decision') {
    const [inserted] = await db
      .insert(strategicItems)
      .values({
        companyId: params.companyId,
        kind: 'decision',
        category: 'Decisão Estratégica',
        title: String(args.title),
        description: String(args.problem || ''),
        priority: String(args.priority || 'media'),
        status: 'aberto',
        impactNote: String(args.expectedOutcome || ''),
        dueDate: String(args.dueDate || 'Esta semana'),
        metadataJson: {
          problem: String(args.problem || ''),
          evidence: String(args.evidence || ''),
          suggestedAction: String(args.suggestedAction || ''),
          expectedOutcome: String(args.expectedOutcome || ''),
          createdByAiProposalToken: proposal.proposalToken,
        },
      })
      .returning();
    createdRecord = inserted as unknown as Record<string, unknown>;
  } else if (proposal.functionName === 'propose_create_radar_signal') {
    const signalKind = String(args.signalKind || 'movimento');
    const [inserted] = await db
      .insert(strategicItems)
      .values({
        companyId: params.companyId,
        kind: 'radar',
        category: String(args.category || 'Setor'),
        title: String(args.title),
        description: String(args.description || ''),
        priority: signalKind === 'ameaca' ? 'alta' : 'media',
        status: 'aberto',
        impactNote: String(args.impactNote || ''),
        dueDate: new Date().toLocaleDateString('pt-BR'),
        metadataJson: {
          signalKind,
          recommendation: String(args.recommendation || ''),
          sourceName: 'Gêmeo Digital AI (autorizado)',
          createdByAiProposalToken: proposal.proposalToken,
        },
      })
      .returning();
    createdRecord = inserted as unknown as Record<string, unknown>;
  } else if (proposal.functionName === 'propose_create_product') {
    entityType = 'product';
    const [inserted] = await db
      .insert(products)
      .values({
        companyId: params.companyId,
        name: String(args.name),
        sku: String(args.sku || ''),
        description: String(args.description || ''),
        priceCents: Math.round(Number(args.priceReais || 0) * 100),
        acquisitionCostCents: Math.round(Number(args.costReais || 0) * 100),
        stockQty: Math.max(0, Math.round(Number(args.stockQty || 0))),
        status: 'active',
        imageUrl: '',
      })
      .returning();
    createdRecord = inserted as unknown as Record<string, unknown>;
  } else if (proposal.functionName === 'propose_record_internal_metric') {
    entityType = 'internal_metric';
    const revCents = Math.round(Number(args.revenueReais || 0) * 100);
    const orders = Math.max(0, Math.round(Number(args.ordersCount || 0)));
    const [inserted] = await db
      .insert(internalMetrics)
      .values({
        companyId: params.companyId,
        periodDate: String(args.periodDate || new Date().toISOString().slice(0, 10)),
        revenueCents: revCents,
        ordersCount: orders,
        avgTicketCents: orders > 0 ? Math.round(revCents / orders) : 0,
        grossMarginPct: String(args.grossMarginPct || ''),
        lossesCents: Math.round(Number(args.lossesReais || 0) * 100),
        sourceOrigin: 'Gêmeo Digital AI (autorizado)',
        reliabilityLevel: 'alta',
      })
      .returning();
    createdRecord = inserted as unknown as Record<string, unknown>;
  }

  await db
    .update(aiActionProposals)
    .set({
      resultJson: createdRecord ? { id: createdRecord.id, entityType } : {},
    })
    .where(eq(aiActionProposals.id, claimed.id));

  await recordAuditLog({
    companyId: params.companyId,
    userId: params.userId,
    userEmail: params.userEmail,
    action: 'AI_PROPOSAL_AUTHORIZED_AND_EXECUTED',
    entityType,
    entityId: Number(createdRecord?.id || claimed.id),
    details: { functionName: proposal.functionName, title: proposal.title },
  });

  return {
    ok: true,
    statusCode: 200,
    status: 'executed',
    entityType,
    createdRecord,
    message: `Ação autorizada e gravada com sucesso (${built.title}).`,
  };
}

function classifyIntentMode(question: string, hasAttachment: boolean): 'maps' | 'search' | 'cloudsql' {
  const q = question.toLowerCase();
  const mapsPatterns =
    /\b(rota|rotas|caminho|como chegar|trajeto|google maps|mapa|localiza[çc][ãa]o|endere[çc]o|onde fica|perto de|pr[óo]xim[oa]s?|raio|km|quil[ôo]metros?|hor[áa]rio de funcionamento|avalia[çc][õo]es no maps|concorrentes? na regi[ãa]o)\b/i;
  const searchPatterns =
    /\b(hoje|atual|atuais|atualmente|2025|2026|not[íi]cia|not[íi]cias|recente|recentes|agora|nova lei|reforma tribut[áa]ria|legisla[çc][ãa]o vigente|tend[êe]ncia|pesquise na internet|buscar na web|google search|mercado brasileiro|setor no brasil)\b/i;

  if (mapsPatterns.test(q) && !/\bdist[âa]ncia entre.*(minhas|cadastradas)\b/i.test(q)) {
    return 'maps';
  }
  if (!hasAttachment && searchPatterns.test(q)) {
    return 'search';
  }
  return 'cloudsql';
}

function extractLinksFromResponse(response: unknown, preferred: 'maps' | 'search'): GemeoGroundingLink[] {
  const candidates = (response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          maps?: { uri?: string; title?: string };
          web?: { uri?: string; title?: string };
        }>;
      };
    }>;
  })?.candidates;

  const chunks = candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const links: GemeoGroundingLink[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    if (chunk.maps?.uri && !seen.has(chunk.maps.uri)) {
      seen.add(chunk.maps.uri);
      links.push({
        title: chunk.maps.title || 'Local no Google Maps',
        uri: chunk.maps.uri,
        sourceType: 'maps',
      });
    } else if (preferred === 'search' && chunk.web?.uri && !seen.has(chunk.web.uri)) {
      seen.add(chunk.web.uri);
      links.push({
        title: chunk.web.title || 'Referência Web',
        uri: chunk.web.uri,
        sourceType: 'search',
      });
    }
  }
  return links.slice(0, 10);
}

function buildMultiTurnContentsForGemeo(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentParts: Part[]
): Content[] {
  const turns: Content[] = [];

  for (const item of history.slice(-24)) {
    const txt = (item.content || '').trim();
    if (!txt) continue;
    const role: 'user' | 'model' = item.role === 'user' ? 'user' : 'model';
    if (turns.length === 0 && role === 'model') continue;

    const prev = turns[turns.length - 1];
    if (prev && prev.role === role && prev.parts?.[0]?.text) {
      prev.parts[0].text = `${prev.parts[0].text}\n\n${txt}`;
    } else {
      turns.push({ role, parts: [{ text: txt }] });
    }
  }

  const last = turns[turns.length - 1];
  if (last && last.role === 'user') {
    last.parts = [...(last.parts || []), ...currentParts];
  } else {
    turns.push({ role: 'user', parts: currentParts });
  }

  return turns;
}

export async function runGemeoDigitalAiChat(params: {
  company: typeof companies.$inferSelect;
  userId: number;
  userRole: string;
  planCode: PlanCode;
  question: string;
  screenContext: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  companiesDirectoryText?: string;
  distanceQueriesSummary?: string;
  userLatLng?: { latitude: number; longitude: number } | null;
  attachment?: GemeoChatAttachmentInput | null;
  moduleName?: string;
}): Promise<GemeoAiChatResponse> {
  const startedAt = Date.now();
  const companyId = params.company.id;

  // 1. Validate attachment safely BEFORE quota/model call
  const prep = prepareAttachmentForGemini(params.attachment);
  if (!prep.ok) {
    throw new Error(prep.error || 'Arquivo inválido.');
  }

  // 2. Enforce daily quota per company
  await assertCompanyAiQuota(companyId, params.planCode);

  const ai = getAiClient();
  const hasAttachment = Boolean(prep.inlinePart || prep.extractedTextBlock);
  const intentMode = classifyIntentMode(params.question, hasAttachment);

  const allDeclarations =
    params.userRole === 'viewer'
      ? READ_TOOLS
      : [...READ_TOOLS, ...WRITE_PROPOSAL_TOOLS];

  const systemInstruction = `Você é o **Gêmeo Digital AI**, o módulo central de inteligência empresarial multissetorial da empresa "${params.company.name}" (Segmento: "${params.company.segment || 'Geral'}", Região: "${[params.company.city, params.company.state].filter(Boolean).join('/') || 'Brasil'}").

TELA ATUAL DO USUÁRIO: ${params.screenContext}
PAPEL DO USUÁRIO AUTENTICADO: ${params.userRole}

EMPRESAS DO USUÁRIO NO CLOUD SQL:
${params.companiesDirectoryText || params.company.name}

CONSULTAS DE DISTÂNCIA E RAIO NO CLOUD SQL:
${params.distanceQueriesSummary || 'Nenhuma consulta de distância registrada recentemente.'}

REGRAS CRÍTICAS DE OPERAÇÃO E SEGURANÇA:
1. **DADOS REAIS PRIMEIRO**: Sempre que o usuário perguntar sobre vendas, DRE, CMV, margem, despesas, estoque, produtos, concorrentes, avaliações de clientes, SWOT/decisões, documentos importados ou economia (Selic/IPCA/ICMS), chame as ferramentas de leitura correspondentes (\`get_*\`) antes de responder.
2. **ANTI-ALUCINAÇÃO**: Se uma ferramenta retornar vazio ou indisponível, diga explicitamente **"Não encontrei essa informação nos registros atuais"** e explique qual dado ou arquivo o usuário deve cadastrar. NUNCA invente faturamento, preços, notas, endereços ou concorrentes.
3. **ISOLAMENTO MULTI-TENANT**: Você opera exclusivamente no contexto da empresa "${params.company.name}" (ou nas demais empresas listadas do mesmo usuário autenticado quando consultadas no diretório). Nunca tente acessar dados de terceiros.
4. **EXECUÇÃO MEDIANTE AUTORIZAÇÃO**: Se o usuário pedir para criar um plano de ação, registrar decisão estratégica, salvar sinal no Radar, cadastrar produto ou lançar métrica, chame a ferramenta \`propose_*\` correspondente. Informe claramente na resposta que a proposta foi gerada e aguarda o clique em **"Autorizar e Executar"** pelo usuário. Nunca afirme que já gravou no banco antes da confirmação.
5. **ANEXOS E PLANILHAS**: Se o usuário anexou PDF, imagem ou planilha nesta mensagem, analise fielmente o conteúdo real do documento, cruze com os dados da empresa quando útil e destaque achados objetivos e limitações.
6. **CLAREZA EXECUTIVA**: Responda em português do Brasil, estruturado, objetivo e acionável. Não dê aconselhamento jurídico/contábil definitivo.`;

  const userParts: Part[] = [];
  if (prep.inlinePart) userParts.push(prep.inlinePart);
  if (prep.extractedTextBlock) userParts.push({ text: prep.extractedTextBlock });
  userParts.push({ text: params.question });

  const contents = buildMultiTurnContentsForGemeo(params.history, userParts);

  const toolsInvoked = new Set<string>();
  const pendingProposals: GemeoPendingProposalDto[] = [];
  const groundingLinks: GemeoGroundingLink[] = [];
  let effectiveToolUsed: 'cloudsql' | 'maps' | 'search' | 'general' =
    intentMode === 'maps' ? 'maps' : intentMode === 'search' ? 'search' : 'cloudsql';

  // Configure hybrid tools according to Gemini API rules:
  // googleMaps CANNOT be combined with googleSearch; combining built-in tool + functionDeclarations requires includeServerSideToolInvocations: true
  const buildConfig = (mode: 'maps' | 'search' | 'cloudsql', hybridWithFunctions: boolean): Record<string, unknown> => {
    const cfg: Record<string, unknown> = { systemInstruction };
    if (mode === 'maps') {
      cfg.tools = hybridWithFunctions
        ? [{ googleMaps: {} }, { functionDeclarations: allDeclarations }]
        : [{ googleMaps: {} }];
      cfg.toolConfig = {
        ...(hybridWithFunctions ? { includeServerSideToolInvocations: true } : {}),
        ...(params.userLatLng ? { retrievalConfig: { latLng: params.userLatLng } } : {}),
      };
    } else if (mode === 'search') {
      cfg.tools = [{ googleSearch: {} }, { functionDeclarations: allDeclarations }];
      cfg.toolConfig = { includeServerSideToolInvocations: true };
    } else {
      cfg.tools = [{ functionDeclarations: allDeclarations }];
    }
    return cfg;
  };

  let activeMode: 'maps' | 'search' | 'cloudsql' = intentMode;
  let hybridMapsEnabled = true;
  let finalResponseText = '';

  try {
    for (let round = 0; round < 5; round++) {
      let response;
      try {
        response = await ai.models.generateContent({
          model: GEMEO_AI_PRIMARY_MODEL,
          contents,
          config: buildConfig(activeMode, hybridMapsEnabled),
        });
      } catch (err) {
        // Fallback if hybrid googleMaps + functionDeclarations is rejected on this model/endpoint
        if (activeMode === 'maps' && hybridMapsEnabled && round === 0) {
          hybridMapsEnabled = false;
          response = await ai.models.generateContent({
            model: GEMEO_AI_PRIMARY_MODEL,
            contents,
            config: buildConfig('maps', false),
          });
        } else {
          throw err;
        }
      }

      const links = extractLinksFromResponse(response, activeMode === 'maps' ? 'maps' : 'search');
      for (const lk of links) {
        if (!groundingLinks.some((g) => g.uri === lk.uri)) groundingLinks.push(lk);
      }

      const calls = response.functionCalls;
      if (!calls || calls.length === 0) {
        finalResponseText = response.text?.trim() || '';
        break;
      }

      // Preserve exact model turn (includes thoughtSignature & functionCall)
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      }

      const fnResponseParts: Part[] = [];
      for (const call of calls) {
        const fnName = call.name || '';
        const fnArgs = stripPrototypeKeys((call.args as Record<string, unknown>) || {});
        toolsInvoked.add(fnName);

        let resultPayload: unknown;
        if (fnName.startsWith('propose_')) {
          const propOut = await createPendingActionProposal({
            companyId,
            userId: params.userId,
            userRole: params.userRole,
            functionName: fnName,
            rawArgs: fnArgs,
          });
          if (propOut.created && propOut.proposal) {
            pendingProposals.push(propOut.proposal);
          }
          resultPayload = { status: propOut.created ? 'pending_user_authorization' : 'denied', message: propOut.note };
        } else {
          resultPayload = await executeReadTool(fnName, fnArgs, params.company);
        }

        fnResponseParts.push({
          functionResponse: {
            id: call.id,
            name: fnName,
            response: { result: resultPayload },
          },
        });
      }

      contents.push({ role: 'user', parts: fnResponseParts });
      effectiveToolUsed = activeMode === 'maps' ? 'maps' : activeMode === 'search' ? 'search' : 'cloudsql';
    }

    if (!finalResponseText) {
      finalResponseText =
        pendingProposals.length > 0
          ? 'Preparei a proposta de operação abaixo. Revise os parâmetros e clique em **Autorizar e Executar** para confirmar a gravação.'
          : 'Não encontrei essa informação nos dados disponíveis neste momento.';
    }

    const sourcesUsed: string[] = [`Cloud SQL (${params.company.name})`];
    if (toolsInvoked.size > 0) {
      sourcesUsed.push(`Ferramentas: ${Array.from(toolsInvoked).join(', ')}`);
    }
    if (prep.attachmentSummary) {
      sourcesUsed.push(`Anexo: ${prep.attachmentSummary}`);
    }
    if (effectiveToolUsed === 'maps') sourcesUsed.push('Google Maps Grounding');
    if (effectiveToolUsed === 'search') sourcesUsed.push('Google Search Grounding');

    const latencyMs = Date.now() - startedAt;
    await recordAiUsage({
      companyId,
      userId: params.userId,
      module: params.moduleName || 'gemeo_ai_chat',
      model: GEMEO_AI_PRIMARY_MODEL,
      toolUsed: toolsInvoked.size > 0 ? 'function_call' : effectiveToolUsed,
      status: 'success',
      latencyMs,
      inputChars: params.question.length,
      outputChars: finalResponseText.length,
    });

    return {
      answer: finalResponseText,
      toolUsed: effectiveToolUsed,
      groundingLinks,
      sourcesUsed,
      toolsInvoked: Array.from(toolsInvoked),
      pendingProposals,
      attachmentSummary: prep.attachmentSummary,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const classified = classifyAiErrorForUser(err);
    await recordAiUsage({
      companyId,
      userId: params.userId,
      module: params.moduleName || 'gemeo_ai_chat',
      model: GEMEO_AI_PRIMARY_MODEL,
      toolUsed: effectiveToolUsed,
      status: classified.code === 'QUOTA_EXCEEDED' ? 'quota_exceeded' : 'error',
      latencyMs,
      inputChars: params.question.length,
      errorCode: classified.code,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function generateExecutiveAiReport(params: {
  company: typeof companies.$inferSelect;
  userId: number;
  planCode: PlanCode;
}): Promise<GemeoExecutiveReport> {
  const startedAt = Date.now();
  const companyId = params.company.id;

  await assertCompanyAiQuota(companyId, params.planCode);
  const ai = getAiClient();

  const [overview, financial, geoComp, consumers, strategic, macro, docs] = await Promise.all([
    executeReadTool('get_company_overview', { includeUnits: true }, params.company),
    executeReadTool('get_financial_dre_and_inventory', {}, params.company),
    executeReadTool('get_competitors_and_geo_radar', { limit: 15 }, params.company),
    executeReadTool('get_consumer_perception', { limit: 15 }, params.company),
    executeReadTool('get_strategic_items', { kind: 'all' }, params.company),
    executeReadTool('get_macro_indicators', { stateUf: params.company.state }, params.company),
    executeReadTool('get_imported_documents', { limit: 6 }, params.company),
  ]);

  let webSectorContext = '';
  const groundingLinks: GemeoGroundingLink[] = [];
  try {
    const searchRes = await ai.models.generateContent({
      model: GEMEO_AI_PRIMARY_MODEL,
      contents: `Resuma tendências atuais, comportamento de demanda e fatores econômicos/regulatórios recentes no Brasil para o setor "${params.company.segment || 'comércio e serviços'}" em "${[params.company.city, params.company.state].filter(Boolean).join('/') || 'Brasil'}". Cite apenas fatos verificáveis.`,
      config: { tools: [{ googleSearch: {} }] },
    });
    webSectorContext = searchRes.text || '';
    groundingLinks.push(...extractLinksFromResponse(searchRes, 'search'));
  } catch {
    webSectorContext = 'Pesquisa web complementar indisponível neste momento; relatório baseado exclusivamente nos registros internos e APIs oficiais.';
  }

  try {
    const reportRes = await ai.models.generateContent({
      model: GEMEO_AI_PRIMARY_MODEL,
      contents: `Você é o módulo central **Gêmeo Digital AI**. Produza um **Relatório e Diagnóstico Executivo Multissetorial** fiel aos dados reais abaixo.

EMPRESA & ESTRUTURA:
${JSON.stringify(overview)}

FINANCEIRO (DRE), PRODUTOS E ESTOQUE:
${JSON.stringify(financial)}

CONCORRENTES E INTELIGÊNCIA GEOGRÁFICA:
${JSON.stringify(geoComp)}

PERCEPÇÃO DOS CONSUMIDORES (GOOGLE REVIEWS / RECLAME AQUI):
${JSON.stringify(consumers)}

ITENS ESTRATÉGICOS (RADAR, SWOT, DECISÕES, PLANOS):
${JSON.stringify(strategic)}

INDICADORES MACROECONÔMICOS OFICIAIS (BCB / IBGE / SEFAZ):
${JSON.stringify(macro)}

DOCUMENTOS IMPORTADOS:
${JSON.stringify(docs)}

CONTEXTO SETORIAL RECENTE (GOOGLE SEARCH):
${webSectorContext}

REGRAS OBRIGATÓRIAS:
1. Nunca invente valores financeiros, notas ou fatos não presentes acima.
2. Sempre que algum módulo estiver vazio (ex.: sem vendas lançadas ou sem avaliações), preencha "dataGaps" indicando exatamente o que falta cadastrar.
3. Forneça recomendações práticas com prioridade e KPI sugerido.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            sectorContext: { type: Type.STRING },
            financialHealth: {
              type: Type.OBJECT,
              properties: {
                statusLabel: { type: Type.STRING },
                summary: { type: Type.STRING },
                keyNumbers: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            competitivePosition: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                advantages: { type: Type.ARRAY, items: { type: Type.STRING } },
                vulnerabilities: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            consumerDiagnosis: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            opportunities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  action: { type: Type.STRING },
                },
              },
            },
            risks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  mitigation: { type: Type.STRING },
                },
              },
            },
            strategicRecommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  priority: { type: Type.STRING },
                  title: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  suggestedKpi: { type: Type.STRING },
                },
              },
            },
            dataGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const parsed = safeJsonParse<Partial<GemeoExecutiveReport>>(reportRes.text, {});
    const latencyMs = Date.now() - startedAt;

    await recordAiUsage({
      companyId,
      userId: params.userId,
      module: 'executive_report',
      model: GEMEO_AI_PRIMARY_MODEL,
      toolUsed: groundingLinks.length > 0 ? 'search' : 'cloudsql',
      status: 'success',
      latencyMs,
      inputChars: 1200,
      outputChars: (reportRes.text || '').length,
    });

    return {
      companyName: params.company.name,
      segment: params.company.segment || 'Setor não informado',
      cityState: [params.company.city, params.company.state].filter(Boolean).join('/') || 'Brasil',
      generatedAt: new Date().toISOString(),
      executiveSummary:
        parsed.executiveSummary ||
        `Diagnóstico consolidado gerado para ${params.company.name} com base nos módulos atualmente preenchidos.`,
      sectorContext: parsed.sectorContext || webSectorContext || 'Contexto setorial baseado nos indicadores oficiais.',
      financialHealth: parsed.financialHealth || {
        statusLabel: 'A investigar',
        summary: 'Dados financeiros insuficientes para classificação completa.',
        keyNumbers: [],
      },
      competitivePosition: parsed.competitivePosition || {
        summary: 'Concorrentes ainda não mapeados em profundidade.',
        advantages: [],
        vulnerabilities: [],
      },
      consumerDiagnosis: parsed.consumerDiagnosis || {
        summary: 'Aguardando sincronização do Google Reviews / Reclame Aqui ou avaliações manuais.',
        strengths: [],
        painPoints: [],
      },
      opportunities: parsed.opportunities || [],
      risks: parsed.risks || [],
      strategicRecommendations: parsed.strategicRecommendations || [],
      dataGaps: parsed.dataGaps || [],
      groundingLinks,
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const classified = classifyAiErrorForUser(err);
    await recordAiUsage({
      companyId,
      userId: params.userId,
      module: 'executive_report',
      model: GEMEO_AI_PRIMARY_MODEL,
      toolUsed: 'search',
      status: classified.code === 'QUOTA_EXCEEDED' ? 'quota_exceeded' : 'error',
      latencyMs,
      errorCode: classified.code,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
