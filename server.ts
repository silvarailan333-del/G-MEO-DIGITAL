import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  auditLogs,
  categories,
  companies,
  companyAssets,
  companyMembers,
  companyReputationProfiles,
  companyUnits,
  competitors,
  customerReviews,
  dataImports,
  evidenceCards,
  financialCostRecords,
  financialExpenseRecords,
  financialSalesRecords,
  geoApiUsageLogs,
  geoSavedEntities,
  geoSearchLogs,
  integrations,
  internalMetrics,
  inventoryControlItems,
  lgpdRecords,
  products,
  simulations,
  strategicItems,
  subscriptions,
} from './src/db/schema.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  createApiRateLimiter,
  csrfAndOriginMiddleware,
  extractClientSecurityContext,
  httpsAndSecurityHeadersMiddleware,
  wafAndBotProtectionMiddleware,
} from './src/middleware/security.ts';
import { getUserCompanyAccess, recordAuditLog } from './src/middleware/tenant.ts';
import {
  ANNUAL_DISCOUNT_LABEL,
  PAYMENT_NOTICE_DEMO,
  PLAN_ADDONS,
  PLANS_CONFIG,
  type PlanCode,
} from './src/config/plans.ts';
import {
  getOfficialMacroBundle,
  getOfficialMacroIndicators,
  lookupCnpjPublic,
} from './src/server/externalData.ts';
import {
  adviseScenarioGoal,
  analyzeCompetitiveLandscapeGeo,
  analyzeCrossSectionCorrelations,
  analyzeExpansionOpportunitiesGeo,
  askGeoMarketAssistant,
  askGroundedChatbot,
  askStrategicAssistant,
  discoverRegionalCompetitors,
  extractProductCatalogOrSalesFromContent,
  extractStructuredDataFromContent,
  generateActionPlansForDecision,
  generateCompanyIntelligenceBundle,
  interpretCustomerReviews,
  interpretMacroForSegment,
  reviewActionPlansProgress,
} from './src/server/aiService.ts';
import {
  classifyAiErrorForUser,
  generateExecutiveAiReport,
  getCompanyAiStatus,
  resolveAiActionProposal,
  runGemeoDigitalAiChat,
  type GemeoChatAttachmentInput,
} from './src/server/gemeoDigitalAi.ts';
import {
  analyzeTerritorialEnvironment,
  assertCompanyGeoRateLimit,
  computeRouteMatrixServer,
  fetchIbgeCityContext,
  geocodeAddressServer,
  getMapsApiKey,
  getPlaceDetailsServer,
  GMP_SOLUTION_ID,
  haversineDistanceKm,
  MapsQuotaExceededError,
  searchPlacesServer,
  type ApiUsageEvent,
} from './src/server/geoService.ts';
import {
  captureReclameAquiProfile,
  fetchCompanyGoogleReviews,
} from './src/server/consumerReputationService.ts';
import {
  computeFinancialSummary,
  formatBrlFromCents,
  formatPct,
  parseFinancialWorkbookBuffer,
} from './src/lib/financialFormulas.ts';
import {
  exportCompanyVerifiedBackup,
  startPeriodicBackups,
} from './src/server/backupService.ts';
import { recordSecurityEvent } from './src/server/securityLogger.ts';
import {
  inspectDocumentOrImageUpload,
  inspectImageUpload,
  sanitizeUploadFileName,
  verifyImageBufferSignature,
} from './src/server/uploadSecurity.ts';
import {
  parsePositiveIntParam,
  sanitizeCnpj,
  sanitizeEmail,
  sanitizeErrorForClient,
  sanitizeHttpUrl,
  sanitizePlainText,
} from './src/server/validation.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EPHEMERAL_RUNTIME_SECRET = crypto.randomBytes(32).toString('hex');
const ASSET_SIGNING_SECRET =
  process.env.ASSET_SIGNING_SECRET ||
  process.env.SESSION_SECRET ||
  (process.env.SQL_PASSWORD
    ? crypto.createHash('sha256').update(`asset-hmac:${process.env.SQL_PASSWORD}`).digest('hex')
    : EPHEMERAL_RUNTIME_SECRET);

function formatFriendlyAiError(error: unknown, fallbackMessage: string): { status: number; message: string; code?: string } {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (raw.startsWith('DAILY_COMPANY_AI_QUOTA_REACHED:')) {
    const [, used, limit] = raw.split(':');
    return {
      status: 429,
      code: 'COMPANY_DAILY_QUOTA',
      message: `Limite diário de ${limit || ''} consultas de IA para esta empresa atingido (${used || ''}/${limit || ''}). O restante da plataforma continua operando normalmente.`,
    };
  }
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('rate-limit')) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message: 'O limite temporário de consultas da IA foi atingido no momento. Aguarde alguns instantes e tente novamente.',
    };
  }
  if (raw === 'GEMINI_API_KEY_NOT_CONFIGURED' || lower.includes('gemini_api_key') || lower.includes('api key')) {
    return {
      status: 503,
      code: 'AI_UNAVAILABLE',
      message: 'Serviço Gêmeo Digital AI temporariamente indisponível por configuração no servidor. Todas as demais funções da plataforma seguem ativas.',
    };
  }
  const classified = classifyAiErrorForUser(error);
  if (classified.status === 503) {
    return classified;
  }
  if (raw && !raw.trim().startsWith('{') && raw.length < 180) {
    return { status: 400, message: raw };
  }
  return { status: 500, message: fallbackMessage };
}

function signAssetUrl(assetId: number, companyId: number): string {
  const sig = crypto
    .createHmac('sha256', ASSET_SIGNING_SECRET)
    .update(`${assetId}:${companyId}`)
    .digest('hex')
    .slice(0, 24);
  return `/api/beta/assets/${assetId}?cid=${companyId}&sig=${sig}`;
}

function verifyAssetSignature(assetId: number, companyId: number, sig: string): boolean {
  const expected = crypto
    .createHmac('sha256', ASSET_SIGNING_SECRET)
    .update(`${assetId}:${companyId}`)
    .digest('hex')
    .slice(0, 24);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

const DEFAULT_INTEGRATION_PROVIDERS = [
  { provider: 'ifood', accountLabel: 'iFood Parceiros' },
  { provider: 'mercadolivre', accountLabel: 'Mercado Livre' },
  { provider: 'olx', accountLabel: 'OLX Brasil' },
  { provider: 'shopee', accountLabel: 'Shopee Open Platform' },
  { provider: 'amazon', accountLabel: 'Amazon Selling Partner' },
  { provider: 'shopify', accountLabel: 'Shopify Admin API' },
  { provider: 'own_site', accountLabel: 'Site / Loja Virtual Própria' },
  { provider: 'whatsapp_business', accountLabel: 'WhatsApp Business Cloud API' },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Hardening Express & Reverse Proxy / Cloudflare awareness
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // 1. HTTPS redirect, HSTS, CSP & OWASP security headers
  app.use(httpsAndSecurityHeadersMiddleware);

  // 2. Bounded JSON & URL-encoded body parsing + safe malformed JSON handling
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof SyntaxError && 'status' in err) {
        return res.status(400).json({ error: 'Payload JSON inválido.' });
      }
      next(err);
    }
  );

  // 3. Application WAF, Anti-Bot, SQLi/XSS/SSRF/Traversal shield & Prototype Pollution stripping
  app.use(wafAndBotProtectionMiddleware);

  // 4. CSRF / Origin verification on state-changing API routes
  app.use(csrfAndOriginMiddleware);

  // 5. Tiered DDoS & API Rate Limiting
  const globalDdosLimiter = createApiRateLimiter({
    name: 'global_burst',
    windowMs: 60 * 1000,
    maxRequests: 240,
  });
  const publicDataLimiter = createApiRateLimiter({
    name: 'public_data',
    windowMs: 60 * 1000,
    maxRequests: 40,
  });
  const publicAiLimiter = createApiRateLimiter({
    name: 'public_ai',
    windowMs: 60 * 1000,
    maxRequests: 20,
  });
  const betaApiLimiter = createApiRateLimiter({
    name: 'beta_api',
    windowMs: 60 * 1000,
    maxRequests: 120,
    keyByUser: true,
  });
  const aiHeavyLimiter = createApiRateLimiter({
    name: 'ai_heavy',
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyByUser: true,
  });
  const uploadLimiter = createApiRateLimiter({
    name: 'upload_ops',
    windowMs: 60 * 1000,
    maxRequests: 15,
    keyByUser: true,
  });

  app.use(globalDdosLimiter);
  app.use('/api/beta', betaApiLimiter);

  // Strict positive-integer validation on all numeric route parameters
  for (const paramName of [
    'companyId',
    'productId',
    'categoryId',
    'competitorId',
    'entityId',
    'rowId',
    'itemId',
    'assetId',
  ]) {
    app.param(paramName, (_req, res, next, val) => {
      if (parsePositiveIntParam(val) === null) {
        return res.status(400).json({ error: 'Identificador numérico inválido.' });
      }
      next();
    });
  }

  const runCompetitorDiscoveryForCompany = async (
    company: typeof companies.$inferSelect,
    userId: number,
    userEmail: string
  ) => {
    const companyId = company.id;
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId));
    const planCode = (sub?.planCode || 'profissional') as PlanCode;
    const limit = PLANS_CONFIG[planCode].limits.competitorsMax + (sub?.extraCompetitors || 0);
    const current = await db.select().from(competitors).where(eq(competitors.companyId, companyId));

    const discovery = await discoverRegionalCompetitors({
      companyName: company.name,
      segment: company.segment,
      city: company.city,
      state: company.state,
      address: company.address,
    });

    const existingNames = new Set(current.map((c) => c.name.toLowerCase().trim()));
    let remainingSlots = Math.max(0, limit - current.length);
    const savedCompetitors = [];
    let skippedByLimit = 0;

    for (const item of discovery.competitors) {
      const normName = item.name.toLowerCase().trim();
      if (existingNames.has(normName)) continue;
      if (remainingSlots <= 0) {
        skippedByLimit += 1;
        continue;
      }
      existingNames.add(normName);
      remainingSlots -= 1;

      const [inserted] = await db
        .insert(competitors)
        .values({
          companyId,
          name: item.name,
          segment: item.segment || company.segment || '',
          positioning: item.locationDistance
            ? `${item.positioning || ''} (${item.locationDistance})`.trim()
            : item.positioning || '',
          announcedPriceRange: item.announcedPriceRange || 'Não informado publicamente',
          shippingInfo: item.shippingInfo || 'Não informado publicamente',
          deliveryDays: item.deliveryDays || '',
          publicRating: item.publicRating || '',
          complaintsNote: item.complaintsNote || '',
          lastChangeNote: item.lastChangeNote || `Consultado em ${item.consultedAt || new Date().toLocaleDateString('pt-BR')}`,
          sourceUrl: item.sourceUrl || '',
          channels: item.channels || 'Loja física / Google Maps',
          priceComparison: item.priceComparison || 'Não informado',
          threatLevel: item.threatLevel || 'Impacto médio',
          reviewSnippetsJson: {
            snippets: item.reviewSnippets || [],
            locationDistance: item.locationDistance || '',
            positivesNote: item.positivesNote || '',
            negativesNote: item.complaintsNote || '',
            productsPromotions: item.productsPromotions || 'Não divulgado publicamente nas fontes consultadas',
            differentials: item.differentials || '',
            threatsOpportunities: item.threatsOpportunities || '',
            consultedAt: item.consultedAt || new Date().toLocaleDateString('pt-BR'),
          },
        })
        .returning();
      savedCompetitors.push(inserted);
    }

    if (savedCompetitors.length > 0) {
      await db.insert(strategicItems).values({
        companyId,
        kind: 'radar',
        category: 'Concorrência',
        title: `Mapeamento regional: ${savedCompetitors.length} concorrente(s) identificado(s) via Google Maps`,
        description: savedCompetitors
          .map((c) => `${c.name}${c.publicRating ? ` (${c.publicRating})` : ''}`)
          .join(' · '),
        priority: savedCompetitors.some((c) => c.threatLevel === 'Impacto alto') ? 'alta' : 'media',
        status: 'aberto',
        impactNote: `Comparar avaliações e posicionamento em ${company.city || 'sua região'}.`,
        dueDate: new Date().toLocaleDateString('pt-BR'),
        metadataJson: {
          signalKind: 'movimento',
          impactLabel: savedCompetitors.some((c) => c.threatLevel === 'Impacto alto') ? 'Impacto alto' : 'Impacto médio',
          sourceName: 'Google Maps & Avaliações Públicas',
          sourceUrl: savedCompetitors[0]?.sourceUrl || '',
          recommendation: 'Analise os pontos fortes e reclamações dos concorrentes para ajustar ofertas.',
        },
      });
    }

    await recordAuditLog({
      companyId,
      userId,
      userEmail,
      action: 'DISCOVER_COMPETITORS_MAPS',
      entityType: 'competitor',
      entityId: companyId,
      details: { found: discovery.competitors.length, saved: savedCompetitors.length, skippedByLimit },
    });

    return {
      discovered: discovery.competitors,
      savedCompetitors,
      savedCount: savedCompetitors.length,
      skippedByLimit,
      groundedLinks: discovery.groundedLinks,
      searchSummary: discovery.searchSummary,
    };
  };

  const ensureCategoryByName = async (companyId: number, categoryName: string) => {
    const clean = categoryName.trim();
    if (!clean) return;
    const slug = clean
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.companyId, companyId));
    if (!existing.some((c) => c.name.toLowerCase().trim() === clean.toLowerCase())) {
      await db.insert(categories).values({
        companyId,
        name: clean,
        slug: slug || `cat-${Date.now()}`,
        description: 'Categoria personalizada criada na gestão financeira/estoque',
      });
    }
  };

  const buildCompanySyncSummaries = async (companyId: number) => {
    const [sales, costs, expenses, inventory, [reputation]] = await Promise.all([
      db
        .select()
        .from(financialSalesRecords)
        .where(eq(financialSalesRecords.companyId, companyId))
        .orderBy(desc(financialSalesRecords.periodMonth), desc(financialSalesRecords.createdAt)),
      db
        .select()
        .from(financialCostRecords)
        .where(eq(financialCostRecords.companyId, companyId))
        .orderBy(desc(financialCostRecords.periodMonth), desc(financialCostRecords.createdAt)),
      db
        .select()
        .from(financialExpenseRecords)
        .where(eq(financialExpenseRecords.companyId, companyId))
        .orderBy(desc(financialExpenseRecords.periodMonth), desc(financialExpenseRecords.createdAt)),
      db
        .select()
        .from(inventoryControlItems)
        .where(eq(inventoryControlItems.companyId, companyId))
        .orderBy(desc(inventoryControlItems.periodMonth), desc(inventoryControlItems.createdAt)),
      db
        .select()
        .from(companyReputationProfiles)
        .where(eq(companyReputationProfiles.companyId, companyId)),
    ]);

    const financialSummary = computeFinancialSummary({ sales, costs, expenses, inventory });

    const financialSummaryText = financialSummary.hasData
      ? [
          `Receita Total: ${formatBrlFromCents(financialSummary.totalRevenueCents)} | Unidades Vendidas: ${financialSummary.totalUnitsSold}`,
          `CMV Total: ${formatBrlFromCents(financialSummary.totalCmvCents)} | Lucro Bruto: ${formatBrlFromCents(financialSummary.grossProfitCents)} (Margem Bruta: ${formatPct(financialSummary.grossMarginPct)})`,
          `Outros Custos Variáveis (Frete/Embalagem/Cartão/Marketplace/Perdas): ${formatBrlFromCents(financialSummary.totalVariableCostsCents)}`,
          `Despesas Operacionais (Aluguel/Folha/Energia/Marketing/Sistemas/etc.): ${formatBrlFromCents(financialSummary.totalOperatingExpensesCents)}`,
          `Resultado Operacional: ${formatBrlFromCents(financialSummary.operatingResultCents)} (Margem Operacional: ${formatPct(financialSummary.operatingMarginPct)})`,
          `Valor Total em Estoque: ${formatBrlFromCents(financialSummary.totalInventoryValueCents)} | Itens críticos: ${financialSummary.criticalStockItemsCount}`,
          `Categorias que precisam de reposição: ${financialSummary.categoriesNeedingReplenishment.join(', ') || 'Nenhuma'}`,
        ].join('\n')
      : 'Nenhum registro lançado nas abas de Vendas, Custos, Despesas ou Estoque até o momento.';

    const reputationSummaryText = reputation
      ? [
          reputation.googleRating
            ? `Google Reviews: Nota ${reputation.googleRating}/5 (${reputation.googleRatingsTotal} avaliações)`
            : `Google Reviews: status "${reputation.googleSyncStatus}" (${reputation.googleSyncNote || 'sem nota capturada'})`,
          reputation.reclameAquiUrl
            ? `Reclame Aqui (${reputation.reclameAquiUrl}): Nota ${reputation.reclameAquiScore || 'N/A'} | Status: ${reputation.reclameAquiStatusLabel || 'N/A'} | Respondidas: ${reputation.reclameAquiResponseRatePct || 'N/A'} | Solução: ${reputation.reclameAquiSolvedRatePct || 'N/A'} | Voltariam a fazer negócio: ${reputation.reclameAquiBackToBuyPct || 'N/A'}`
            : 'Reclame Aqui: link ainda não informado pelo usuário.',
        ].join('\n')
      : 'Perfil consolidado de reputação externa ainda não sincronizado.';

    return {
      sales,
      costs,
      expenses,
      inventory,
      financialSummary,
      financialSummaryText,
      reputationProfile: reputation || null,
      reputationSummaryText,
    };
  };

  const executeGoogleReviewsSyncForCompany = async (company: typeof companies.$inferSelect) => {
    const syncOut = await fetchCompanyGoogleReviews({
      companyName: company.name,
      address: company.address,
      city: company.city,
      state: company.state,
      existingPlaceId: company.placeId,
      existingLat: company.latitude,
      existingLng: company.longitude,
    });

    if (
      (syncOut.placeId && !company.placeId) ||
      (syncOut.resolvedLat && !company.latitude)
    ) {
      await db
        .update(companies)
        .set({
          placeId: company.placeId || syncOut.placeId,
          latitude: company.latitude || syncOut.resolvedLat,
          longitude: company.longitude || syncOut.resolvedLng,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, company.id));
    }

    const existingReviews = await db
      .select()
      .from(customerReviews)
      .where(and(eq(customerReviews.companyId, company.id), eq(customerReviews.source, 'google')));

    const existingKeys = new Set(
      existingReviews.map((r) => `${r.authorLabel.toLowerCase().trim()}::${r.commentText.slice(0, 60).toLowerCase().trim()}`)
    );

    let insertedReviewsCount = 0;
    for (const r of syncOut.reviews) {
      const key = `${r.authorLabel.toLowerCase().trim()}::${r.commentText.slice(0, 60).toLowerCase().trim()}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      await db.insert(customerReviews).values({
        companyId: company.id,
        source: 'google',
        rating: r.rating,
        sentiment: r.rating >= 4 ? 'positivo' : r.rating === 3 ? 'neutro' : 'negativo',
        commentText: r.commentText,
        authorLabel: r.authorLabel,
        hasLgpdConsent: true,
        reviewedAt: r.reviewedAt,
      });
      insertedReviewsCount += 1;
    }

    const [existingProf] = await db
      .select()
      .from(companyReputationProfiles)
      .where(eq(companyReputationProfiles.companyId, company.id));

    const now = new Date();
    let profile;
    if (existingProf) {
      const [updated] = await db
        .update(companyReputationProfiles)
        .set({
          googlePlaceId: syncOut.placeId || existingProf.googlePlaceId,
          googlePlaceName: syncOut.placeName || existingProf.googlePlaceName,
          googleMapsUri: syncOut.googleMapsUri || existingProf.googleMapsUri,
          googleRating: syncOut.rating || existingProf.googleRating,
          googleRatingsTotal: syncOut.ratingsTotal || existingProf.googleRatingsTotal,
          googleSyncStatus: syncOut.syncStatus,
          googleSyncNote: syncOut.syncNote,
          googleLastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(companyReputationProfiles.id, existingProf.id))
        .returning();
      profile = updated;
    } else {
      const [inserted] = await db
        .insert(companyReputationProfiles)
        .values({
          companyId: company.id,
          googlePlaceId: syncOut.placeId,
          googlePlaceName: syncOut.placeName,
          googleMapsUri: syncOut.googleMapsUri,
          googleRating: syncOut.rating,
          googleRatingsTotal: syncOut.ratingsTotal,
          googleSyncStatus: syncOut.syncStatus,
          googleSyncNote: syncOut.syncNote,
          googleLastSyncedAt: now,
        })
        .returning();
      profile = inserted;
    }

    return {
      profile,
      insertedReviewsCount,
      syncStatus: syncOut.syncStatus,
      syncNote: syncOut.syncNote,
    };
  };

  const runIntelligenceGenerationForCompany = async (
    company: typeof companies.$inferSelect,
    userId: number,
    userEmail: string,
    focus: 'all' | 'radar' | 'strategy' = 'all'
  ) => {
    const companyId = company.id;
    const [prods, cats, mets, comps, revs, ints, imps, existingStrat, macroBundle, syncBundle] =
      await Promise.all([
        db.select().from(products).where(eq(products.companyId, companyId)),
        db.select().from(categories).where(eq(categories.companyId, companyId)),
        db.select().from(internalMetrics).where(eq(internalMetrics.companyId, companyId)).orderBy(desc(internalMetrics.periodDate)),
        db.select().from(competitors).where(eq(competitors.companyId, companyId)),
        db.select().from(customerReviews).where(eq(customerReviews.companyId, companyId)).orderBy(desc(customerReviews.createdAt)),
        db.select().from(integrations).where(eq(integrations.companyId, companyId)),
        db.select().from(dataImports).where(eq(dataImports.companyId, companyId)).orderBy(desc(dataImports.createdAt)),
        db.select().from(strategicItems).where(eq(strategicItems.companyId, companyId)),
        getOfficialMacroBundle(company.state),
        buildCompanySyncSummaries(companyId),
      ]);

    const documentsText =
      imps.length > 0
        ? imps
            .slice(0, 10)
            .map(
              (i) =>
                `[Arquivo: ${i.fileName} (${i.fileType}) | Origem: ${i.sourceOrigin} | Confiabilidade: ${i.reliabilityLevel}]\nResumo: ${i.summaryText || 'Sem resumo textual'}\nInsights: ${JSON.stringify(i.insightsJson || [])}\nLinhas: ${i.rowCount}`
            )
            .join('\n\n')
        : 'Nenhum documento/relatório importado ainda.';

    const snapshot = {
      companyName: company.name,
      segment: company.segment,
      operationType: company.operationType,
      cityState: [company.city, company.state].filter(Boolean).join('/'),
      description: company.description,
      productsCount: prods.length,
      categoriesCount: cats.length,
      metricsCount: mets.length,
      competitorsCount: comps.length,
      reviewsCount: revs.length,
      importsCount: imps.length,
      financialSummaryText: syncBundle.financialSummaryText,
      reputationSummaryText: syncBundle.reputationSummaryText,
      connectedIntegrations: ints.filter((i) => i.connectionStatus === 'connected').map((i) => i.accountLabel),
      recentMetricsSummary:
        mets.length > 0
          ? mets
              .slice(0, 8)
              .map((m) => `${m.periodDate}: R$ ${(m.revenueCents / 100).toFixed(2)}, ${m.ordersCount} pedidos, Ticket R$ ${(m.avgTicketCents / 100).toFixed(2)}, Margem ${m.grossMarginPct || 'N/A'}%`)
              .join('\n')
          : 'Nenhuma métrica financeira/vendas registrada ainda.',
      topProductsSummary:
        prods.length > 0
          ? [...prods]
              .sort((a, b) => (b.soldUnits || 0) - (a.soldUnits || 0))
              .slice(0, 10)
              .map(
                (p) =>
                  `${p.name} (SKU: ${p.sku || 'N/A'} | Preço R$ ${(p.priceCents / 100).toFixed(2)} | Custo R$ ${(p.acquisitionCostCents / 100).toFixed(2)} | Estoque: ${p.stockQty} | Vendidas: ${p.soldUnits || 0} un.)`
              )
              .join('\n')
          : 'Nenhum produto cadastrado.',
      competitorsSummary:
        comps.length > 0
          ? comps
              .map((c) => {
                const rawJson = c.reviewSnippetsJson;
                const snippets = Array.isArray(rawJson)
                  ? (rawJson as string[])
                  : Array.isArray((rawJson as Record<string, unknown>)?.snippets)
                    ? ((rawJson as Record<string, unknown>).snippets as string[])
                    : [];
                const dossier = !Array.isArray(rawJson) && rawJson ? (rawJson as Record<string, unknown>) : {};
                return `${c.name} (${c.threatLevel || 'Impacto médio'} | ${dossier.locationDistance || c.positioning || 'Região'}): Nota ${c.publicRating || 'N/A'} | Elogios: ${dossier.positivesNote || 'N/A'} | Reclamações: ${c.complaintsNote || snippets.join(' ; ') || 'N/A'} | Produtos/Promos: ${dossier.productsPromotions || c.announcedPriceRange || 'N/A'}`;
              })
              .join('\n')
          : 'Nenhum concorrente cadastrado.',
      reviewsSummary:
        revs.length > 0
          ? revs.slice(0, 8).map((r) => `[${r.source} ${r.rating}/5] ${r.commentText}`).join('\n')
          : 'Nenhuma avaliação registrada.',
      macroIndicators: macroBundle.indicators,
    };

    const bundle = await generateCompanyIntelligenceBundle({
      snapshot,
      documentsText,
      focus,
    });

    const existingKeys = new Set(
      existingStrat.map((s) => `${s.kind}:${s.title.toLowerCase().trim()}`)
    );

    let insertedCount = 0;
    const insertUnique = async (row: {
      kind: string;
      category: string;
      title: string;
      description: string;
      priority: string;
      status: string;
      impactNote: string;
      dueDate: string;
      metadataJson: Record<string, unknown>;
    }) => {
      const cleanTitle = (row.title || '').trim();
      if (!cleanTitle) return;
      const key = `${row.kind}:${cleanTitle.toLowerCase()}`;
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      await db.insert(strategicItems).values({
        companyId,
        ...row,
        title: cleanTitle,
      });
      insertedCount += 1;
    };

    const todayDateBr = new Date().toLocaleDateString('pt-BR');

    for (const s of bundle.radarSignals) {
      await insertUnique({
        kind: 'radar',
        category: s.category || 'Setor',
        title: s.title,
        description: s.summary,
        priority: s.impactLabel?.toLowerCase().includes('alto') ? 'alta' : 'media',
        status: 'aberto',
        impactNote: s.potentialImpact || s.relevance,
        dueDate: s.publishedDate || todayDateBr,
        metadataJson: {
          signalKind: s.kind || 'movimento',
          impactLabel: s.impactLabel || 'Impacto médio',
          sourceName: s.sourceName || 'IA + Fontes Oficiais',
          sourceUrl: s.sourceUrl || '',
          publishedDate: s.publishedDate || todayDateBr,
          lastCheckedDate: s.lastCheckedDate || todayDateBr,
          relevance: s.relevance || '',
          recommendation: s.recommendation || '',
          generatedByAi: true,
        },
      });
    }

    for (const v of bundle.verifications) {
      await insertUnique({
        kind: 'verificar',
        category: v.category || 'Diagnóstico',
        title: v.title,
        description: v.description,
        priority: 'media',
        status: 'aberto',
        impactNote: v.impactNote || 'A confirmar',
        dueDate: todayDateBr,
        metadataJson: {
          sourceName: v.sourceName || 'Sinal identificado pela IA',
          relevance: v.relevance || 'Média relevância para o negócio',
          recommendation: v.recommendation || 'Validar junto ao contador, fornecedor ou equipe antes de decidir.',
          statusNote: v.statusNote || 'Pendente de confirmação',
          generatedByAi: true,
        },
      });
    }

    for (const item of bundle.swot) {
      await insertUnique({
        kind: 'swot',
        category: item.category || 'Força',
        title: item.title,
        description: item.description,
        priority: 'media',
        status: 'aberto',
        impactNote: '',
        dueDate: '',
        metadataJson: { generatedByAi: true },
      });
    }

    for (const item of bundle.pestel) {
      await insertUnique({
        kind: 'pestel',
        category: item.category || 'Econômico',
        title: item.title,
        description: item.description,
        priority: item.priority || 'media',
        status: 'aberto',
        impactNote: '',
        dueDate: '',
        metadataJson: { generatedByAi: true },
      });
    }

    for (const item of bundle.porter) {
      await insertUnique({
        kind: 'porter',
        category: item.category || 'Rivalidade',
        title: item.title,
        description: item.description,
        priority: item.priority || 'media',
        status: 'aberto',
        impactNote: '',
        dueDate: '',
        metadataJson: { generatedByAi: true },
      });
    }

    for (const item of bundle.tows) {
      await insertUnique({
        kind: 'tows',
        category: item.category || 'SO',
        title: item.title,
        description: item.description,
        priority: 'media',
        status: 'aberto',
        impactNote: '',
        dueDate: '',
        metadataJson: { generatedByAi: true },
      });
    }

    for (const a of bundle.analyses) {
      await insertUnique({
        kind: 'analysis',
        category: a.category || 'Estratégia',
        title: a.title,
        description: a.description,
        priority: 'alta',
        status: 'aberto',
        impactNote: a.impactNote || '',
        dueDate: todayDateBr,
        metadataJson: {
          classification: a.classification || 'atencao',
          problem: a.problem || a.title,
          evidenceSummary: a.evidenceSummary || a.description,
          dataSourcesUsed: a.dataSourcesUsed || 'Dados da empresa, concorrentes e fontes oficiais',
          strategicRecommendation: a.strategicRecommendation || '',
          justification: a.justification || '',
          originSignals: a.originSignals || [],
          generatedByAi: true,
        },
      });
    }

    for (const d of bundle.decisions) {
      await insertUnique({
        kind: 'decision',
        category: 'Recomendação IA',
        title: d.title,
        description: d.problem,
        priority: d.priority || 'alta',
        status: 'aberto',
        impactNote: d.expectedOutcome,
        dueDate: d.dueDate || 'Em 15 dias',
        metadataJson: {
          problem: d.problem,
          evidence: d.evidence,
          justification: d.justification || '',
          suggestedAction: d.suggestedAction,
          expectedOutcome: d.expectedOutcome,
          kpisToTrack: d.kpisToTrack || 'Vendas, margem líquida e satisfação do cliente',
          generatedByAi: true,
        },
      });
    }

    for (const o of bundle.opportunities) {
      await insertUnique({
        kind: 'opportunity',
        category: o.category || 'Mercado',
        title: o.title,
        description: o.description,
        priority: o.priority || 'alta',
        status: 'aberto',
        impactNote: o.impactNote,
        dueDate: '',
        metadataJson: { generatedByAi: true },
      });
    }

    if (Array.isArray(bundle.macroInterpretations) && bundle.macroInterpretations.length > 0) {
      await db
        .delete(strategicItems)
        .where(and(eq(strategicItems.companyId, companyId), eq(strategicItems.kind, 'macro_ai')));
      for (const mi of bundle.macroInterpretations) {
        await db.insert(strategicItems).values({
          companyId,
          kind: 'macro_ai',
          category: mi.indicatorCode || 'MACRO',
          title: mi.indicatorLabel || mi.indicatorCode,
          description: mi.plainExplanation || '',
          priority: 'media',
          status: 'aberto',
          impactNote: mi.businessEffect || '',
          dueDate: todayDateBr,
          metadataJson: {
            indicatorCode: mi.indicatorCode,
            practicalTip: mi.practicalTip || '',
            generatedByAi: true,
          },
        });
        insertedCount += 1;
      }
    }

    await recordAuditLog({
      companyId,
      userId,
      userEmail,
      action: 'GENERATE_AI_INTELLIGENCE',
      entityType: 'strategic_item',
      entityId: companyId,
      details: { insertedCount, groundedWebSourcesCount: bundle.groundedWebSources.length },
    });

    return {
      insertedCount,
      groundedWebSources: bundle.groundedWebSources,
    };
  };

  const getUserAccessibleCompanies = async (dbUserId: number) => {
    const owned = await db
      .select()
      .from(companies)
      .where(eq(companies.ownerUserId, dbUserId))
      .orderBy(desc(companies.createdAt));

    const memberships = await db
      .select()
      .from(companyMembers)
      .where(and(eq(companyMembers.userId, dbUserId), eq(companyMembers.status, 'active')));

    const memberIds = memberships
      .map((m) => m.companyId)
      .filter((cid) => !owned.some((c) => c.id === cid));

    const shared =
      memberIds.length > 0
        ? await db.select().from(companies).where(inArray(companies.id, memberIds))
        : [];

    return [...owned, ...shared];
  };

  const buildCompanyContextSnapshot = async (company: typeof companies.$inferSelect) => {
    const companyId = company.id;
    const [
      prods,
      cats,
      mets,
      comps,
      revs,
      ints,
      imps,
      macroPayload,
      syncBundle,
    ] = await Promise.all([
      db.select().from(products).where(eq(products.companyId, companyId)),
      db.select().from(categories).where(eq(categories.companyId, companyId)),
      db.select().from(internalMetrics).where(eq(internalMetrics.companyId, companyId)).orderBy(desc(internalMetrics.periodDate)),
      db.select().from(competitors).where(eq(competitors.companyId, companyId)),
      db.select().from(customerReviews).where(eq(customerReviews.companyId, companyId)).orderBy(desc(customerReviews.createdAt)),
      db.select().from(integrations).where(eq(integrations.companyId, companyId)),
      db.select().from(dataImports).where(eq(dataImports.companyId, companyId)).orderBy(desc(dataImports.createdAt)),
      getOfficialMacroBundle(company.state),
      buildCompanySyncSummaries(companyId),
    ]);

    return {
      companyName: company.name,
      segment: company.segment,
      operationType: company.operationType,
      cityState: [company.city, company.state].filter(Boolean).join('/'),
      description: company.description,
      productsCount: prods.length,
      categoriesCount: cats.length,
      metricsCount: mets.length,
      competitorsCount: comps.length,
      reviewsCount: revs.length,
      importsCount: imps.length,
      financialSummaryText: syncBundle.financialSummaryText,
      reputationSummaryText: syncBundle.reputationSummaryText,
      importsSummary:
        imps.length > 0
          ? imps
              .slice(0, 6)
              .map((i) => `${i.fileName} (${i.sourceOrigin}): ${i.summaryText || `${i.rowCount} linhas numéricas`}`)
              .join('\n')
          : 'Nenhum documento importado ainda.',
      connectedIntegrations: ints
        .filter((i) => i.connectionStatus === 'connected')
        .map((i) => i.accountLabel),
      recentMetricsSummary:
        mets.length > 0
          ? mets
              .slice(0, 5)
              .map(
                (m) =>
                  `${m.periodDate}: Faturamento R$ ${(m.revenueCents / 100).toFixed(2)}, Pedidos: ${m.ordersCount}, Ticket Médio: R$ ${(m.avgTicketCents / 100).toFixed(2)} (Fonte: ${m.sourceOrigin})`
              )
              .join('\n')
          : 'Nenhuma métrica financeira/vendas registrada ainda.',
      topProductsSummary:
        prods.length > 0
          ? [...prods]
              .sort((a, b) => (b.soldUnits || 0) - (a.soldUnits || 0))
              .slice(0, 8)
              .map(
                (p) =>
                  `${p.name} (SKU: ${p.sku || 'N/A'}) — Preço R$ ${(p.priceCents / 100).toFixed(2)} | Custo R$ ${(p.acquisitionCostCents / 100).toFixed(2)} | Estoque: ${p.stockQty} | Vendidas: ${p.soldUnits || 0} un.`
              )
              .join('\n')
          : 'Nenhum produto cadastrado.',
      competitorsSummary:
        comps.length > 0
          ? comps
              .map((c) => {
                const dossier =
                  !Array.isArray(c.reviewSnippetsJson) && c.reviewSnippetsJson && typeof c.reviewSnippetsJson === 'object'
                    ? (c.reviewSnippetsJson as Record<string, unknown>)
                    : null;
                const dist = dossier?.locationDistance ? ` (${String(dossier.locationDistance)})` : '';
                const pos = dossier?.positivesNote ? ` | Elogios: ${String(dossier.positivesNote)}` : '';
                const neg = c.complaintsNote ? ` | Críticas: ${c.complaintsNote}` : '';
                return `${c.name}${dist}: faixa ${c.announcedPriceRange || 'não divulgada'}, nota ${c.publicRating || 'N/A'}${pos}${neg}`;
              })
              .join('\n')
          : 'Nenhum concorrente cadastrado.',
      reviewsSummary:
        revs.length > 0
          ? revs.slice(0, 5).map((r) => `[${r.source} ${r.rating}/5] ${r.commentText}`).join('\n')
          : 'Nenhuma avaliação registrada.',
      macroIndicators: macroPayload.indicators,
    };
  };

  const buildUserCompaniesAndDistanceSummary = async (
    dbUserId: number,
    activeCompanyId?: number | null
  ) => {
    const userComps = await getUserAccessibleCompanies(dbUserId);
    if (userComps.length === 0) {
      return {
        userCompanies: userComps,
        companiesDirectoryText: 'Nenhuma empresa cadastrada ainda para este usuário no Cloud SQL.',
        distanceQueriesSummary: 'Nenhuma consulta de distância ou raio registrada.',
        activeLatLng: null as { latitude: number; longitude: number } | null,
      };
    }

    const companyIds = userComps.map((c) => c.id);
    const [recentGeoLogs, savedGeo] = await Promise.all([
      db
        .select()
        .from(geoSearchLogs)
        .where(inArray(geoSearchLogs.companyId, companyIds))
        .orderBy(desc(geoSearchLogs.createdAt))
        .limit(12),
      db
        .select()
        .from(geoSavedEntities)
        .where(inArray(geoSavedEntities.companyId, companyIds))
        .orderBy(desc(geoSavedEntities.lastUpdatedAt))
        .limit(20),
    ]);

    const lines = userComps.map((c) => {
      const addr = [c.address, c.city, c.state].filter(Boolean).join(', ') || 'Endereço não informado';
      const hasCoords =
        Number.isFinite(Number(c.latitude)) &&
        Number.isFinite(Number(c.longitude)) &&
        Number(c.latitude) !== 0 &&
        Number(c.longitude) !== 0;
      return `- [ID ${c.id}] ${c.name} (${c.segment || 'Sem segmento'}) | Endereço: ${addr} | Coordenadas: ${
        hasCoords ? `${c.latitude}, ${c.longitude}` : 'Não geocodificadas'
      }`;
    });

    // Pairwise distances in km between user's companies with coordinates
    const pairwiseLines: string[] = [];
    for (let i = 0; i < userComps.length; i += 1) {
      const a = userComps[i];
      const latA = Number(a.latitude);
      const lngA = Number(a.longitude);
      if (!Number.isFinite(latA) || !Number.isFinite(lngA) || latA === 0) continue;
      for (let j = i + 1; j < userComps.length; j += 1) {
        const b = userComps[j];
        const latB = Number(b.latitude);
        const lngB = Number(b.longitude);
        if (!Number.isFinite(latB) || !Number.isFinite(lngB) || latB === 0) continue;
        const km = haversineDistanceKm(latA, lngA, latB, lngB);
        pairwiseLines.push(`- ${a.name} ↔ ${b.name}: ${km} km (distância geodésica em linha reta)`);
      }
    }

    const logLines = recentGeoLogs.map(
      (l) =>
        `- [${new Date(l.createdAt).toLocaleDateString('pt-BR')}] Tipo: ${l.searchType} | Raio: ${l.radiusKm} km | Centro: ${l.centerAddress || 'N/A'} | Resultados: ${l.resultsCount} | Resumo: ${l.alertsSummary || l.query}`
    );

    const savedGeoLines = savedGeo.slice(0, 10).map(
      (g) =>
        `- ${g.name} (${g.entityKind}/${g.classification}) | Distância: ${g.distanceKm || 'N/A'} km | Rota: ${g.travelTimeText || 'N/A'} | Endereço: ${g.address}`
    );

    const activeComp =
      userComps.find((c) => c.id === activeCompanyId) ||
      userComps.find((c) => Number(c.latitude) !== 0 && Number(c.longitude) !== 0) ||
      null;
    const activeLatLng =
      activeComp &&
      Number.isFinite(Number(activeComp.latitude)) &&
      Number.isFinite(Number(activeComp.longitude)) &&
      Number(activeComp.latitude) !== 0 &&
      Number(activeComp.longitude) !== 0
        ? { latitude: Number(activeComp.latitude), longitude: Number(activeComp.longitude) }
        : null;

    return {
      userCompanies: userComps,
      companiesDirectoryText: [
        ...lines,
        ...(pairwiseLines.length > 0 ? ['\nDISTÂNCIAS CALCULADAS ENTRE SUAS EMPRESAS:', ...pairwiseLines] : []),
        ...(savedGeoLines.length > 0 ? ['\nENTIDADES GEOGRÁFICAS SALVAS NO CLOUD SQL:', ...savedGeoLines] : []),
      ].join('\n'),
      distanceQueriesSummary:
        logLines.length > 0
          ? logLines.join('\n')
          : 'Nenhuma consulta de distância/raio salva no Cloud SQL ainda.',
      activeLatLng,
    };
  };

  // =========================================================================
  // PUBLIC ENDPOINTS (No private tenant data exposed)
  // =========================================================================
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'gemeo-digital' });
  });

  app.get('/api/public/plans', publicDataLimiter, (_req, res) => {
    res.json({
      plans: Object.values(PLANS_CONFIG),
      addons: PLAN_ADDONS,
      annualDiscountLabel: ANNUAL_DISCOUNT_LABEL,
      paymentNotice: PAYMENT_NOTICE_DEMO,
    });
  });

  app.get('/api/public/macro-indicators', publicDataLimiter, async (req, res) => {
    try {
      const ufRaw = typeof req.query.uf === 'string' ? req.query.uf.trim().toUpperCase() : undefined;
      const uf = ufRaw && /^[A-Z]{2}$/.test(ufRaw) ? ufRaw : undefined;
      const payload = await getOfficialMacroBundle(uf);
      res.json(payload);
    } catch (error) {
      console.error('Macro indicators error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Falha ao consultar indicadores oficiais.' });
    }
  });

  app.get('/api/public/cnpj/:cnpj', publicDataLimiter, async (req, res) => {
    try {
      const cleanCnpj = sanitizeCnpj(req.params.cnpj);
      if (cleanCnpj.length !== 14) {
        return res.status(400).json({ error: 'CNPJ deve conter 14 dígitos numéricos.' });
      }
      const data = await lookupCnpjPublic(cleanCnpj);
      res.json(data);
    } catch (error: unknown) {
      res.status(400).json({
        error: sanitizeErrorForClient(error, 'Erro ao consultar CNPJ.'),
      });
    }
  });

  app.post('/api/public/demo/products/extract-import', publicAiLimiter, uploadLimiter, async (req, res) => {
    try {
      const ctx = extractClientSecurityContext(req);
      const { mode, fileName, mimeType, base64Data, textContent } = req.body as {
        mode: 'catalog' | 'sales';
        fileName: string;
        mimeType: string;
        base64Data?: string;
        textContent?: string;
      };
      if (mode !== 'catalog' && mode !== 'sales') {
        return res.status(400).json({ error: 'Modo inválido.' });
      }
      const checked = inspectDocumentOrImageUpload({
        fileName: fileName || 'arquivo',
        mimeType: mimeType || 'application/octet-stream',
        base64Data,
      });
      if (!checked.ok) {
        void recordSecurityEvent({
          eventType: 'UPLOAD_REJECTED',
          severity: 'medium',
          ip: ctx.ip,
          method: req.method,
          path: req.path,
          cfRay: ctx.cfRay,
          cfCountry: ctx.cfCountry,
          userAgent: ctx.userAgent,
          details: { reason: checked.error, fileName: checked.safeFileName },
        });
        return res.status(400).json({ error: checked.error });
      }

      const extracted = await extractProductCatalogOrSalesFromContent({
        mode,
        fileName: checked.safeFileName,
        mimeType: checked.detectedMimeType || mimeType || 'application/octet-stream',
        base64Data,
        textContent: typeof textContent === 'string' ? textContent.slice(0, 60000) : undefined,
      });
      res.json(extracted);
    } catch (error: unknown) {
      console.error('Demo extract product import error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({
        error: sanitizeErrorForClient(error, 'Erro ao interpretar arquivo na demonstração.'),
      });
    }
  });

  // Public Gemini Chatbot (zero Cloud SQL user data access; supports Maps & Search Grounding + full history)
  app.post('/api/public/chat', publicAiLimiter, async (req, res) => {
    try {
      const { question, screenContext, history } = req.body as {
        question?: string;
        screenContext?: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      };
      const cleanQuestion = sanitizePlainText(question, 2500);
      if (!cleanQuestion) {
        return res.status(400).json({ error: 'Pergunta é obrigatória.' });
      }
      const result = await askGroundedChatbot({
        question: cleanQuestion,
        screenContext: sanitizePlainText(screenContext, 160) || 'Página Pública / Demonstração',
        history: Array.isArray(history) ? history.slice(-40) : [],
        isAuthenticated: false,
      });
      res.json(result);
    } catch (error: unknown) {
      console.error('Public chat error:', error instanceof Error ? error.message : 'error');
      const friendly = formatFriendlyAiError(
        error,
        'Não foi possível consultar o chatbot no momento. Tente novamente em instantes.'
      );
      res.status(friendly.status).json({ error: friendly.message });
    }
  });

  // =========================================================================
  // PROTECTED ASSET STREAMING (Signed per asset+company OR Auth Bearer)
  // =========================================================================
  app.get('/api/beta/assets/:assetId', async (req, res) => {
    try {
      const assetId = parsePositiveIntParam(req.params.assetId);
      const cid = parsePositiveIntParam(req.query.cid);
      const sig = String(req.query.sig || '');
      if (!assetId || !cid || !verifyAssetSignature(assetId, cid, sig)) {
        return res.status(403).json({ error: 'Acesso negado ao arquivo.' });
      }
      const [asset] = await db
        .select()
        .from(companyAssets)
        .where(and(eq(companyAssets.id, assetId), eq(companyAssets.companyId, cid)));
      if (!asset) {
        return res.status(404).json({ error: 'Arquivo não encontrado.' });
      }
      const buffer = Buffer.from(asset.dataBase64, 'base64');
      if (!verifyImageBufferSignature(buffer, asset.mimeType)) {
        return res.status(403).json({ error: 'Assinatura do arquivo inválida.' });
      }
      const safeDownloadName = sanitizeUploadFileName(asset.fileName, 'asset');
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
      res.setHeader('Content-Disposition', `inline; filename="${safeDownloadName}"`);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.send(buffer);
    } catch (error) {
      console.error('Asset fetch error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao carregar arquivo.' });
    }
  });

  // =========================================================================
  // BETA AUTHENTICATED MULTI-TENANT ROUTES
  // =========================================================================
  app.get('/api/beta/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser!;
      const owned = await db
        .select()
        .from(companies)
        .where(eq(companies.ownerUserId, dbUser.id))
        .orderBy(desc(companies.createdAt));

      const memberships = await db
        .select()
        .from(companyMembers)
        .where(and(eq(companyMembers.userId, dbUser.id), eq(companyMembers.status, 'active')));

      const memberCompanyIds = memberships
        .map((m) => m.companyId)
        .filter((id) => !owned.some((c) => c.id === id));

      const sharedCompanies = [];
      for (const cid of memberCompanyIds) {
        const [comp] = await db.select().from(companies).where(eq(companies.id, cid));
        if (comp) sharedCompanies.push(comp);
      }

      res.json({
        user: dbUser,
        companies: [...owned, ...sharedCompanies],
      });
    } catch (error) {
      console.error('GET /api/beta/me error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao carregar perfil e empresas.' });
    }
  });

  app.post('/api/beta/companies', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser!;
      const body = req.body as Record<string, unknown>;
      const name = sanitizePlainText(body.name, 160);
      if (!name) {
        return res.status(400).json({ error: 'Nome da empresa é obrigatório.' });
      }

      const [company] = await db
        .insert(companies)
        .values({
          ownerUserId: dbUser.id,
          name,
          legalName: sanitizePlainText(body.legalName, 200),
          tradeName: sanitizePlainText(body.tradeName, 200) || name,
          cnpj: sanitizeCnpj(body.cnpj),
          cnae: sanitizePlainText(body.cnae, 80),
          segment: sanitizePlainText(body.segment, 120),
          companySize: sanitizePlainText(body.companySize, 80),
          registrationStatus: sanitizePlainText(body.registrationStatus, 80),
          description: sanitizePlainText(body.description, 2500),
          operationType: ['physical', 'ecommerce', 'both'].includes(String(body.operationType))
            ? String(body.operationType)
            : 'both',
          address: sanitizePlainText(body.address, 260),
          city: sanitizePlainText(body.city, 120),
          state: sanitizePlainText(body.state, 4).toUpperCase(),
          phone: sanitizePlainText(body.phone, 40),
          commercialEmail: sanitizeEmail(body.commercialEmail) || dbUser.email,
          website: sanitizeHttpUrl(body.website),
          logoUrl: sanitizeHttpUrl(body.logoUrl, { allowRelativeAsset: true }),
        })
        .returning();

      await db.insert(companyUnits).values({
        companyId: company.id,
        name: `${name} — Matriz`,
        city: company.city,
        state: company.state,
        isPrimary: true,
      });

      await db.insert(companyMembers).values({
        companyId: company.id,
        userId: dbUser.id,
        email: dbUser.email,
        role: 'owner',
        status: 'active',
      });

      const planCode = (['basico', 'profissional', 'empresarial'].includes(String(body.planCode))
        ? String(body.planCode)
        : 'profissional') as PlanCode;
      const planDef = PLANS_CONFIG[planCode];
      const trialEndsAt = new Date(Date.now() + planDef.trialDays * 86400 * 1000);

      await db.insert(subscriptions).values({
        companyId: company.id,
        planCode,
        billingCycle: body.billingCycle === 'annual' ? 'annual' : 'monthly',
        status: 'trialing',
        trialEndsAt,
      });

      for (const item of DEFAULT_INTEGRATION_PROVIDERS) {
        await db.insert(integrations).values({
          companyId: company.id,
          provider: item.provider,
          accountLabel: item.accountLabel,
          connectionStatus:
            item.provider === 'own_site' && company.website ? 'connected' : 'disconnected',
          storeUrl: item.provider === 'own_site' ? company.website : '',
        });
      }

      await db.insert(lgpdRecords).values({
        companyId: company.id,
        userId: dbUser.id,
        recordType: 'consent',
        status: 'active',
        scope: 'Processamento de dados empresariais e análise estratégica (Beta)',
        notes: 'Consentimento registrado no cadastro inicial da empresa.',
      });

      await recordAuditLog({
        companyId: company.id,
        userId: dbUser.id,
        userEmail: dbUser.email,
        action: 'CREATE_COMPANY',
        entityType: 'company',
        entityId: company.id,
        details: { name: company.name, planCode },
      });

      // Automatic background bootstrap: regional Google Maps competitors + full strategic intelligence
      if (company.segment || company.city || company.state) {
        void (async () => {
          try {
            await runCompetitorDiscoveryForCompany(company, dbUser.id, dbUser.email).catch((err) =>
              console.warn('Auto competitor discovery skipped:', err instanceof Error ? err.message : err)
            );
            await runIntelligenceGenerationForCompany(company, dbUser.id, dbUser.email, 'all').catch((err) =>
              console.warn('Auto intelligence bootstrap skipped:', err instanceof Error ? err.message : err)
            );
          } catch (err) {
            console.warn('Company background bootstrap warning:', err);
          }
        })();
      }

      res.status(201).json({ company });
    } catch (error) {
      console.error('POST /api/beta/companies error:', error);
      res.status(500).json({ error: 'Erro ao cadastrar empresa.' });
    }
  });

  // Explicit idempotent AI bootstrap endpoint when entering a newly created company workspace
  app.post('/api/beta/companies/:companyId/bootstrap', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      let discoveredCount = 0;
      let groundedLinks: Array<{ title: string; uri: string }> = [];
      let searchSummary = '';

      if (access.company.segment || access.company.city || access.company.state) {
        try {
          const compRes = await runCompetitorDiscoveryForCompany(
            access.company,
            req.dbUser!.id,
            req.dbUser!.email
          );
          discoveredCount = compRes.savedCount;
          groundedLinks = compRes.groundedLinks;
          searchSummary = compRes.searchSummary;
        } catch (err) {
          console.warn('Bootstrap competitor discovery warning:', err instanceof Error ? err.message : err);
        }
      }

      // Automatic Google Reviews capture on onboarding/bootstrap
      let googleReviewsSynced = 0;
      try {
        const gSync = await executeGoogleReviewsSyncForCompany(access.company);
        googleReviewsSynced = gSync.insertedReviewsCount;
      } catch (err) {
        console.warn('Bootstrap Google Reviews sync warning:', err instanceof Error ? err.message : err);
      }

      const intelRes = await runIntelligenceGenerationForCompany(
        access.company,
        req.dbUser!.id,
        req.dbUser!.email,
        'all'
      );

      res.json({
        discoveredCount,
        googleReviewsSynced,
        insertedCount: intelRes.insertedCount,
        groundedLinks,
        searchSummary,
        groundedWebSources: intelRes.groundedWebSources,
      });
    } catch (error) {
      console.error('POST bootstrap error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao executar análise inicial automática.',
      });
    }
  });

  // Upload asset (logo or product image) scoped strictly to company
  app.post('/api/beta/companies/:companyId/assets', requireAuth, uploadLimiter, async (req: AuthRequest, res) => {
    try {
      const ctx = extractClientSecurityContext(req);
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') {
        return res.status(403).json({ error: 'Acesso negado a esta empresa.' });
      }

      const { fileName, mimeType, dataBase64 } = req.body as {
        fileName?: string;
        mimeType?: string;
        dataBase64?: string;
      };
      if (!fileName || !mimeType || !dataBase64) {
        return res.status(400).json({ error: 'Arquivo inválido.' });
      }
      const checked = inspectImageUpload({
        fileName,
        mimeType,
        dataBase64,
      });
      if (!checked.ok) {
        void recordSecurityEvent({
          eventType: 'UPLOAD_REJECTED',
          severity: 'medium',
          ip: ctx.ip,
          method: req.method,
          path: req.path,
          userId: req.dbUser!.id,
          companyId,
          cfRay: ctx.cfRay,
          cfCountry: ctx.cfCountry,
          userAgent: ctx.userAgent,
          details: { reason: checked.error, fileName: checked.safeFileName },
        });
        return res.status(400).json({ error: checked.error });
      }

      const [asset] = await db
        .insert(companyAssets)
        .values({
          companyId,
          uploadedByUserId: req.dbUser!.id,
          fileName: checked.safeFileName,
          mimeType: checked.detectedMimeType,
          sizeBytes: checked.sizeBytes,
          dataBase64: checked.buffer.toString('base64'),
        })
        .returning();

      const url = signAssetUrl(asset.id, companyId);
      res.status(201).json({ id: asset.id, url });
    } catch (error) {
      console.error('POST asset error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao enviar imagem.' });
    }
  });

  // Full Company Workspace Bundle
  app.get('/api/beta/companies/:companyId/workspace', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado a esta empresa.' });

      const [
        unitsList,
        membersList,
        [subscription],
        categoriesList,
        productsList,
        integrationsList,
        importsList,
        metricsList,
        competitorsList,
        reviewsList,
        evidenceList,
        strategicList,
        simulationsList,
        auditList,
        lgpdList,
        syncBundle,
      ] = await Promise.all([
        db.select().from(companyUnits).where(eq(companyUnits.companyId, companyId)),
        db.select().from(companyMembers).where(eq(companyMembers.companyId, companyId)),
        db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId)),
        db.select().from(categories).where(eq(categories.companyId, companyId)),
        db.select().from(products).where(eq(products.companyId, companyId)).orderBy(desc(products.createdAt)),
        db.select().from(integrations).where(eq(integrations.companyId, companyId)),
        db.select().from(dataImports).where(eq(dataImports.companyId, companyId)).orderBy(desc(dataImports.createdAt)),
        db.select().from(internalMetrics).where(eq(internalMetrics.companyId, companyId)).orderBy(desc(internalMetrics.periodDate)),
        db.select().from(competitors).where(eq(competitors.companyId, companyId)).orderBy(desc(competitors.updatedAt)),
        db.select().from(customerReviews).where(eq(customerReviews.companyId, companyId)).orderBy(desc(customerReviews.createdAt)),
        db.select().from(evidenceCards).where(eq(evidenceCards.companyId, companyId)).orderBy(desc(evidenceCards.createdAt)),
        db.select().from(strategicItems).where(eq(strategicItems.companyId, companyId)).orderBy(desc(strategicItems.createdAt)),
        db.select().from(simulations).where(eq(simulations.companyId, companyId)).orderBy(desc(simulations.createdAt)),
        db.select().from(auditLogs).where(eq(auditLogs.companyId, companyId)).orderBy(desc(auditLogs.createdAt)),
        db.select().from(lgpdRecords).where(eq(lgpdRecords.companyId, companyId)).orderBy(desc(lgpdRecords.createdAt)),
        buildCompanySyncSummaries(companyId),
      ]);

      res.json({
        company: access.company,
        role: access.role,
        units: unitsList,
        members: membersList,
        subscription,
        reputationProfile: syncBundle.reputationProfile,
        categories: categoriesList,
        products: productsList,
        integrations: integrationsList,
        imports: importsList,
        metrics: metricsList,
        competitors: competitorsList,
        reviews: reviewsList,
        evidenceCards: evidenceList,
        strategicItems: strategicList,
        simulations: simulationsList,
        financialSales: syncBundle.sales,
        financialCosts: syncBundle.costs,
        financialExpenses: syncBundle.expenses,
        inventoryItems: syncBundle.inventory,
        financialSummary: syncBundle.financialSummary,
        auditLogs: auditList.slice(0, 100),
        lgpdRecords: lgpdList,
      });
    } catch (error) {
      console.error('GET workspace error:', error);
      res.status(500).json({ error: 'Erro ao carregar dados da empresa.' });
    }
  });

  app.get('/api/beta/companies/:companyId/macro', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado a esta empresa.' });

      const payload = await getOfficialMacroBundle(access.company.state);
      res.json(payload);
    } catch (error) {
      console.error('GET company macro error:', error);
      res.status(500).json({ error: 'Falha ao consultar indicadores oficiais.' });
    }
  });

  app.patch('/api/beta/companies/:companyId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || !['owner', 'admin'].includes(access.role)) {
        return res.status(403).json({ error: 'Permissão insuficiente para editar empresa.' });
      }
      const b = req.body as Record<string, unknown>;
      const [updated] = await db
        .update(companies)
        .set({
          name: b.name !== undefined ? sanitizePlainText(b.name, 160) || access.company.name : access.company.name,
          legalName: b.legalName !== undefined ? sanitizePlainText(b.legalName, 200) : access.company.legalName,
          tradeName: b.tradeName !== undefined ? sanitizePlainText(b.tradeName, 200) : access.company.tradeName,
          cnpj: b.cnpj !== undefined ? sanitizeCnpj(b.cnpj) : access.company.cnpj,
          cnae: b.cnae !== undefined ? sanitizePlainText(b.cnae, 80) : access.company.cnae,
          segment: b.segment !== undefined ? sanitizePlainText(b.segment, 120) : access.company.segment,
          companySize: b.companySize !== undefined ? sanitizePlainText(b.companySize, 80) : access.company.companySize,
          registrationStatus: b.registrationStatus !== undefined ? sanitizePlainText(b.registrationStatus, 80) : access.company.registrationStatus,
          description: b.description !== undefined ? sanitizePlainText(b.description, 2500) : access.company.description,
          operationType:
            b.operationType !== undefined && ['physical', 'ecommerce', 'both'].includes(String(b.operationType))
              ? String(b.operationType)
              : access.company.operationType,
          address: b.address !== undefined ? sanitizePlainText(b.address, 260) : access.company.address,
          city: b.city !== undefined ? sanitizePlainText(b.city, 120) : access.company.city,
          state: b.state !== undefined ? sanitizePlainText(b.state, 4).toUpperCase() : access.company.state,
          phone: b.phone !== undefined ? sanitizePlainText(b.phone, 40) : access.company.phone,
          commercialEmail:
            b.commercialEmail !== undefined
              ? sanitizeEmail(b.commercialEmail) || access.company.commercialEmail
              : access.company.commercialEmail,
          website: b.website !== undefined ? sanitizeHttpUrl(b.website) : access.company.website,
          logoUrl:
            b.logoUrl !== undefined
              ? sanitizeHttpUrl(b.logoUrl, { allowRelativeAsset: true })
              : access.company.logoUrl,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId))
        .returning();

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'UPDATE_COMPANY',
        entityType: 'company',
        entityId: companyId,
      });

      res.json({ company: updated });
    } catch (error) {
      console.error('PATCH company error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao atualizar empresa.' });
    }
  });

  // Categories CRUD
  app.post('/api/beta/companies/:companyId/categories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-');

      const [cat] = await db
        .insert(categories)
        .values({
          companyId,
          name,
          slug,
          description: String(req.body.description || ''),
        })
        .returning();

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'CREATE_CATEGORY',
        entityType: 'category',
        entityId: cat.id,
        details: { name },
      });
      res.status(201).json({ category: cat });
    } catch (error) {
      console.error('POST category error:', error);
      res.status(500).json({ error: 'Erro ao criar categoria.' });
    }
  });

  app.delete('/api/beta/companies/:companyId/categories/:categoryId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const categoryId = Number(req.params.categoryId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      await db
        .delete(categories)
        .where(and(eq(categories.id, categoryId), eq(categories.companyId, companyId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('DELETE category error:', error);
      res.status(500).json({ error: 'Erro ao excluir categoria.' });
    }
  });

  // Products CRUD
  app.post('/api/beta/companies/:companyId/products', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });
      const b = req.body as Record<string, unknown>;
      const name = sanitizePlainText(b.name, 160);
      if (!name) return res.status(400).json({ error: 'Nome do produto é obrigatório.' });

      let safeCategoryId: number | null = null;
      if (b.categoryId) {
        const candidateCatId = parsePositiveIntParam(b.categoryId);
        if (!candidateCatId) {
          return res.status(400).json({ error: 'Categoria inválida.' });
        }
        const [ownedCat] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.id, candidateCatId), eq(categories.companyId, companyId)));
        if (!ownedCat) {
          return res.status(403).json({ error: 'Categoria não pertence a esta empresa.' });
        }
        safeCategoryId = ownedCat.id;
      }

      const [prod] = await db
        .insert(products)
        .values({
          companyId,
          categoryId: safeCategoryId,
          name,
          description: sanitizePlainText(b.description, 1500),
          sku: sanitizePlainText(b.sku, 80),
          priceCents: Math.max(0, Math.round(Number(b.priceReais || 0) * 100)),
          acquisitionCostCents: Math.max(0, Math.round(Number(b.costReais || 0) * 100)),
          stockQty: Math.max(0, Math.round(Number(b.stockQty || 0))),
          soldUnits: Math.max(0, Math.round(Number(b.soldUnits || 0))),
          status: ['active', 'draft', 'archived'].includes(String(b.status)) ? String(b.status) : 'active',
          imageUrl: sanitizeHttpUrl(b.imageUrl, { allowRelativeAsset: true }),
        })
        .returning();

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'CREATE_PRODUCT',
        entityType: 'product',
        entityId: prod.id,
        details: { name: prod.name, sku: prod.sku },
      });

      res.status(201).json({ product: prod });
    } catch (error) {
      console.error('POST product error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao cadastrar produto.' });
    }
  });

  app.patch('/api/beta/companies/:companyId/products/:productId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const productId = Number(req.params.productId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const [existing] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, productId), eq(products.companyId, companyId)));
      if (!existing) return res.status(404).json({ error: 'Produto não encontrado.' });

      const b = req.body as Record<string, unknown>;
      let nextCategoryId = existing.categoryId;
      if (b.categoryId !== undefined) {
        if (!b.categoryId) {
          nextCategoryId = null;
        } else {
          const candidateCatId = parsePositiveIntParam(b.categoryId);
          if (!candidateCatId) return res.status(400).json({ error: 'Categoria inválida.' });
          const [ownedCat] = await db
            .select({ id: categories.id })
            .from(categories)
            .where(and(eq(categories.id, candidateCatId), eq(categories.companyId, companyId)));
          if (!ownedCat) {
            return res.status(403).json({ error: 'Categoria não pertence a esta empresa.' });
          }
          nextCategoryId = ownedCat.id;
        }
      }

      const [updated] = await db
        .update(products)
        .set({
          name: b.name !== undefined ? sanitizePlainText(b.name, 160) || existing.name : existing.name,
          description: b.description !== undefined ? sanitizePlainText(b.description, 1500) : existing.description,
          sku: b.sku !== undefined ? sanitizePlainText(b.sku, 80) : existing.sku,
          categoryId: nextCategoryId,
          priceCents: b.priceReais !== undefined ? Math.max(0, Math.round(Number(b.priceReais) * 100)) : existing.priceCents,
          acquisitionCostCents: b.costReais !== undefined ? Math.max(0, Math.round(Number(b.costReais) * 100)) : existing.acquisitionCostCents,
          stockQty: b.stockQty !== undefined ? Math.max(0, Math.round(Number(b.stockQty))) : existing.stockQty,
          soldUnits: b.soldUnits !== undefined ? Math.max(0, Math.round(Number(b.soldUnits))) : existing.soldUnits,
          status:
            b.status !== undefined && ['active', 'draft', 'archived'].includes(String(b.status))
              ? String(b.status)
              : existing.status,
          imageUrl:
            b.imageUrl !== undefined
              ? sanitizeHttpUrl(b.imageUrl, { allowRelativeAsset: true })
              : existing.imageUrl,
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
        .returning();

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'UPDATE_PRODUCT',
        entityType: 'product',
        entityId: productId,
        details: { name: updated.name },
      });

      res.json({ product: updated });
    } catch (error) {
      console.error('PATCH product error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao atualizar produto.' });
    }
  });

  app.delete('/api/beta/companies/:companyId/products/:productId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const productId = Number(req.params.productId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      await db
        .delete(products)
        .where(and(eq(products.id, productId), eq(products.companyId, companyId)));

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'DELETE_PRODUCT',
        entityType: 'product',
        entityId: productId,
      });

      res.json({ deleted: true });
    } catch (error) {
      console.error('DELETE product error:', error);
      res.status(500).json({ error: 'Erro ao excluir produto.' });
    }
  });

  // Extract Product Catalog / Stock OR Units Sold from Excel/PDF
  app.post('/api/beta/companies/:companyId/products/extract-import', requireAuth, uploadLimiter, async (req: AuthRequest, res) => {
    try {
      const ctx = extractClientSecurityContext(req);
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const { mode, fileName, mimeType, base64Data, textContent } = req.body as {
        mode: 'catalog' | 'sales';
        fileName: string;
        mimeType: string;
        base64Data?: string;
        textContent?: string;
      };

      if (mode !== 'catalog' && mode !== 'sales') {
        return res.status(400).json({ error: 'Modo de importação inválido (use catalog ou sales).' });
      }
      const checked = inspectDocumentOrImageUpload({
        fileName: fileName || 'arquivo',
        mimeType: mimeType || 'application/octet-stream',
        base64Data,
      });
      if (!checked.ok) {
        void recordSecurityEvent({
          eventType: 'UPLOAD_REJECTED',
          severity: 'medium',
          ip: ctx.ip,
          method: req.method,
          path: req.path,
          userId: req.dbUser!.id,
          companyId,
          cfRay: ctx.cfRay,
          cfCountry: ctx.cfCountry,
          userAgent: ctx.userAgent,
          details: { reason: checked.error, fileName: checked.safeFileName },
        });
        return res.status(400).json({ error: checked.error });
      }

      const extracted = await extractProductCatalogOrSalesFromContent({
        mode,
        fileName: checked.safeFileName,
        mimeType: checked.detectedMimeType || mimeType || 'application/octet-stream',
        base64Data,
        textContent: typeof textContent === 'string' ? textContent.slice(0, 60000) : undefined,
      });

      res.json(extracted);
    } catch (error: unknown) {
      console.error('Extract product import error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({
        error: sanitizeErrorForClient(error, 'Erro ao interpretar arquivo de produtos/vendas.'),
      });
    }
  });

  // Confirm Product Catalog / Stock OR Units Sold Import
  app.post('/api/beta/companies/:companyId/products/import-confirm', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const { mode, fileName, fileType, mergeStrategy, items } = req.body as {
        mode: 'catalog' | 'sales';
        fileName?: string;
        fileType?: string;
        mergeStrategy?: 'replace' | 'add';
        items?: Array<{
          sku?: string;
          name?: string;
          priceReais?: number;
          costReais?: number;
          stockQty?: number;
          categoryName?: string;
          soldUnits?: number;
        }>;
      };

      if (mode !== 'catalog' && mode !== 'sales') {
        return res.status(400).json({ error: 'Modo de confirmação inválido.' });
      }
      const safeItems = Array.isArray(items) ? items : [];
      if (safeItems.length === 0) {
        return res.status(400).json({ error: 'Nenhum item encontrado para confirmar a importação.' });
      }

      const norm = (v?: string) =>
        String(v || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

      const existingProducts = await db
        .select()
        .from(products)
        .where(eq(products.companyId, companyId));
      const existingCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.companyId, companyId));

      const catMap = new Map<string, number>();
      for (const c of existingCategories) {
        catMap.set(norm(c.name), c.id);
      }

      let createdCount = 0;
      let updatedCount = 0;

      if (mode === 'catalog') {
        for (const item of safeItems) {
          const cleanSku = String(item.sku || '').trim();
          const cleanName = String(item.name || '').trim() || cleanSku;
          if (!cleanName) continue;

          const priceReais = Math.max(0, Number(item.priceReais || 0));
          const costReais = Math.max(0, Number(item.costReais || 0));
          const hasStock = item.stockQty !== undefined && item.stockQty !== null && !Number.isNaN(Number(item.stockQty));
          const stockQty = hasStock ? Math.max(0, Math.round(Number(item.stockQty))) : 0;

          let resolvedCategoryId: number | null = null;
          const catName = String(item.categoryName || '').trim();
          if (catName) {
            const catKey = norm(catName);
            if (catMap.has(catKey)) {
              resolvedCategoryId = catMap.get(catKey)!;
            } else {
              const slug = `${catKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat'}-${Date.now().toString(36).slice(-4)}`;
              const [newCat] = await db
                .insert(categories)
                .values({
                  companyId,
                  name: catName,
                  slug,
                  description: 'Criada via importação de catálogo',
                })
                .returning();
              catMap.set(catKey, newCat.id);
              resolvedCategoryId = newCat.id;
            }
          }

          const match = existingProducts.find(
            (p) =>
              (cleanSku && norm(p.sku) && norm(p.sku) === norm(cleanSku)) ||
              norm(p.name) === norm(cleanName)
          );

          if (match) {
            const [updated] = await db
              .update(products)
              .set({
                name: cleanName || match.name,
                sku: cleanSku || match.sku,
                priceCents: priceReais > 0 ? Math.round(priceReais * 100) : match.priceCents,
                acquisitionCostCents:
                  costReais > 0 ? Math.round(costReais * 100) : match.acquisitionCostCents,
                stockQty: hasStock ? stockQty : match.stockQty,
                categoryId: resolvedCategoryId ?? match.categoryId,
                updatedAt: new Date(),
              })
              .where(and(eq(products.id, match.id), eq(products.companyId, companyId)))
              .returning();
            Object.assign(match, updated);
            updatedCount += 1;
          } else {
            const [created] = await db
              .insert(products)
              .values({
                companyId,
                categoryId: resolvedCategoryId,
                name: cleanName,
                description: '',
                sku: cleanSku,
                priceCents: Math.round(priceReais * 100),
                acquisitionCostCents: Math.round(costReais * 100),
                stockQty,
                soldUnits: 0,
                status: 'active',
                imageUrl: '',
              })
              .returning();
            existingProducts.push(created);
            createdCount += 1;
          }
        }
      } else {
        const strategy = mergeStrategy === 'add' ? 'add' : 'replace';
        for (const item of safeItems) {
          const cleanSku = String(item.sku || '').trim();
          const cleanName = String(item.name || '').trim() || cleanSku;
          if (!cleanName && !cleanSku) continue;

          const units = Math.max(0, Math.round(Number(item.soldUnits || 0)));
          const priceReais = Math.max(0, Number(item.priceReais || 0));

          const match = existingProducts.find(
            (p) =>
              (cleanSku && norm(p.sku) && norm(p.sku) === norm(cleanSku)) ||
              norm(p.name) === norm(cleanName)
          );

          if (match) {
            const nextSold = strategy === 'add' ? (match.soldUnits || 0) + units : units;
            const [updated] = await db
              .update(products)
              .set({
                soldUnits: nextSold,
                priceCents:
                  match.priceCents === 0 && priceReais > 0
                    ? Math.round(priceReais * 100)
                    : match.priceCents,
                updatedAt: new Date(),
              })
              .where(and(eq(products.id, match.id), eq(products.companyId, companyId)))
              .returning();
            Object.assign(match, updated);
            updatedCount += 1;
          } else {
            const [created] = await db
              .insert(products)
              .values({
                companyId,
                categoryId: null,
                name: cleanName,
                description: '',
                sku: cleanSku,
                priceCents: Math.round(priceReais * 100),
                acquisitionCostCents: 0,
                stockQty: 0,
                soldUnits: units,
                status: 'active',
                imageUrl: '',
              })
              .returning();
            existingProducts.push(created);
            createdCount += 1;
          }
        }
      }

      const summaryText =
        mode === 'catalog'
          ? `Catálogo/Estoque importado: ${createdCount} produto(s) criado(s), ${updatedCount} atualizado(s).`
          : `Unidades vendidas importadas (${mergeStrategy === 'add' ? 'somando' : 'atualizando'}): ${updatedCount} atualizado(s), ${createdCount} novo(s).`;

      await db.insert(dataImports).values({
        companyId,
        uploadedByUserId: req.dbUser!.id,
        fileName: fileName || (mode === 'catalog' ? 'catalogo-produtos' : 'unidades-vendidas'),
        fileType: fileType || 'spreadsheet',
        sourceOrigin: mode === 'catalog' ? 'Catálogo e Estoque de Produtos' : 'Unidades Vendidas por Produto',
        reliabilityLevel: 'alta',
        extractedRowsJson: safeItems,
        rowCount: safeItems.length,
        summaryText,
        insightsJson: [],
        status: 'confirmed',
      });

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: mode === 'catalog' ? 'IMPORT_PRODUCTS_CATALOG' : 'IMPORT_PRODUCT_SALES',
        entityType: 'product',
        details: { createdCount, updatedCount, totalItems: safeItems.length, fileName },
      });

      res.json({
        createdCount,
        updatedCount,
        totalProcessed: createdCount + updatedCount,
        summaryText,
      });
    } catch (error) {
      console.error('Confirm product import error:', error);
      res.status(500).json({ error: 'Erro ao salvar importação de produtos/vendas.' });
    }
  });

  // Integrations (honest status without fake sync)
  app.patch('/api/beta/companies/:companyId/integrations/:provider', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const provider = String(req.params.provider);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const { storeUrl, clientId } = req.body as { storeUrl?: string; clientId?: string };
      const [existing] = await db
        .select()
        .from(integrations)
        .where(and(eq(integrations.companyId, companyId), eq(integrations.provider, provider)));
      if (!existing) return res.status(404).json({ error: 'Conector não encontrado.' });

      const safeStoreUrl = storeUrl !== undefined ? sanitizeHttpUrl(storeUrl) : existing.storeUrl;
      if (storeUrl !== undefined && String(storeUrl).trim() && !safeStoreUrl) {
        return res.status(400).json({ error: 'URL da loja inválida ou não permitida pela política de segurança.' });
      }

      let newStatus = 'disconnected';
      let lastError = '';
      if (provider === 'own_site') {
        newStatus = safeStoreUrl ? 'connected' : 'disconnected';
      } else {
        newStatus = clientId && clientId.trim() ? 'awaiting_credentials' : 'disconnected';
        lastError =
          'Conector preparado para API oficial. Requer credenciais OAuth aprovadas pelo parceiro no servidor.';
      }

      const [updated] = await db
        .update(integrations)
        .set({
          storeUrl: safeStoreUrl,
          connectionStatus: newStatus,
          lastError,
          configJson: clientId ? { clientIdHint: sanitizePlainText(clientId, 12).slice(0, 6) + '***' } : existing.configJson,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id))
        .returning();

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'UPDATE_INTEGRATION',
        entityType: 'integration',
        entityId: provider,
        details: { newStatus },
      });

      res.json({ integration: updated });
    } catch (error) {
      console.error('PATCH integration error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao configurar integração.' });
    }
  });

  app.post('/api/beta/companies/:companyId/integrations/:provider/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const provider = String(req.params.provider);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const [existing] = await db
        .select()
        .from(integrations)
        .where(and(eq(integrations.companyId, companyId), eq(integrations.provider, provider)));
      if (!existing) return res.status(404).json({ error: 'Conector não encontrado.' });

      if (provider === 'own_site' && existing.storeUrl) {
        const [updated] = await db
          .update(integrations)
          .set({
            lastSyncAt: new Date(),
            lastError: '',
            connectionStatus: 'connected',
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, existing.id))
          .returning();
        return res.json({
          integration: updated,
          message: 'Endereço do site verificado e registrado.',
        });
      }

      const [updated] = await db
        .update(integrations)
        .set({
          lastError:
            'Sincronização não executada: credenciais OAuth oficiais de produção ausentes para este conector.',
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id))
        .returning();

      res.status(400).json({
        integration: updated,
        error:
          'Esta integração oficial ainda não possui token OAuth conectado. Nenhuma importação falsa foi simulada.',
      });
    } catch (error) {
      console.error('POST sync integration error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao sincronizar integração.' });
    }
  });

  // Data Import Preview (AI/OCR for images/PDFs or structured rows) & Confirm
  app.post('/api/beta/companies/:companyId/imports/extract', requireAuth, uploadLimiter, async (req: AuthRequest, res) => {
    try {
      const ctx = extractClientSecurityContext(req);
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const { fileName, mimeType, base64Data, textContent } = req.body as {
        fileName: string;
        mimeType: string;
        base64Data?: string;
        textContent?: string;
      };

      const checked = inspectDocumentOrImageUpload({
        fileName: fileName || 'arquivo',
        mimeType: mimeType || 'application/octet-stream',
        base64Data,
      });
      if (!checked.ok) {
        void recordSecurityEvent({
          eventType: 'UPLOAD_REJECTED',
          severity: 'medium',
          ip: ctx.ip,
          method: req.method,
          path: req.path,
          userId: req.dbUser!.id,
          companyId,
          cfRay: ctx.cfRay,
          cfCountry: ctx.cfCountry,
          userAgent: ctx.userAgent,
          details: { reason: checked.error, fileName: checked.safeFileName },
        });
        return res.status(400).json({ error: checked.error });
      }

      const extracted = await extractStructuredDataFromContent({
        fileName: checked.safeFileName,
        mimeType: checked.detectedMimeType || mimeType,
        base64Data,
        textContent: typeof textContent === 'string' ? textContent.slice(0, 60000) : undefined,
      });

      res.json(extracted);
    } catch (error: unknown) {
      console.error('Extract import error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({
        error: sanitizeErrorForClient(error, 'Erro ao extrair prévia do arquivo.'),
      });
    }
  });

  app.post('/api/beta/companies/:companyId/imports/confirm', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const {
        fileName,
        fileType,
        sourceOrigin,
        reliabilityLevel,
        rows,
        summaryText,
        insights,
      } = req.body as {
        fileName: string;
        fileType: string;
        sourceOrigin: string;
        reliabilityLevel: string;
        summaryText?: string;
        insights?: Array<{ category: string; title: string; detail: string; kind: string }>;
        rows?: Array<{
          periodDate: string;
          revenueReais: number;
          ordersCount: number;
          lossesReais?: number;
          note?: string;
        }>;
      };

      const safeRows = Array.isArray(rows) ? rows : [];
      const cleanSummary = String(summaryText || '').trim();
      const safeInsights = Array.isArray(insights) ? insights : [];

      if (safeRows.length === 0 && !cleanSummary && safeInsights.length === 0) {
        return res.status(400).json({ error: 'Nenhum dado numérico ou resumo textual encontrado para importar.' });
      }

      const [imp] = await db
        .insert(dataImports)
        .values({
          companyId,
          uploadedByUserId: req.dbUser!.id,
          fileName: fileName || 'importacao-manual',
          fileType: fileType || 'manual',
          sourceOrigin: sourceOrigin || 'Alimentação manual',
          reliabilityLevel: reliabilityLevel || 'media',
          extractedRowsJson: safeRows,
          rowCount: safeRows.length,
          summaryText: cleanSummary,
          insightsJson: safeInsights,
          status: 'confirmed',
        })
        .returning();

      for (const r of safeRows) {
        const revCents = Math.max(0, Math.round(Number(r.revenueReais || 0) * 100));
        const orders = Math.max(0, Math.round(Number(r.ordersCount || 0)));
        const avgTicket = orders > 0 ? Math.round(revCents / orders) : 0;
        await db.insert(internalMetrics).values({
          companyId,
          periodDate: String(r.periodDate || new Date().toISOString().slice(0, 10)),
          revenueCents: revCents,
          ordersCount: orders,
          avgTicketCents: avgTicket,
          lossesCents: Math.max(0, Math.round(Number(r.lossesReais || 0) * 100)),
          sourceOrigin: sourceOrigin || fileName,
          reliabilityLevel: reliabilityLevel || 'media',
        });
      }

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'CONFIRM_IMPORT',
        entityType: 'data_import',
        entityId: imp.id,
        details: { fileName, rowCount: safeRows.length, insightsCount: safeInsights.length, sourceOrigin },
      });

      // Automatically interpret document and populate Radar, SWOT/PESTEL/Porter/TOWS, Analyses, Opportunities & Decisions
      let generatedCount = 0;
      try {
        const intel = await runIntelligenceGenerationForCompany(
          access.company,
          req.dbUser!.id,
          req.dbUser!.email,
          'all'
        );
        generatedCount = intel.insertedCount;
      } catch (aiErr) {
        console.warn('Auto intelligence after document confirm warning:', aiErr instanceof Error ? aiErr.message : aiErr);
      }

      res.status(201).json({ importRecord: imp, generatedCount });
    } catch (error) {
      console.error('Confirm import error:', error);
      res.status(500).json({ error: 'Erro ao confirmar importação.' });
    }
  });

  // Manual internal metrics
  app.post('/api/beta/companies/:companyId/metrics', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as Record<string, unknown>;
      const revCents = Math.max(0, Math.round(Number(b.revenueReais || 0) * 100));
      const orders = Math.max(0, Math.round(Number(b.ordersCount || 0)));
      const avgTicket = orders > 0 ? Math.round(revCents / orders) : 0;

      const [metric] = await db
        .insert(internalMetrics)
        .values({
          companyId,
          periodDate: sanitizePlainText(b.periodDate || new Date().toISOString().slice(0, 10), 20),
          revenueCents: revCents,
          ordersCount: orders,
          avgTicketCents: avgTicket,
          grossMarginPct: sanitizePlainText(b.grossMarginPct, 24),
          lossesCents: Math.max(0, Math.round(Number(b.lossesReais || 0) * 100)),
          sourceOrigin: sanitizePlainText(b.sourceOrigin || 'Lançamento manual', 120) || 'Lançamento manual',
          reliabilityLevel: sanitizePlainText(b.reliabilityLevel || 'alta', 32) || 'alta',
        })
        .returning();

      res.status(201).json({ metric });
    } catch (error) {
      console.error('POST metric error:', error);
      res.status(500).json({ error: 'Erro ao salvar indicador interno.' });
    }
  });

  // Competitors (enforcing plan limits + add-ons)
  app.post('/api/beta/companies/:companyId/competitors', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId));
      const planCode = (sub?.planCode || 'profissional') as PlanCode;
      const limit = PLANS_CONFIG[planCode].limits.competitorsMax + (sub?.extraCompetitors || 0);
      const current = await db.select().from(competitors).where(eq(competitors.companyId, companyId));
      if (current.length >= limit) {
        return res.status(403).json({
          error: `Limite de ${limit} concorrente(s) atingido no plano ${PLANS_CONFIG[planCode].name}. Adicione um concorrente extra ou faça upgrade.`,
        });
      }

      const b = req.body as Record<string, unknown>;
      const name = sanitizePlainText(b.name, 160);
      if (!name) return res.status(400).json({ error: 'Nome do concorrente é obrigatório.' });

      const [comp] = await db
        .insert(competitors)
        .values({
          companyId,
          name,
          segment: sanitizePlainText(b.segment, 120),
          positioning: sanitizePlainText(b.positioning, 400),
          announcedPriceRange: sanitizePlainText(b.announcedPriceRange, 160),
          shippingInfo: sanitizePlainText(b.shippingInfo, 240),
          deliveryDays: sanitizePlainText(b.deliveryDays, 80),
          publicRating: sanitizePlainText(b.publicRating, 40),
          complaintsNote: sanitizePlainText(b.complaintsNote, 500),
          lastChangeNote: sanitizePlainText(b.lastChangeNote, 400),
          sourceUrl: sanitizeHttpUrl(b.sourceUrl),
          channels: sanitizePlainText(b.channels, 200),
          priceComparison: sanitizePlainText(b.priceComparison, 120) || 'Não informado',
          threatLevel: sanitizePlainText(b.threatLevel, 60) || 'Impacto médio',
          reviewSnippetsJson: Array.isArray(b.reviewSnippets) ? b.reviewSnippets.slice(0, 20) : [],
        })
        .returning();

      res.status(201).json({ competitor: comp });
    } catch (error) {
      console.error('POST competitor error:', error);
      res.status(500).json({ error: 'Erro ao cadastrar concorrente.' });
    }
  });

  // Automated Regional Competitor Discovery via Google Maps Grounding + Public Reviews
  app.post('/api/beta/companies/:companyId/competitors/discover', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const result = await runCompetitorDiscoveryForCompany(
        access.company,
        req.dbUser!.id,
        req.dbUser!.email
      );
      res.json(result);
    } catch (error) {
      console.error('Discover competitors error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao buscar concorrentes no Google Maps.',
      });
    }
  });

  app.delete('/api/beta/companies/:companyId/competitors/:competitorId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const competitorId = Number(req.params.competitorId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      await db
        .delete(competitors)
        .where(and(eq(competitors.id, competitorId), eq(competitors.companyId, companyId)));
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao remover concorrente.' });
    }
  });

  // Customer Reviews + AI Interpretation
  app.post('/api/beta/companies/:companyId/reviews', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as Record<string, unknown>;
      const commentText = String(b.commentText || '').trim();
      if (!commentText) return res.status(400).json({ error: 'Texto da avaliação é obrigatório.' });

      const rating = Math.min(5, Math.max(1, Math.round(Number(b.rating || 5))));
      const sentiment = rating >= 4 ? 'positivo' : rating === 3 ? 'neutro' : 'negativo';

      const [review] = await db
        .insert(customerReviews)
        .values({
          companyId,
          source: String(b.source || 'manual'),
          rating,
          sentiment,
          commentText,
          authorLabel: String(b.authorLabel || 'Cliente'),
          hasLgpdConsent: Boolean(b.hasLgpdConsent ?? true),
          reviewedAt: String(b.reviewedAt || new Date().toISOString().slice(0, 10)),
        })
        .returning();

      res.status(201).json({ review });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao registrar avaliação.' });
    }
  });

  app.post('/api/beta/companies/:companyId/reviews/sync-google', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const result = await executeGoogleReviewsSyncForCompany(access.company);
      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'SYNC_GOOGLE_REVIEWS',
        entityType: 'company_reputation',
        entityId: companyId,
        details: { syncStatus: result.syncStatus, insertedReviewsCount: result.insertedReviewsCount },
      });
      res.json(result);
    } catch (error) {
      console.error('Google Reviews sync error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao sincronizar avaliações no Google Reviews.',
      });
    }
  });

  app.post('/api/beta/companies/:companyId/reviews/reclame-aqui', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const { url } = req.body as { url?: string };
      const cleanUrl = String(url || '').trim();

      const [existingProf] = await db
        .select()
        .from(companyReputationProfiles)
        .where(eq(companyReputationProfiles.companyId, companyId));

      if (!cleanUrl) {
        if (existingProf) {
          const [updated] = await db
            .update(companyReputationProfiles)
            .set({
              reclameAquiUrl: '',
              reclameAquiCaptureStatus: 'idle',
              reclameAquiCaptureNote: 'Link do Reclame Aqui removido.',
              updatedAt: new Date(),
            })
            .where(eq(companyReputationProfiles.id, existingProf.id))
            .returning();
          return res.json({ profile: updated, insertedComplaintsCount: 0 });
        }
        return res.json({ profile: null, insertedComplaintsCount: 0 });
      }

      const capture = await captureReclameAquiProfile({
        companyName: access.company.name,
        url: cleanUrl,
      });

      if (!capture.validUrl) {
        return res.status(400).json({ error: capture.captureNote });
      }

      const existingReviews = await db
        .select()
        .from(customerReviews)
        .where(and(eq(customerReviews.companyId, companyId), eq(customerReviews.source, 'reclame_aqui')));

      const existingKeys = new Set(
        existingReviews.map((r) => r.commentText.slice(0, 70).toLowerCase().trim())
      );

      let insertedComplaintsCount = 0;
      for (const comp of capture.extractedComplaints) {
        const key = comp.commentText.slice(0, 70).toLowerCase().trim();
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        await db.insert(customerReviews).values({
          companyId,
          source: 'reclame_aqui',
          rating: comp.rating,
          sentiment: comp.rating >= 4 ? 'positivo' : comp.rating === 3 ? 'neutro' : 'negativo',
          commentText: comp.commentText,
          authorLabel: comp.authorLabel,
          hasLgpdConsent: true,
          reviewedAt: comp.reviewedAt,
        });
        insertedComplaintsCount += 1;
      }

      const now = new Date();
      let profile;
      const updateFields = {
        reclameAquiUrl: capture.normalizedUrl,
        reclameAquiScore: capture.score,
        reclameAquiStatusLabel: capture.statusLabel,
        reclameAquiResponseRatePct: capture.responseRatePct,
        reclameAquiSolvedRatePct: capture.solvedRatePct,
        reclameAquiBackToBuyPct: capture.backToBuyPct,
        reclameAquiComplaintsTotal: capture.complaintsTotal,
        reclameAquiAnsweredTotal: capture.answeredTotal,
        reclameAquiCaptureStatus: capture.captureStatus,
        reclameAquiCaptureNote: capture.captureNote,
        reclameAquiLastSyncedAt: now,
        updatedAt: now,
      };

      if (existingProf) {
        const [updated] = await db
          .update(companyReputationProfiles)
          .set(updateFields)
          .where(eq(companyReputationProfiles.id, existingProf.id))
          .returning();
        profile = updated;
      } else {
        const [inserted] = await db
          .insert(companyReputationProfiles)
          .values({
            companyId,
            ...updateFields,
          })
          .returning();
        profile = inserted;
      }

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'CAPTURE_RECLAME_AQUI',
        entityType: 'company_reputation',
        entityId: companyId,
        details: { captureStatus: capture.captureStatus, insertedComplaintsCount },
      });

      res.json({ profile, insertedComplaintsCount, captureNote: capture.captureNote });
    } catch (error) {
      console.error('Reclame Aqui capture error:', error);
      res.status(500).json({ error: 'Erro ao processar link do Reclame Aqui.' });
    }
  });

  app.post('/api/beta/companies/:companyId/reviews/interpret', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const [list, [reputation]] = await Promise.all([
        db
          .select()
          .from(customerReviews)
          .where(eq(customerReviews.companyId, companyId))
          .orderBy(desc(customerReviews.createdAt)),
        db
          .select()
          .from(companyReputationProfiles)
          .where(eq(companyReputationProfiles.companyId, companyId)),
      ]);

      const result = await interpretCustomerReviews({
        companyName: access.company.name,
        reviews: list.slice(0, 50),
        reputationContext: reputation
          ? {
              googleRating: reputation.googleRating,
              googleRatingsTotal: reputation.googleRatingsTotal,
              reclameAquiScore: reputation.reclameAquiScore,
              reclameAquiStatusLabel: reputation.reclameAquiStatusLabel,
              reclameAquiResponseRatePct: reputation.reclameAquiResponseRatePct,
              reclameAquiSolvedRatePct: reputation.reclameAquiSolvedRatePct,
              reclameAquiBackToBuyPct: reputation.reclameAquiBackToBuyPct,
              reclameAquiComplaintsTotal: reputation.reclameAquiComplaintsTotal,
            }
          : undefined,
      });

      if (reputation) {
        await db
          .update(companyReputationProfiles)
          .set({
            aiDiagnosisJson: result as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(companyReputationProfiles.id, reputation.id));
      } else {
        await db.insert(companyReputationProfiles).values({
          companyId,
          aiDiagnosisJson: result as unknown as Record<string, unknown>,
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Review interpretation error:', error);
      res.status(500).json({ error: 'Erro ao interpretar avaliações com IA.' });
    }
  });

  // Strategic Items (PESTEL, Porter, SWOT, TOWS, Decisions, Action Plans, Opportunities)
  app.post('/api/beta/companies/:companyId/strategic', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as Record<string, unknown>;
      const [item] = await db
        .insert(strategicItems)
        .values({
          companyId,
          kind: String(b.kind || 'decision'),
          category: String(b.category || ''),
          title: String(b.title || '').trim(),
          description: String(b.description || ''),
          priority: String(b.priority || 'media'),
          status: String(b.status || 'aberto'),
          impactNote: String(b.impactNote || ''),
          dueDate: String(b.dueDate || ''),
          metadataJson: (b.metadataJson as Record<string, unknown>) || {},
        })
        .returning();

      res.status(201).json({ item });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar item estratégico.' });
    }
  });

  app.patch('/api/beta/companies/:companyId/strategic/:itemId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const itemId = Number(req.params.itemId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const [existing] = await db
        .select()
        .from(strategicItems)
        .where(and(eq(strategicItems.id, itemId), eq(strategicItems.companyId, companyId)));
      if (!existing) return res.status(404).json({ error: 'Item não encontrado.' });

      const mergedMeta =
        req.body.metadataJson && typeof req.body.metadataJson === 'object'
          ? {
              ...((existing.metadataJson as Record<string, unknown>) || {}),
              ...(req.body.metadataJson as Record<string, unknown>),
            }
          : existing.metadataJson;

      const nextStatus = req.body.status !== undefined ? String(req.body.status) : existing.status;
      if (
        existing.kind === 'action_plan' &&
        nextStatus === 'concluido' &&
        (mergedMeta as Record<string, unknown>)?.completionPct === undefined
      ) {
        (mergedMeta as Record<string, unknown>).completionPct = 100;
      }

      const [updated] = await db
        .update(strategicItems)
        .set({
          status: nextStatus,
          priority: req.body.priority !== undefined ? String(req.body.priority) : undefined,
          metadataJson: mergedMeta,
          updatedAt: new Date(),
        })
        .where(and(eq(strategicItems.id, itemId), eq(strategicItems.companyId, companyId)))
        .returning();

      let generatedActionsCount = 0;
      if (updated && updated.kind === 'decision' && updated.status === 'aprovada') {
        const allPlans = await db
          .select()
          .from(strategicItems)
          .where(and(eq(strategicItems.companyId, companyId), eq(strategicItems.kind, 'action_plan')));
        const alreadyLinked = allPlans.some(
          (p) => Number((p.metadataJson as Record<string, unknown>)?.decisionId) === updated.id
        );
        if (!alreadyLinked) {
          const meta = (updated.metadataJson || {}) as Record<string, unknown>;
          const tasks = await generateActionPlansForDecision({
            companyName: access.company.name,
            segment: access.company.segment,
            decisionTitle: updated.title,
            problem: String(meta.problem || updated.description || ''),
            suggestedAction: String(meta.suggestedAction || updated.description || updated.title),
            expectedOutcome: updated.impactNote || '',
            kpisToTrack: String(meta.kpisToTrack || ''),
          });
          for (const t of tasks) {
            await db.insert(strategicItems).values({
              companyId,
              kind: 'action_plan',
              category: updated.category || 'Execução',
              title: t.title,
              description: t.description,
              priority: t.priority || updated.priority || 'alta',
              status: 'a_fazer',
              impactNote: updated.impactNote,
              dueDate: t.dueDate || updated.dueDate || 'Em 15 dias',
              metadataJson: {
                decisionId: updated.id,
                decisionTitle: updated.title,
                owner: t.owner || `Equipe ${access.company.name}`,
                resources: t.resources || 'Equipe interna',
                kpi: t.kpi || String(meta.kpisToTrack || 'Impacto nas vendas e margem'),
                completionPct: 0,
                generatedByAi: true,
              },
            });
            generatedActionsCount += 1;
          }
        }
      }

      res.json({ item: updated, generatedActionsCount });
    } catch (error) {
      console.error('PATCH strategic error:', error);
      res.status(500).json({ error: 'Erro ao atualizar item.' });
    }
  });

  app.delete('/api/beta/companies/:companyId/strategic/:itemId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const itemId = Number(req.params.itemId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      await db
        .delete(strategicItems)
        .where(and(eq(strategicItems.id, itemId), eq(strategicItems.companyId, companyId)));
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao remover item.' });
    }
  });

  // Evidence Cards
  app.post('/api/beta/companies/:companyId/evidence', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as Record<string, unknown>;
      const [card] = await db
        .insert(evidenceCards)
        .values({
          companyId,
          moduleKey: String(b.moduleKey || 'geral'),
          title: String(b.title || 'Ficha de Evidência'),
          externalFinding: String(b.externalFinding || ''),
          internalDataUsed: String(b.internalDataUsed || ''),
          source: String(b.source || 'Dados da empresa + Fontes oficiais'),
          referenceDate: String(b.referenceDate || new Date().toISOString().slice(0, 10)),
          method: String(b.method || 'Cruzamento determinístico externo × interno'),
          scope: String(b.scope || access.company.segment || 'Empresa'),
          reliability: String(b.reliability || 'Media'),
          limitations: String(b.limitations || ''),
          verificationNeeded: String(b.verificationNeeded || ''),
          crossQualityScore: Number(b.crossQualityScore || 0),
          hasSufficientEvidence: Boolean(b.hasSufficientEvidence),
        })
        .returning();

      res.status(201).json({ card });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar ficha de evidência.' });
    }
  });

  // Automated AI Intelligence Generation (Radar, SWOT, PESTEL, Porter, TOWS, Analyses, Decisions, Verifications, Opportunities)
  app.post('/api/beta/companies/:companyId/intelligence/generate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const result = await runIntelligenceGenerationForCompany(
        access.company,
        req.dbUser!.id,
        req.dbUser!.email,
        req.body?.focus || 'all'
      );

      res.json(result);
    } catch (error) {
      console.error('Intelligence generation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao gerar inteligência automática com IA.',
      });
    }
  });

  // AI Macro Segment Interpretation Endpoint
  app.post('/api/beta/companies/:companyId/macro/interpret', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const macroBundle = await getOfficialMacroBundle(access.company.state);
      const interpretations = await interpretMacroForSegment({
        companyName: access.company.name,
        segment: access.company.segment,
        cityState: [access.company.city, access.company.state].filter(Boolean).join('/'),
        macroIndicators: macroBundle.indicators,
      });

      if (interpretations.length > 0) {
        await db
          .delete(strategicItems)
          .where(and(eq(strategicItems.companyId, companyId), eq(strategicItems.kind, 'macro_ai')));
        const todayStr = new Date().toLocaleDateString('pt-BR');
        for (const mi of interpretations) {
          await db.insert(strategicItems).values({
            companyId,
            kind: 'macro_ai',
            category: mi.indicatorCode || 'MACRO',
            title: mi.indicatorLabel || mi.indicatorCode,
            description: mi.plainExplanation || '',
            priority: 'media',
            status: 'aberto',
            impactNote: mi.businessEffect || '',
            dueDate: todayStr,
            metadataJson: {
              indicatorCode: mi.indicatorCode,
              practicalTip: mi.practicalTip || '',
              generatedByAi: true,
            },
          });
        }
      }

      res.json({ interpretations });
    } catch (error) {
      console.error('Macro interpret error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao interpretar cenário macroeconômico.',
      });
    }
  });

  // AI Action Plan Progress Reviewer Endpoint
  app.post('/api/beta/companies/:companyId/action-plans/review', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const allStrat = await db.select().from(strategicItems).where(eq(strategicItems.companyId, companyId));
      const plans = allStrat
        .filter((s) => s.kind === 'action_plan')
        .map((p) => {
          const meta = (p.metadataJson || {}) as Record<string, unknown>;
          return {
            title: p.title,
            status: p.status,
            priority: p.priority,
            dueDate: p.dueDate,
            owner: String(meta.owner || ''),
            completionPct: Number(meta.completionPct || (p.status === 'concluido' ? 100 : 0)),
            kpi: String(meta.kpi || ''),
          };
        });
      const pendingDecisionsCount = allStrat.filter(
        (s) => s.kind === 'decision' && (s.status === 'aberto' || s.status === 'pendente')
      ).length;

      const review = await reviewActionPlansProgress({
        companyName: access.company.name,
        segment: access.company.segment,
        actionPlans: plans,
        pendingDecisionsCount,
      });

      res.json(review);
    } catch (error) {
      console.error('Action plans review error:', error);
      res.status(500).json({ error: 'Erro ao revisar progresso dos planos de ação.' });
    }
  });

  // Simulations (save & compare 4 scenarios, marginal & contribution margin analysis)
  app.post('/api/beta/companies/:companyId/simulations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const [metricsList, productsList, macroBundle] = await Promise.all([
        db.select().from(internalMetrics).where(eq(internalMetrics.companyId, companyId)),
        db.select().from(products).where(eq(products.companyId, companyId)),
        getOfficialMacroBundle(access.company.state),
      ]);

      const hasSufficientData = metricsList.length > 0 && productsList.length > 0;
      const b = req.body as {
        name?: string;
        scenarioType?: string;
        horizonDays?: number;
        assumptions?: Record<string, number>;
      };
      const horizonDays = Number(b.horizonDays || 90);
      const assumptions = b.assumptions || {};

      const unitPriceReais = Number(assumptions.unitPriceReais ?? 120);
      const variableCostPerUnit = Number(assumptions.variableCostPerUnit ?? assumptions.marginalCostPerUnit ?? 55);
      const fixedCostsReais = Number(assumptions.fixedCostsReais ?? 6500);
      const currentProducedUnits = Number(assumptions.currentProducedUnits ?? 250);
      const estimatedDemandUnits = Number(assumptions.estimatedDemandUnits ?? 260);
      const extraEmployeesCount = Number(assumptions.extraEmployeesCount ?? 0);
      const employeeCostReais = Number(assumptions.employeeCostReais ?? 2600);
      const impostos = Number(assumptions.impostos ?? 18);
      const selic = Number(assumptions.selic ?? 13.75);
      const inflacao = Number(assumptions.inflacao ?? 4.6);
      const desemprego = Number(assumptions.desemprego ?? 6.5);
      const pibReal = Number(assumptions.pibReal ?? 2.0);
      const marginalCostPerUnit = Number(assumptions.marginalCostPerUnit ?? variableCostPerUnit);
      const marginalProductUnits = Number(assumptions.marginalProductUnits ?? 25);
      const targetProfitReais = Number(assumptions.targetProfitReais ?? 15000);
      const growthPct = Number(assumptions.crescimentoVendas ?? 0);
      const prodIncPct = Number(assumptions.productionIncreasePct ?? 0);

      const netUnitRevenue = unitPriceReais * (1 - impostos / 100);
      const contributionMarginPerUnit = Number((netUnitRevenue - variableCostPerUnit).toFixed(2));
      const months = horizonDays / 30;
      const monthlyFixedWithStaff = fixedCostsReais + extraEmployeesCount * employeeCostReais;
      const breakEvenUnits =
        contributionMarginPerUnit > 0
          ? Math.ceil(monthlyFixedWithStaff / contributionMarginPerUnit)
          : 0;

      const computeScenarioRow = (name: string, salesFactor: number, costInflFactor: number, prodCapFactor: number) => {
        const periodBaseUnits = Math.min(
          estimatedDemandUnits * salesFactor,
          currentProducedUnits * prodCapFactor
        ) * months;
        const revenueReais = Math.round(Math.max(0, periodBaseUnits * unitPriceReais));
        const taxCost = revenueReais * (impostos / 100);
        const variableTotal = periodBaseUnits * variableCostPerUnit * costInflFactor;
        const fixedTotal = monthlyFixedWithStaff * months * costInflFactor;
        const totalCostsReais = Math.round(taxCost + variableTotal + fixedTotal);
        const profitReais = Math.round(revenueReais - totalCostsReais);
        const marginPct = revenueReais > 0 ? Number(((profitReais / revenueReais) * 100).toFixed(1)) : 0;
        return { name, revenueReais, totalCostsReais, profitReais, marginPct };
      };

      const fourScenarios = [
        computeScenarioRow('Cenário atual', 1.0, 1.0, 1.0),
        computeScenarioRow('Cenário pessimista', 0.82, 1.08, 1.0),
        computeScenarioRow(
          'Cenário realista',
          Math.max(0.5, 1 + growthPct / 100),
          1 + (inflacao / 100) * 0.35,
          Math.max(0.5, 1 + prodIncPct / 100)
        ),
        computeScenarioRow(
          'Cenário otimista',
          Math.max(1.15, 1 + (growthPct + 14) / 100),
          0.97,
          Math.max(1.15, 1 + (prodIncPct + 12) / 100)
        ),
      ];

      let projections: Record<string, unknown> = {
        status: 'insufficient_data',
        message: 'A investigar — não tenho evidência suficiente para calcular com precisão sem métricas e produtos cadastrados.',
        contributionMarginPerUnit,
        breakEvenUnits,
        fourScenarios,
        successChancePct: null,
      };

      if (hasSufficientData) {
        const realistic = fourScenarios[2];
        const macroDrag =
          1 -
          (inflacao / 100) * 0.25 -
          Math.max(0, selic - 10) * 0.004 -
          Math.max(0, desemprego - 7) * 0.005 +
          (pibReal - 2) * 0.008;
        const marginalGainPerUnit = netUnitRevenue - marginalCostPerUnit;
        const projectedSales = Math.round(realistic.revenueReais * macroDrag);
        const projectedProfit = Math.round(realistic.profitReais * macroDrag);
        const totalStockUnits = productsList.reduce((acc, p) => acc + p.stockQty, 0);
        const ratio = targetProfitReais > 0 ? projectedProfit / targetProfitReais : 1;
        const successChancePct = Math.min(95, Math.max(8, Math.round(ratio * 70 - Math.max(0, selic - 11) * 1.4)));

        projections = {
          status: 'computed',
          projectedSalesReais: projectedSales,
          projectedMarginPct: realistic.marginPct,
          projectedProfitReais: projectedProfit,
          currentStockUnits: totalStockUnits,
          contributionMarginPerUnit,
          breakEvenUnits,
          marginalGainPerUnit: Number(marginalGainPerUnit.toFixed(2)),
          worthIncreasingProduction: marginalGainPerUnit > 0 && estimatedDemandUnits >= currentProducedUnits * 0.9,
          successChancePct,
          fourScenarios,
          macroSourcesCount: macroBundle.indicators.filter((m) => m.status === 'ok').length,
          uncertaintyBand: '±15% a ±25% (estimativa estatística sujeita a demanda, juros e inflação)',
        };
      }

      const [sim] = await db
        .insert(simulations)
        .values({
          companyId,
          name: String(b.name || `Simulação ${b.scenarioType || 'comparativa'} (${horizonDays}d)`),
          scenarioType: String(b.scenarioType || 'realista'),
          horizonDays,
          assumptionsJson: assumptions,
          projectionsJson: projections,
          uncertaintyNote:
            'Estimativa baseada nos parâmetros informados, base interna e indicadores BCB/IBGE/SEFAZ. Não representa garantia de retorno.',
          hasSufficientData,
        })
        .returning();

      res.status(201).json({ simulation: sim });
    } catch (error) {
      console.error('POST simulation error:', error);
      res.status(500).json({ error: 'Erro ao salvar simulação.' });
    }
  });

  app.post('/api/beta/companies/:companyId/simulator/advise', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Sem permissão.' });

      const macroBundle = await getOfficialMacroBundle(access.company.state);
      const result = await adviseScenarioGoal({
        companyName: access.company.name,
        segment: access.company.segment,
        hasSufficientData: Boolean(req.body.hasSufficientData),
        macroIndicators: macroBundle.indicators,
        assumptions: req.body.assumptions,
        computed: req.body.computed,
      });
      res.json(result);
    } catch (error) {
      console.error('Simulator advise error:', error);
      res.status(500).json({ error: 'Erro ao gerar recomendações para o cenário.' });
    }
  });

  // Subscription & Plan Config
  app.put('/api/beta/companies/:companyId/subscription', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || !['owner', 'admin'].includes(access.role)) {
        return res.status(403).json({ error: 'Apenas proprietário ou admin pode alterar o plano.' });
      }

      const b = req.body as Record<string, unknown>;
      const planCode = (['basico', 'profissional', 'empresarial'].includes(String(b.planCode))
        ? String(b.planCode)
        : 'profissional') as PlanCode;
      const billingCycle = b.billingCycle === 'annual' ? 'annual' : 'monthly';

      const [updated] = await db
        .update(subscriptions)
        .set({
          planCode,
          billingCycle,
          status: 'demo_contracted',
          extraCompetitors: Math.max(0, Number(b.extraCompetitors || 0)),
          extraUnits: Math.max(0, Number(b.extraUnits || 0)),
          extraWhatsappPacks: Math.max(0, Number(b.extraWhatsappPacks || 0)),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.companyId, companyId))
        .returning();

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'UPDATE_SUBSCRIPTION',
        entityType: 'subscription',
        entityId: updated.id,
        details: { planCode, billingCycle },
      });

      res.json({ subscription: updated });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar plano.' });
    }
  });

  // Team Members (RBAC)
  app.post('/api/beta/companies/:companyId/members', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || !['owner', 'admin'].includes(access.role)) {
        return res.status(403).json({ error: 'Sem permissão para gerenciar equipe.' });
      }
      const email = String(req.body.email || '').trim().toLowerCase();
      const role = String(req.body.role || 'viewer');
      if (!email) return res.status(400).json({ error: 'E-mail é obrigatório.' });

      const [member] = await db
        .insert(companyMembers)
        .values({
          companyId,
          email,
          role: ['admin', 'editor', 'viewer'].includes(role) ? role : 'viewer',
          status: 'invited',
        })
        .returning();

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'INVITE_MEMBER',
        entityType: 'company_member',
        entityId: member.id,
        details: { email, role },
      });

      res.status(201).json({ member });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao convidar membro.' });
    }
  });

  // LGPD & Export / Deletion Requests
  app.post('/api/beta/companies/:companyId/lgpd', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Sem permissão.' });

      const recordType = String(req.body.recordType || 'consent');
      const [rec] = await db
        .insert(lgpdRecords)
        .values({
          companyId,
          userId: req.dbUser!.id,
          recordType,
          status: recordType === 'consent' ? 'active' : 'requested',
          scope: String(req.body.scope || 'Dados corporativos'),
          notes: String(req.body.notes || ''),
        })
        .returning();

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: `LGPD_${recordType.toUpperCase()}`,
        entityType: 'lgpd_record',
        entityId: rec.id,
      });

      res.status(201).json({ record: rec });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao registrar solicitação LGPD.' });
    }
  });

  // Authenticated Company Owner Verified Backup Export
  app.get('/api/beta/companies/:companyId/backup/export', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || !['owner', 'admin'].includes(access.role)) {
        return res.status(403).json({ error: 'Apenas proprietário ou administrador pode gerar backup verificado.' });
      }
      const result = await exportCompanyVerifiedBackup(companyId);
      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'EXPORT_VERIFIED_BACKUP',
        entityType: 'backup_snapshot',
        entityId: companyId,
        details: { integritySha256: result.integritySha256 },
      });
      res.setHeader('X-Backup-SHA256', result.integritySha256);
      res.json(result);
    } catch (error) {
      console.error('Company backup export error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao gerar backup verificado da empresa.' });
    }
  });

  // Gêmeo Digital AI Status, Quota & Monitoring Endpoint
  app.get('/api/beta/companies/:companyId/ai/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId));
      const planCode = (sub?.planCode || 'profissional') as PlanCode;
      const status = await getCompanyAiStatus(companyId, planCode);
      res.json({
        ...status,
        userRole: access.role,
        canAuthorizeActions: access.role !== 'viewer',
      });
    } catch (error) {
      console.error('AI status error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao consultar monitoramento do Gêmeo Digital AI.' });
    }
  });

  // Gêmeo Digital AI Executive Report & Multi-Sector Diagnostic
  app.post('/api/beta/companies/:companyId/ai/report', requireAuth, aiHeavyLimiter, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId));
      const planCode = (sub?.planCode || 'profissional') as PlanCode;

      const report = await generateExecutiveAiReport({
        company: access.company,
        userId: req.dbUser!.id,
        planCode,
      });

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'AI_EXECUTIVE_REPORT_GENERATED',
        entityType: 'company',
        entityId: companyId,
        details: { companyName: access.company.name },
      });

      res.json({ report });
    } catch (error: unknown) {
      console.error('AI executive report error:', error instanceof Error ? error.message : 'error');
      const friendly = formatFriendlyAiError(
        error,
        'Não foi possível gerar o diagnóstico executivo agora. O restante da plataforma continua operando normalmente.'
      );
      res.status(friendly.status).json({ error: friendly.message, code: friendly.code, degraded: friendly.status >= 500 || friendly.status === 429 });
    }
  });

  // Gêmeo Digital AI User-Authorized Internal Action Execution
  app.post('/api/beta/companies/:companyId/ai/actions/:proposalToken/approve', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const outcome = await resolveAiActionProposal({
        proposalToken: String(req.params.proposalToken || ''),
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        userRole: access.role,
        action: 'approve',
      });
      res.status(outcome.statusCode).json(outcome);
    } catch (error) {
      console.error('AI action approve error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao autorizar e executar a ação sugerida pela IA.' });
    }
  });

  app.post('/api/beta/companies/:companyId/ai/actions/:proposalToken/reject', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const outcome = await resolveAiActionProposal({
        proposalToken: String(req.params.proposalToken || ''),
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        userRole: access.role,
        action: 'reject',
      });
      res.status(outcome.statusCode).json(outcome);
    } catch (error) {
      console.error('AI action reject error:', error instanceof Error ? error.message : 'error');
      res.status(500).json({ error: 'Erro ao cancelar a proposta sugerida pela IA.' });
    }
  });

  // Contextual Gêmeo Digital AI Assistant Endpoint (supports multimodal docs/spreadsheets + function calling)
  app.post('/api/beta/companies/:companyId/assistant', requireAuth, aiHeavyLimiter, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const { question, screenContext, history, attachment } = req.body as {
        question?: string;
        screenContext?: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        attachment?: GemeoChatAttachmentInput | null;
      };
      const cleanQuestion = sanitizePlainText(question, 3000);
      if (!cleanQuestion && !attachment?.base64Data) {
        return res.status(400).json({ error: 'Pergunta ou arquivo anexo é obrigatório.' });
      }

      const [dirSummary, [sub]] = await Promise.all([
        buildUserCompaniesAndDistanceSummary(req.dbUser!.id, companyId),
        db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId)),
      ]);
      const planCode = (sub?.planCode || 'profissional') as PlanCode;

      const result = await runGemeoDigitalAiChat({
        company: access.company,
        userId: req.dbUser!.id,
        userRole: access.role,
        planCode,
        question: cleanQuestion || 'Analise o documento/planilha anexado considerando os dados reais da empresa.',
        screenContext: sanitizePlainText(screenContext, 160) || 'Gêmeo Digital AI',
        history: Array.isArray(history) ? history.slice(-30) : [],
        companiesDirectoryText: dirSummary.companiesDirectoryText,
        distanceQueriesSummary: dirSummary.distanceQueriesSummary,
        userLatLng: dirSummary.activeLatLng,
        attachment: attachment || null,
        moduleName: 'gemeo_ai_panel',
      });

      res.json(result);
    } catch (error: unknown) {
      console.error('Assistant error:', error instanceof Error ? error.message : 'error');
      const friendly = formatFriendlyAiError(
        error,
        'Não foi possível consultar o Gêmeo Digital AI no momento. O restante do painel continua operando normalmente.'
      );
      res.status(friendly.status).json({ error: friendly.message, code: friendly.code, degraded: friendly.status >= 500 || friendly.status === 429 });
    }
  });

  // Global Authenticated Gemini Chatbot (delegates to Gêmeo Digital AI when an active company is selected)
  app.post('/api/chat', requireAuth, aiHeavyLimiter, async (req: AuthRequest, res) => {
    try {
      const { question, screenContext, history, companyId, attachment } = req.body as {
        question?: string;
        screenContext?: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        companyId?: number | null;
        attachment?: GemeoChatAttachmentInput | null;
      };
      const cleanQuestion = sanitizePlainText(question, 3000);
      if (!cleanQuestion && !attachment?.base64Data) {
        return res.status(400).json({ error: 'Pergunta é obrigatória.' });
      }

      const dbUserId = req.dbUser!.id;
      const requestedCompanyId = Number(companyId);
      let activeAccess = null;
      if (Number.isInteger(requestedCompanyId) && requestedCompanyId > 0) {
        activeAccess = await getUserCompanyAccess(dbUserId, requestedCompanyId);
      }

      const dirSummary = await buildUserCompaniesAndDistanceSummary(
        dbUserId,
        activeAccess ? activeAccess.company.id : undefined
      );

      if (activeAccess) {
        const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, activeAccess.company.id));
        const planCode = (sub?.planCode || 'profissional') as PlanCode;
        const result = await runGemeoDigitalAiChat({
          company: activeAccess.company,
          userId: dbUserId,
          userRole: activeAccess.role,
          planCode,
          question: cleanQuestion || 'Analise o documento/planilha anexado.',
          screenContext: sanitizePlainText(screenContext, 160) || 'Chatbot Global Gêmeo Digital',
          history: Array.isArray(history) ? history.slice(-30) : [],
          companiesDirectoryText: dirSummary.companiesDirectoryText,
          distanceQueriesSummary: dirSummary.distanceQueriesSummary,
          userLatLng: dirSummary.activeLatLng,
          attachment: attachment || null,
          moduleName: 'global_chatbot',
        });
        return res.json(result);
      }

      const result = await askGroundedChatbot({
        question: cleanQuestion,
        screenContext: sanitizePlainText(screenContext, 160) || 'Plataforma Gêmeo Digital',
        history: Array.isArray(history) ? history : [],
        isAuthenticated: true,
        companiesDirectoryText: dirSummary.companiesDirectoryText,
        distanceQueriesSummary: dirSummary.distanceQueriesSummary,
        activeCompanySnapshot: null,
        userLatLng: dirSummary.activeLatLng,
      });

      res.json(result);
    } catch (error: unknown) {
      console.error('Global chat error:', error instanceof Error ? error.message : 'error');
      const friendly = formatFriendlyAiError(
        error,
        'Não foi possível consultar o chatbot no momento. Tente novamente em instantes.'
      );
      res.status(friendly.status).json({ error: friendly.message, code: friendly.code, degraded: friendly.status >= 500 || friendly.status === 429 });
    }
  });

  // =========================================================================
  // GEOGRAPHIC, MARKET & COMPETITIVE INTELLIGENCE ROUTES (BETA MULTI-TENANT)
  // =========================================================================
  const logGeoUsage = async (companyId: number, evt: ApiUsageEvent) => {
    try {
      await db.insert(geoApiUsageLogs).values({
        companyId,
        provider: evt.provider,
        endpoint: evt.endpoint,
        cacheHit: evt.cacheHit,
        statusCode: evt.statusCode,
      });
    } catch {
      // ignore non-critical usage log error
    }
  };

  app.get('/api/beta/geo/config', requireAuth, async (_req: AuthRequest, res) => {
    const key = getMapsApiKey();
    res.json({
      mapsEnabled: Boolean(key),
      browserApiKey: key,
      attributionId: GMP_SOLUTION_ID,
    });
  });

  app.get('/api/beta/companies/:companyId/geo/overview', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const [units, entities, logs, usage, accessibleCompanies] = await Promise.all([
        db.select().from(companyUnits).where(eq(companyUnits.companyId, companyId)),
        db
          .select()
          .from(geoSavedEntities)
          .where(eq(geoSavedEntities.companyId, companyId))
          .orderBy(desc(geoSavedEntities.lastUpdatedAt)),
        db
          .select()
          .from(geoSearchLogs)
          .where(eq(geoSearchLogs.companyId, companyId))
          .orderBy(desc(geoSearchLogs.createdAt))
          .limit(30),
        db
          .select()
          .from(geoApiUsageLogs)
          .where(eq(geoApiUsageLogs.companyId, companyId))
          .orderBy(desc(geoApiUsageLogs.createdAt))
          .limit(100),
        getUserAccessibleCompanies(req.dbUser!.id),
      ]);

      res.json({
        companyLocation: {
          address: access.company.address,
          city: access.company.city,
          state: access.company.state,
          latitude: access.company.latitude,
          longitude: access.company.longitude,
          placeId: access.company.placeId,
        },
        userCompanies: accessibleCompanies.map((c) => ({
          id: c.id,
          name: c.name,
          segment: c.segment,
          address: c.address,
          city: c.city,
          state: c.state,
          latitude: c.latitude,
          longitude: c.longitude,
          placeId: c.placeId,
          isCurrent: c.id === companyId,
        })),
        units,
        entities,
        searchLogs: logs,
        usageSummary: {
          totalCalls: usage.length,
          cacheHits: usage.filter((u) => u.cacheHit).length,
          byProvider: usage.reduce<Record<string, number>>((acc, u) => {
            acc[u.provider] = (acc[u.provider] || 0) + 1;
            return acc;
          }, {}),
        },
      });
    } catch (error) {
      console.error('Geo overview error:', error);
      res.status(500).json({ error: 'Erro ao carregar módulo geográfico.' });
    }
  });

  // Cloud SQL Company-to-Company & Radius X km Distance Query
  app.post('/api/beta/companies/:companyId/geo/companies-distance', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      assertCompanyGeoRateLimit(companyId);

      const {
        originCompanyId,
        targetCompanyId,
        radiusKm = 10,
        travelMode = 'DRIVE',
        geocodeMissing = true,
      } = req.body as {
        originCompanyId?: number;
        targetCompanyId?: number | null;
        radiusKm?: number;
        travelMode?: 'DRIVE' | 'WALK' | 'TWO_WHEELER';
        geocodeMissing?: boolean;
      };

      const safeRadiusKm = Math.min(500, Math.max(0.5, Number(radiusKm || 10)));
      const accessibleCompanies = await getUserAccessibleCompanies(req.dbUser!.id);

      // Auto-geocode user's companies if coordinates are missing in Cloud SQL
      const resolvedCompanies = await Promise.all(
        accessibleCompanies.map(async (c) => {
          let lat = Number(c.latitude);
          let lng = Number(c.longitude);
          let formattedAddress = [c.address, c.city, c.state].filter(Boolean).join(', ');
          const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

          if (!hasCoords && geocodeMissing && formattedAddress) {
            try {
              const geo = await geocodeAddressServer(`${formattedAddress}, Brasil`, (evt) => {
                void logGeoUsage(companyId, evt);
              });
              if (geo.found && geo.lat !== null && geo.lng !== null) {
                lat = geo.lat;
                lng = geo.lng;
                formattedAddress = geo.formattedAddress || formattedAddress;
                await db
                  .update(companies)
                  .set({
                    latitude: String(lat),
                    longitude: String(lng),
                    placeId: geo.placeId || c.placeId,
                    updatedAt: new Date(),
                  })
                  .where(eq(companies.id, c.id));
              }
            } catch (err) {
              if (err instanceof MapsQuotaExceededError) throw err;
            }
          }

          return {
            id: c.id,
            name: c.name,
            segment: c.segment,
            address: c.address,
            city: c.city,
            state: c.state,
            formattedAddress,
            lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
            lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
          };
        })
      );

      const originComp =
        resolvedCompanies.find((c) => c.id === Number(originCompanyId || companyId)) ||
        resolvedCompanies.find((c) => c.id === companyId);

      if (!originComp || originComp.lat === null || originComp.lng === null) {
        return res.status(400).json({
          error:
            'A empresa de origem ainda não possui coordenadas geocodificadas. Preencha endereço/cidade em Dados da Empresa ou geocodifique no mapa primeiro.',
        });
      }

      const savedEntities = await db
        .select()
        .from(geoSavedEntities)
        .where(eq(geoSavedEntities.companyId, companyId));

      type DistanceCandidate = {
        key: string;
        kind: 'user_company' | 'saved_entity';
        entityKind: string;
        id: number;
        name: string;
        segmentOrCategory: string;
        address: string;
        lat: number;
        lng: number;
        linearDistanceKm: number;
        routeDistanceKm: number | null;
        durationText: string;
        withinRadius: boolean;
      };

      const candidatesRaw: Array<Omit<DistanceCandidate, 'routeDistanceKm' | 'durationText'>> = [];

      for (const comp of resolvedCompanies) {
        if (comp.id === originComp.id || comp.lat === null || comp.lng === null) continue;
        const linearKm = haversineDistanceKm(originComp.lat, originComp.lng, comp.lat, comp.lng);
        candidatesRaw.push({
          key: `company-${comp.id}`,
          kind: 'user_company',
          entityKind: 'company',
          id: comp.id,
          name: comp.name,
          segmentOrCategory: comp.segment || 'Sua Empresa',
          address: comp.formattedAddress || `${comp.city}/${comp.state}`,
          lat: comp.lat,
          lng: comp.lng,
          linearDistanceKm: linearKm,
          withinRadius: linearKm <= safeRadiusKm,
        });
      }

      for (const ent of savedEntities) {
        const lat = Number(ent.latitude);
        const lng = Number(ent.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) continue;
        const linearKm = haversineDistanceKm(originComp.lat, originComp.lng, lat, lng);
        candidatesRaw.push({
          key: `entity-${ent.id}`,
          kind: 'saved_entity',
          entityKind: ent.entityKind,
          id: ent.id,
          name: ent.name,
          segmentOrCategory: ent.category || ent.entityKind,
          address: ent.address || `${ent.city}/${ent.state}`,
          lat,
          lng,
          linearDistanceKm: linearKm,
          withinRadius: linearKm <= safeRadiusKm,
        });
      }

      // Compute road route distance & time for top 25 targets via Google Routes API v2
      const routeTargets = candidatesRaw.slice(0, 25).map((c) => ({
        id: c.key,
        lat: c.lat,
        lng: c.lng,
      }));
      const routeResults =
        routeTargets.length > 0
          ? await computeRouteMatrixServer(
              {
                originLat: originComp.lat,
                originLng: originComp.lng,
                destinations: routeTargets,
                travelMode,
              },
              (evt) => {
                void logGeoUsage(companyId, evt);
              }
            )
          : [];
      const routeMap = new Map(routeResults.map((r) => [r.id, r]));

      const allDistances: DistanceCandidate[] = candidatesRaw
        .map((c) => {
          const r = routeMap.get(c.key);
          const effectiveKm = r?.distanceKm ?? c.linearDistanceKm;
          return {
            ...c,
            routeDistanceKm: r ? r.distanceKm : null,
            durationText: r?.durationText || `${c.linearDistanceKm} km (linha reta)`,
            withinRadius: c.linearDistanceKm <= safeRadiusKm || effectiveKm <= safeRadiusKm,
          };
        })
        .sort((a, b) => a.linearDistanceKm - b.linearDistanceKm);

      const withinRadiusList = allDistances.filter((d) => d.withinRadius);
      const selectedPair =
        targetCompanyId && Number(targetCompanyId) !== originComp.id
          ? allDistances.find((d) => d.kind === 'user_company' && d.id === Number(targetCompanyId)) ||
            null
          : null;

      const summaryMsg = selectedPair
        ? `Distância entre ${originComp.name} e ${selectedPair.name}: ${
            selectedPair.routeDistanceKm ?? selectedPair.linearDistanceKm
          } km (${selectedPair.durationText}). ${withinRadiusList.length} empresa(s)/local(is) no raio de ${safeRadiusKm} km.`
        : `${withinRadiusList.length} empresa(s)/local(is) dentro do raio de ${safeRadiusKm} km a partir de ${originComp.name}.`;

      // Persist distance & radius query in Cloud SQL geo_search_logs
      await db.insert(geoSearchLogs).values({
        companyId,
        userId: req.dbUser!.id,
        searchType: 'companies_distance_radius',
        query: selectedPair
          ? `Distância ${originComp.name} -> ${selectedPair.name} (raio ${safeRadiusKm} km)`
          : `Filtro raio ${safeRadiusKm} km a partir de ${originComp.name}`,
        centerAddress: originComp.formattedAddress,
        centerLat: String(originComp.lat),
        centerLng: String(originComp.lng),
        radiusKm: Math.round(safeRadiusKm),
        resultsCount: withinRadiusList.length,
        filtersJson: {
          originCompanyId: originComp.id,
          targetCompanyId: targetCompanyId || null,
          radiusKm: safeRadiusKm,
          travelMode,
        },
        snapshotJson: allDistances.slice(0, 15).map((d) => ({
          name: d.name,
          kind: d.kind,
          linearDistanceKm: d.linearDistanceKm,
          routeDistanceKm: d.routeDistanceKm,
          durationText: d.durationText,
          withinRadius: d.withinRadius,
        })),
        alertsSummary: summaryMsg,
      });

      res.json({
        originCompany: originComp,
        radiusKm: safeRadiusKm,
        travelMode,
        selectedPair,
        withinRadiusCount: withinRadiusList.length,
        withinRadius: withinRadiusList,
        allCompaniesAndEntities: allDistances,
        userCompanies: resolvedCompanies,
        summary: summaryMsg,
        consultedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof MapsQuotaExceededError) {
        return res.status(429).json({ error: error.message, quotaExceeded: true });
      }
      console.error('Companies distance query error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao calcular distância e raio entre empresas.',
      });
    }
  });

  app.post('/api/beta/companies/:companyId/geo/geocode', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      assertCompanyGeoRateLimit(companyId);

      const { address, saveToCompany, unitId } = req.body as {
        address?: string;
        saveToCompany?: boolean;
        unitId?: number;
      };

      const targetQuery =
        (address || '').trim() ||
        [access.company.address, access.company.city, access.company.state, 'Brasil']
          .filter(Boolean)
          .join(', ');

      const result = await geocodeAddressServer(targetQuery, (evt) => {
        void logGeoUsage(companyId, evt);
      });

      if (result.found && result.lat !== null && result.lng !== null) {
        if (unitId && ['owner', 'admin', 'editor'].includes(access.role)) {
          await db
            .update(companyUnits)
            .set({
              latitude: String(result.lat),
              longitude: String(result.lng),
              placeId: result.placeId || '',
            })
            .where(and(eq(companyUnits.id, Number(unitId)), eq(companyUnits.companyId, companyId)));
        } else if (saveToCompany && ['owner', 'admin', 'editor'].includes(access.role)) {
          await db
            .update(companies)
            .set({
              latitude: String(result.lat),
              longitude: String(result.lng),
              placeId: result.placeId || '',
              updatedAt: new Date(),
            })
            .where(eq(companies.id, companyId));
        }
      }

      res.json(result);
    } catch (error) {
      if (error instanceof MapsQuotaExceededError) {
        return res.status(429).json({ error: error.message, quotaExceeded: true });
      }
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao geocodificar localização.',
      });
    }
  });

  app.post('/api/beta/companies/:companyId/geo/search-places', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      assertCompanyGeoRateLimit(companyId);

      const {
        searchType = 'competitors',
        textQuery,
        includedTypes,
        centerAddress,
        centerLat,
        centerLng,
        radiusKm = 5,
        includeRoutes = true,
      } = req.body as {
        searchType?: 'competitors' | 'suppliers' | 'expansion' | 'monitor_refresh';
        textQuery?: string;
        includedTypes?: string[];
        centerAddress?: string;
        centerLat?: number;
        centerLng?: number;
        radiusKm?: number;
        includeRoutes?: boolean;
      };

      let resolvedLat = typeof centerLat === 'number' && Number.isFinite(centerLat) ? centerLat : null;
      let resolvedLng = typeof centerLng === 'number' && Number.isFinite(centerLng) ? centerLng : null;
      let resolvedAddress = (centerAddress || '').trim();

      if ((resolvedLat === null || resolvedLng === null) && resolvedAddress) {
        const geo = await geocodeAddressServer(resolvedAddress, (evt) => {
          void logGeoUsage(companyId, evt);
        });
        if (geo.found && geo.lat !== null && geo.lng !== null) {
          resolvedLat = geo.lat;
          resolvedLng = geo.lng;
          resolvedAddress = geo.formattedAddress;
        }
      }

      if (resolvedLat === null || resolvedLng === null) {
        const companyFallback = [access.company.address, access.company.city, access.company.state]
          .filter(Boolean)
          .join(', ');
        if (access.company.latitude && access.company.longitude) {
          resolvedLat = Number(access.company.latitude);
          resolvedLng = Number(access.company.longitude);
          resolvedAddress = resolvedAddress || companyFallback;
        } else if (companyFallback) {
          const geo = await geocodeAddressServer(companyFallback, (evt) => {
            void logGeoUsage(companyId, evt);
          });
          if (geo.found && geo.lat !== null && geo.lng !== null) {
            resolvedLat = geo.lat;
            resolvedLng = geo.lng;
            resolvedAddress = geo.formattedAddress;
            await db
              .update(companies)
              .set({
                latitude: String(geo.lat),
                longitude: String(geo.lng),
                placeId: geo.placeId || '',
                updatedAt: new Date(),
              })
              .where(eq(companies.id, companyId));
          }
        }
      }

      if (resolvedLat === null || resolvedLng === null) {
        return res.status(400).json({
          error:
            'Coordenadas de centro não localizadas. Informe um endereço/cidade válido ou cadastre a localização da empresa.',
        });
      }

      const defaultQuery =
        searchType === 'suppliers'
          ? `${textQuery || 'fornecedor distribuidor atacado'} ${access.company.segment || ''}`.trim()
          : (textQuery || access.company.segment || access.company.name).trim();

      const searchResult = await searchPlacesServer(
        {
          textQuery: includedTypes?.length && !textQuery ? undefined : defaultQuery,
          includedTypes,
          centerLat: resolvedLat,
          centerLng: resolvedLng,
          radiusKm: Number(radiusKm || 5),
          maxResults: 20,
        },
        (evt) => {
          void logGeoUsage(companyId, evt);
        }
      );

      let places = searchResult.places;
      if (includeRoutes && places.length > 0) {
        const matrix = await computeRouteMatrixServer(
          {
            originLat: resolvedLat,
            originLng: resolvedLng,
            destinations: places.slice(0, 15).map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng })),
            travelMode: 'DRIVE',
          },
          (evt) => {
            void logGeoUsage(companyId, evt);
          }
        );
        const byId = new Map(matrix.map((m) => [m.id, m]));
        places = places.map((p) => {
          const route = byId.get(p.placeId);
          return route
            ? {
                ...p,
                travelDistanceKm: route.distanceKm,
                travelTimeText: route.durationText,
              }
            : p;
        });
      }

      // Compare against previous snapshot for change alerts
      const previousLogs = await db
        .select()
        .from(geoSearchLogs)
        .where(and(eq(geoSearchLogs.companyId, companyId), eq(geoSearchLogs.searchType, searchType)))
        .orderBy(desc(geoSearchLogs.createdAt))
        .limit(1);

      let alertsSummary = '';
      if (previousLogs.length > 0 && Array.isArray(previousLogs[0].snapshotJson)) {
        const prevSnap = previousLogs[0].snapshotJson as Array<{ placeId?: string; name?: string; rating?: number | null }>;
        const prevIds = new Set(prevSnap.map((x) => x.placeId).filter(Boolean));
        const currIds = new Set(places.map((p) => p.placeId).filter(Boolean));
        const newlyDetected = places.filter((p) => p.placeId && !prevIds.has(p.placeId));
        const noLongerInTop = prevSnap.filter((p) => p.placeId && !currIds.has(p.placeId));
        const parts: string[] = [];
        if (newlyDetected.length > 0) {
          parts.push(
            `${newlyDetected.length} novo(s) estabelecimento(s) detectado(s): ${newlyDetected
              .slice(0, 3)
              .map((n) => n.name)
              .join(', ')}`
          );
        }
        if (noLongerInTop.length > 0) {
          parts.push(`${noLongerInTop.length} item(ns) ausente(s) nesta varredura em comparação à anterior`);
        }
        alertsSummary = parts.join(' | ') || 'Sem variações relevantes frente à última consulta.';
      } else {
        alertsSummary = `Linha de base registrada com ${places.length} estabelecimento(s).`;
      }

      const [savedLog] = await db
        .insert(geoSearchLogs)
        .values({
          companyId,
          userId: req.dbUser!.id,
          searchType,
          query: defaultQuery,
          centerAddress: resolvedAddress || `${resolvedLat.toFixed(4)}, ${resolvedLng.toFixed(4)}`,
          centerLat: String(resolvedLat),
          centerLng: String(resolvedLng),
          radiusKm: Math.round(Number(radiusKm || 5)),
          resultsCount: places.length,
          filtersJson: { includedTypes: includedTypes || [] },
          snapshotJson: places.slice(0, 20).map((p) => ({
            placeId: p.placeId,
            name: p.name,
            rating: p.rating,
            userRatingCount: p.userRatingCount,
            distanceKm: p.distanceKm,
            businessStatus: p.businessStatus,
          })),
          alertsSummary,
        })
        .returning();

      res.json({
        center: {
          lat: resolvedLat,
          lng: resolvedLng,
          address: resolvedAddress,
        },
        radiusKm: Number(radiusKm || 5),
        places,
        source: searchResult.source,
        consultedAt: searchResult.consultedAt,
        cacheHit: searchResult.cacheHit,
        radiusLimitedNote: searchResult.radiusLimitedNote,
        alertsSummary,
        searchLog: savedLog,
      });
    } catch (error) {
      if (error instanceof MapsQuotaExceededError) {
        return res.status(429).json({ error: error.message, quotaExceeded: true });
      }
      console.error('Geo search places error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao buscar estabelecimentos no mapa.',
      });
    }
  });

  app.post('/api/beta/companies/:companyId/geo/place-details', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const placeId = String(req.body.placeId || '').trim();
      if (!placeId) return res.status(400).json({ error: 'placeId é obrigatório.' });

      const details = await getPlaceDetailsServer(placeId, (evt) => {
        void logGeoUsage(companyId, evt);
      });
      res.json({ details });
    } catch (error) {
      if (error instanceof MapsQuotaExceededError) {
        return res.status(429).json({ error: error.message, quotaExceeded: true });
      }
      res.status(500).json({ error: 'Erro ao carregar detalhes do local.' });
    }
  });

  app.post('/api/beta/companies/:companyId/geo/route-matrix', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const { originLat, originLng, destinations, travelMode } = req.body as {
        originLat: number;
        originLng: number;
        destinations: Array<{ id: string; lat: number; lng: number }>;
        travelMode?: 'DRIVE' | 'WALK' | 'TWO_WHEELER';
      };

      const routes = await computeRouteMatrixServer(
        {
          originLat: Number(originLat),
          originLng: Number(originLng),
          destinations: Array.isArray(destinations) ? destinations : [],
          travelMode,
        },
        (evt) => {
          void logGeoUsage(companyId, evt);
        }
      );
      res.json({ routes });
    } catch (error) {
      if (error instanceof MapsQuotaExceededError) {
        return res.status(429).json({ error: error.message, quotaExceeded: true });
      }
      res.status(500).json({ error: 'Erro ao calcular matriz de rotas.' });
    }
  });

  app.post('/api/beta/companies/:companyId/geo/competitor-intelligence', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const { radiusKm = 5, places = [] } = req.body as {
        radiusKm?: number;
        places?: Array<{
          placeId: string;
          name: string;
          address: string;
          distanceKm: number;
          travelTimeText?: string;
          primaryTypeLabel: string;
          rating: number | null;
          userRatingCount: number;
          priceLevel: string;
          website: string;
          businessStatus: string;
        }>;
      };

      const prods = await db.select().from(products).where(eq(products.companyId, companyId));
      const analysis = await analyzeCompetitiveLandscapeGeo({
        company: {
          name: access.company.name,
          segment: access.company.segment,
          cnae: access.company.cnae,
          cityState: [access.company.city, access.company.state].filter(Boolean).join('/'),
          operationType: access.company.operationType,
          productsSummary: prods
            .slice(0, 8)
            .map((p) => `${p.name} (R$ ${(p.priceCents / 100).toFixed(2)})`)
            .join(', '),
        },
        radiusKm: Number(radiusKm || 5),
        places: Array.isArray(places) ? places.slice(0, 20) : [],
      });

      res.json({ analysis, consultedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Geo competitor AI error:', error);
      res.status(500).json({ error: 'Erro ao gerar análise competitiva geográfica.' });
    }
  });

  app.post('/api/beta/companies/:companyId/geo/territorial-analysis', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      assertCompanyGeoRateLimit(companyId);

      const { lat, lng, radiusKm = 5, stateUf } = req.body as {
        lat: number;
        lng: number;
        radiusKm?: number;
        stateUf?: string;
      };
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
        return res.status(400).json({ error: 'Latitude e longitude válidas são obrigatórias.' });
      }

      const territorial = await analyzeTerritorialEnvironment(
        {
          lat: Number(lat),
          lng: Number(lng),
          radiusKm: Number(radiusKm || 5),
          stateUf: stateUf || access.company.state,
        },
        (evt) => {
          void logGeoUsage(companyId, evt);
        }
      );

      await db.insert(geoSearchLogs).values({
        companyId,
        userId: req.dbUser!.id,
        searchType: 'territorial',
        query: 'Auditoria Territorial, Logística e Climática',
        centerAddress: `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
        centerLat: String(lat),
        centerLng: String(lng),
        radiusKm: Math.round(Number(radiusKm || 5)),
        resultsCount:
          territorial.osmInfrastructure.industrialZonesCount +
          territorial.osmInfrastructure.commercialZonesCount +
          territorial.osmInfrastructure.highwaysCount,
        alertsSummary: territorial.inmetAlerts[0]?.description || territorial.floodRisk.summary,
      });

      res.json(territorial);
    } catch (error) {
      console.error('Territorial analysis error:', error);
      res.status(500).json({ error: 'Erro ao consultar dados territoriais e ambientais.' });
    }
  });

  app.post('/api/beta/companies/:companyId/geo/market-expansion', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      assertCompanyGeoRateLimit(companyId);

      const { localities, radiusKm = 10, segmentQuery } = req.body as {
        localities: Array<{ city: string; state?: string; label?: string }>;
        radiusKm?: number;
        segmentQuery?: string;
      };

      const targets = (Array.isArray(localities) ? localities : [])
        .filter((l) => l && String(l.city || '').trim())
        .slice(0, 3);

      if (targets.length === 0) {
        return res.status(400).json({ error: 'Informe ao menos uma cidade/localidade para análise.' });
      }

      const queryStr = (segmentQuery || access.company.segment || access.company.name).trim();

      const localityBundles = await Promise.all(
        targets.map(async (loc) => {
          const label = loc.label?.trim() || [loc.city, loc.state].filter(Boolean).join('/');
          const geo = await geocodeAddressServer(
            [loc.city, loc.state, 'Brasil'].filter(Boolean).join(', '),
            (evt) => {
              void logGeoUsage(companyId, evt);
            }
          );

          const cityResolved = geo.city || loc.city;
          const ufResolved = (loc.state || geo.state || '').slice(0, 2).toUpperCase();

          const [ibge, placesRes, territorial] = await Promise.all([
            fetchIbgeCityContext(cityResolved, ufResolved, (evt) => {
              void logGeoUsage(companyId, evt);
            }),
            geo.found && geo.lat !== null && geo.lng !== null
              ? searchPlacesServer(
                  {
                    textQuery: queryStr,
                    centerLat: geo.lat,
                    centerLng: geo.lng,
                    radiusKm: Number(radiusKm || 10),
                    maxResults: 20,
                  },
                  (evt) => {
                    void logGeoUsage(companyId, evt);
                  }
                ).catch((err) => {
                  if (err instanceof MapsQuotaExceededError) throw err;
                  return { places: [], source: 'Indisponível', consultedAt: new Date().toISOString(), cacheHit: false };
                })
              : Promise.resolve({ places: [], source: 'Indisponível', consultedAt: new Date().toISOString(), cacheHit: false }),
            geo.found && geo.lat !== null && geo.lng !== null
              ? analyzeTerritorialEnvironment(
                  { lat: geo.lat, lng: geo.lng, radiusKm: Math.min(15, Number(radiusKm || 10)), stateUf: ufResolved },
                  (evt) => {
                    void logGeoUsage(companyId, evt);
                  }
                )
              : Promise.resolve(null),
          ]);

          const rated = placesRes.places.filter((p) => typeof p.rating === 'number');
          const avgRating = rated.length
            ? Number((rated.reduce((acc, p) => acc + (p.rating || 0), 0) / rated.length).toFixed(2))
            : null;
          const totalReviewsVolume = placesRes.places.reduce((acc, p) => acc + (p.userRatingCount || 0), 0);

          return {
            label,
            city: ibge.cityName || cityResolved,
            state: ibge.stateUf || ufResolved,
            lat: geo.lat,
            lng: geo.lng,
            formattedAddress: geo.formattedAddress,
            radiusKm: Number(radiusKm || 10),
            competitorsCount: placesRes.places.length,
            avgRating,
            totalReviewsVolume,
            sampleCompetitors: placesRes.places.slice(0, 6),
            ibge,
            industrialZonesCount: territorial?.osmInfrastructure.industrialZonesCount || 0,
            commercialZonesCount: territorial?.osmInfrastructure.commercialZonesCount || 0,
            highwaysCount: territorial?.osmInfrastructure.highwaysCount || 0,
          };
        })
      );

      const aiComparison = await analyzeExpansionOpportunitiesGeo({
        companyName: access.company.name,
        segment: access.company.segment,
        cnae: access.company.cnae,
        localities: localityBundles.map((b) => ({
          label: b.label,
          city: b.city,
          state: b.state,
          radiusKm: b.radiusKm,
          competitorsCount: b.competitorsCount,
          avgRating: b.avgRating,
          totalReviewsVolume: b.totalReviewsVolume,
          population: b.ibge.population,
          pibPerCapitaReais: b.ibge.pibPerCapitaReais,
          pibTotalMilReais: b.ibge.pibTotalMilReais,
          industrialZonesCount: b.industrialZonesCount,
          commercialZonesCount: b.commercialZonesCount,
          highwaysCount: b.highwaysCount,
        })),
      });

      await db.insert(geoSearchLogs).values({
        companyId,
        userId: req.dbUser!.id,
        searchType: 'expansion',
        query: `${queryStr} — ${localityBundles.map((b) => b.label).join(' vs ')}`,
        centerAddress: localityBundles[0]?.formattedAddress || localityBundles[0]?.label || '',
        centerLat: String(localityBundles[0]?.lat || ''),
        centerLng: String(localityBundles[0]?.lng || ''),
        radiusKm: Math.round(Number(radiusKm || 10)),
        resultsCount: localityBundles.reduce((acc, b) => acc + b.competitorsCount, 0),
        alertsSummary: aiComparison.verdictSummary.slice(0, 220),
      });

      res.json({
        localities: localityBundles,
        comparison: aiComparison,
        consultedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof MapsQuotaExceededError) {
        return res.status(429).json({ error: error.message, quotaExceeded: true });
      }
      console.error('Market expansion error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao comparar oportunidades de expansão.',
      });
    }
  });

  app.post('/api/beta/companies/:companyId/geo/entities', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as {
        entityKind?: string;
        classification?: string;
        placeId?: string;
        name: string;
        address?: string;
        city?: string;
        state?: string;
        lat?: number;
        lng?: number;
        distanceKm?: number | string;
        travelTimeText?: string;
        category?: string;
        website?: string;
        phone?: string;
        rating?: number | string | null;
        userRatingsTotal?: number;
        priceLevel?: string;
        openingHours?: string[];
        sourceName?: string;
        googleMapsUri?: string;
        notes?: string;
        syncToCompetitorsTab?: boolean;
      };

      const cleanName = sanitizePlainText(b.name, 160);
      if (!cleanName) {
        return res.status(400).json({ error: 'Nome do estabelecimento é obrigatório.' });
      }

      const entityKind = ['competitor', 'supplier', 'partner', 'client'].includes(String(b.entityKind || ''))
        ? String(b.entityKind)
        : 'competitor';
      const classification = sanitizePlainText(
        b.classification || (entityKind === 'supplier' ? 'strategic' : 'direct'),
        40
      );
      const placeId = sanitizePlainText(b.placeId, 140);
      const cleanAddress = sanitizePlainText(b.address, 260);
      const cleanCity = sanitizePlainText(b.city, 100);
      const cleanState = sanitizePlainText(b.state, 32);
      const cleanCategory = sanitizePlainText(b.category, 100);
      const cleanWebsite = sanitizeHttpUrl(b.website);
      const cleanGoogleMapsUri = sanitizeHttpUrl(b.googleMapsUri);
      const cleanPhone = sanitizePlainText(b.phone, 40);
      const cleanNotes = sanitizePlainText(b.notes, 1000);
      const cleanSourceName = sanitizePlainText(b.sourceName || 'Google Places API (New)', 120) || 'Google Places API (New)';
      const cleanPriceLevel = sanitizePlainText(b.priceLevel, 80);
      const cleanTravelTime = sanitizePlainText(b.travelTimeText, 80);
      const cleanOpeningHours = Array.isArray(b.openingHours)
        ? b.openingHours.slice(0, 14).map((h) => sanitizePlainText(h, 120)).filter(Boolean)
        : [];

      if (placeId) {
        const existing = await db
          .select()
          .from(geoSavedEntities)
          .where(
            and(
              eq(geoSavedEntities.companyId, companyId),
              eq(geoSavedEntities.placeId, placeId),
              eq(geoSavedEntities.entityKind, entityKind)
            )
          );
        if (existing.length > 0) {
          const [updated] = await db
            .update(geoSavedEntities)
            .set({
              classification: classification || existing[0].classification,
              distanceKm: b.distanceKm !== undefined ? sanitizePlainText(b.distanceKm, 24) : existing[0].distanceKm,
              travelTimeText: cleanTravelTime || existing[0].travelTimeText,
              publicRating:
                b.rating !== undefined && b.rating !== null ? sanitizePlainText(b.rating, 16) : existing[0].publicRating,
              userRatingsTotal: Math.max(0, Math.round(Number(b.userRatingsTotal ?? existing[0].userRatingsTotal) || 0)),
              notes: b.notes !== undefined ? cleanNotes : existing[0].notes,
              lastUpdatedAt: new Date(),
            })
            .where(eq(geoSavedEntities.id, existing[0].id))
            .returning();
          return res.json({ entity: updated, alreadyExisted: true });
        }
      }

      const [inserted] = await db
        .insert(geoSavedEntities)
        .values({
          companyId,
          entityKind,
          classification: classification || (entityKind === 'supplier' ? 'strategic' : 'direct'),
          placeId,
          name: cleanName,
          address: cleanAddress,
          city: cleanCity,
          state: cleanState,
          latitude: b.lat !== undefined && Number.isFinite(Number(b.lat)) ? String(Number(b.lat)) : '',
          longitude: b.lng !== undefined && Number.isFinite(Number(b.lng)) ? String(Number(b.lng)) : '',
          distanceKm: b.distanceKm !== undefined ? sanitizePlainText(b.distanceKm, 24) : '',
          travelTimeText: cleanTravelTime,
          category: cleanCategory,
          website: cleanWebsite,
          phone: cleanPhone,
          publicRating: b.rating !== undefined && b.rating !== null ? sanitizePlainText(b.rating, 16) : '',
          userRatingsTotal: Math.max(0, Math.round(Number(b.userRatingsTotal || 0) || 0)),
          priceLevel: cleanPriceLevel,
          openingHoursJson: cleanOpeningHours,
          sourceName: cleanSourceName,
          googleMapsUri: cleanGoogleMapsUri,
          notes: cleanNotes,
        })
        .returning();

      if (b.syncToCompetitorsTab && entityKind === 'competitor') {
        const curComps = await db
          .select()
          .from(competitors)
          .where(eq(competitors.companyId, companyId));
        const exists = curComps.some(
          (c) => c.name.toLowerCase().trim() === cleanName.toLowerCase().trim()
        );
        if (!exists) {
          await db.insert(competitors).values({
            companyId,
            name: cleanName,
            segment: cleanCategory || access.company.segment || '',
            positioning: `${cleanAddress} (${b.distanceKm ? `${sanitizePlainText(b.distanceKm, 20)} km` : 'Radar Geo'})`.trim(),
            announcedPriceRange: cleanPriceLevel || 'Não divulgado publicamente',
            publicRating: b.rating ? `${sanitizePlainText(b.rating, 10)}/5 (${Math.max(0, Number(b.userRatingsTotal || 0))} aval.)` : '',
            sourceUrl: cleanGoogleMapsUri || cleanWebsite,
            channels: cleanWebsite ? 'Loja física + Site oficial' : 'Loja física / Google Maps',
            threatLevel:
              classification === 'direct' ? 'Impacto alto' : 'Impacto médio',
            lastChangeNote: `Sincronizado via Inteligência Geográfica em ${new Date().toLocaleDateString('pt-BR')}`,
            reviewSnippetsJson: {
              locationDistance: b.distanceKm ? `${sanitizePlainText(b.distanceKm, 20)} km` : '',
              consultedAt: new Date().toLocaleDateString('pt-BR'),
            },
          });
        }
      }

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'SAVE_GEO_ENTITY',
        entityType: 'geo_saved_entity',
        entityId: inserted.id,
        details: { name: inserted.name, entityKind, classification: inserted.classification },
      });

      res.status(201).json({ entity: inserted });
    } catch (error) {
      console.error('Save geo entity error:', error);
      res.status(500).json({ error: 'Erro ao salvar entidade geográfica.' });
    }
  });

  app.delete('/api/beta/companies/:companyId/geo/entities/:entityId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const entityId = Number(req.params.entityId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      await db
        .delete(geoSavedEntities)
        .where(and(eq(geoSavedEntities.id, entityId), eq(geoSavedEntities.companyId, companyId)));
      res.json({ deleted: true });
    } catch {
      res.status(500).json({ error: 'Erro ao remover item geográfico.' });
    }
  });

  app.post('/api/beta/companies/:companyId/geo/assistant', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const {
        question,
        activeRadiusKm = 5,
        currentCenter = '',
        livePlaces = [],
        territorialContext = '',
        ibgeContext = '',
        history = [],
      } = req.body as {
        question?: string;
        activeRadiusKm?: number;
        currentCenter?: string;
        livePlaces?: Array<{
          name: string;
          classification?: string;
          distanceKm?: number;
          travelTimeText?: string;
          rating?: number | null;
          userRatingCount?: number;
          primaryTypeLabel?: string;
        }>;
        territorialContext?: string;
        ibgeContext?: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      };

      if (!question || !question.trim()) {
        return res.status(400).json({ error: 'Pergunta é obrigatória.' });
      }

      const savedEntities = await db
        .select()
        .from(geoSavedEntities)
        .where(eq(geoSavedEntities.companyId, companyId));

      const savedComps = savedEntities.filter((e) => e.entityKind === 'competitor');
      const savedSups = savedEntities.filter((e) => e.entityKind === 'supplier' || e.entityKind === 'partner');

      const competitorsSummary = [
        ...(Array.isArray(livePlaces)
          ? livePlaces
              .slice(0, 15)
              .map(
                (p) =>
                  `- [Radar ao vivo] ${p.name} (${p.classification || p.primaryTypeLabel || 'Comércio'}) | Distância: ${p.distanceKm ?? 'N/A'} km (${p.travelTimeText || 'linha reta'}) | Nota: ${p.rating ?? 'N/A'} (${p.userRatingCount ?? 0} aval.)`
              )
          : []),
        ...savedComps
          .slice(0, 10)
          .map(
            (c) =>
              `- [Salvo] ${c.name} (${c.classification}) | Distância: ${c.distanceKm || 'N/A'} km | Nota: ${c.publicRating || 'N/A'} | Endereço: ${c.address}`
          ),
      ].join('\n');

      const suppliersSummary = savedSups
        .slice(0, 15)
        .map(
          (s) =>
            `- ${s.name} (${s.category}) | Distância: ${s.distanceKm || 'N/A'} km (${s.travelTimeText || ''}) | Nota: ${s.publicRating || 'N/A'} | Tel: ${s.phone || 'N/A'}`
        )
        .join('\n');

      const latNum = Number(access.company.latitude);
      const lngNum = Number(access.company.longitude);
      const userLatLng =
        Number.isFinite(latNum) && Number.isFinite(lngNum) && latNum !== 0 && lngNum !== 0
          ? { latitude: latNum, longitude: lngNum }
          : null;

      const result = await askGeoMarketAssistant({
        question: question.trim(),
        companyName: access.company.name,
        segment: access.company.segment,
        cityState: [access.company.city, access.company.state].filter(Boolean).join('/'),
        activeRadiusKm: Number(activeRadiusKm || 5),
        currentCenter: currentCenter || [access.company.city, access.company.state].filter(Boolean).join('/'),
        competitorsSummary,
        suppliersSummary,
        territorialSummary: territorialContext,
        ibgeSummary: ibgeContext,
        history: Array.isArray(history) ? history : [],
        userLatLng,
      });

      res.json(result);
    } catch (error: unknown) {
      console.error('Geo assistant error:', error);
      const friendly = formatFriendlyAiError(
        error,
        'Não foi possível consultar o Analista Geo-IA no momento. Tente novamente em instantes.'
      );
      res.status(friendly.status).json({ error: friendly.message });
    }
  });

  // =========================================================================
  // GESTÃO FINANCEIRA (VENDAS, CUSTOS, DESPESAS, DRE, ESTOQUE) & SINCRONIZAÇÃO
  // =========================================================================
  app.post('/api/beta/companies/:companyId/financial/sales', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as Record<string, unknown>;
      const periodMonth = String(b.periodMonth || new Date().toISOString().slice(0, 7)).slice(0, 7);
      const categoryName = String(b.categoryName || '').trim() || 'Geral';
      await ensureCategoryByName(companyId, categoryName);

      const [row] = await db
        .insert(financialSalesRecords)
        .values({
          companyId,
          periodMonth,
          categoryName,
          productName: String(b.productName || '').trim(),
          unitsSold: Math.max(0, Math.round(Number(b.unitsSold || 0))),
          unitPriceCents: Math.max(0, Math.round(Number(b.unitPriceReais || 0) * 100)),
          unitCostCents: Math.max(0, Math.round(Number(b.unitCostReais || 0) * 100)),
          notes: String(b.notes || '').trim(),
        })
        .returning();

      res.status(201).json({ row });
    } catch (error) {
      console.error('POST financial sales error:', error);
      res.status(500).json({ error: 'Erro ao salvar registro de vendas.' });
    }
  });

  app.delete('/api/beta/companies/:companyId/financial/sales/:rowId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const rowId = Number(req.params.rowId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });
      await db.delete(financialSalesRecords).where(and(eq(financialSalesRecords.id, rowId), eq(financialSalesRecords.companyId, companyId)));
      res.json({ deleted: true });
    } catch {
      res.status(500).json({ error: 'Erro ao remover registro de vendas.' });
    }
  });

  app.post('/api/beta/companies/:companyId/financial/costs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as Record<string, unknown>;
      const toCents = (v: unknown) => Math.max(0, Math.round(Number(v || 0) * 100));

      const [row] = await db
        .insert(financialCostRecords)
        .values({
          companyId,
          periodMonth: String(b.periodMonth || new Date().toISOString().slice(0, 7)).slice(0, 7),
          categoryName: String(b.categoryName || 'Geral').trim(),
          cmvSourceMode: String(b.cmvSourceMode || 'auto_vendas') === 'manual' ? 'manual' : 'auto_vendas',
          cmvCents: toCents(b.cmvReais),
          freightCents: toCents(b.freightReais),
          packagingCents: toCents(b.packagingReais),
          cardFeesCents: toCents(b.cardFeesReais),
          marketplaceFeesCents: toCents(b.marketplaceFeesReais),
          lossesDamagesCents: toCents(b.lossesDamagesReais),
          otherVariableCostsCents: toCents(b.otherVariableCostsReais),
          notes: String(b.notes || '').trim(),
        })
        .returning();

      res.status(201).json({ row });
    } catch (error) {
      console.error('POST financial costs error:', error);
      res.status(500).json({ error: 'Erro ao salvar custos.' });
    }
  });

  app.delete('/api/beta/companies/:companyId/financial/costs/:rowId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const rowId = Number(req.params.rowId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });
      await db.delete(financialCostRecords).where(and(eq(financialCostRecords.id, rowId), eq(financialCostRecords.companyId, companyId)));
      res.json({ deleted: true });
    } catch {
      res.status(500).json({ error: 'Erro ao remover registro de custos.' });
    }
  });

  app.post('/api/beta/companies/:companyId/financial/expenses', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as Record<string, unknown>;
      const toCents = (v: unknown) => Math.max(0, Math.round(Number(v || 0) * 100));

      const [row] = await db
        .insert(financialExpenseRecords)
        .values({
          companyId,
          periodMonth: String(b.periodMonth || new Date().toISOString().slice(0, 7)).slice(0, 7),
          costCenter: String(b.costCenter || 'Operação').trim(),
          rentCents: toCents(b.rentReais),
          payrollCents: toCents(b.payrollReais),
          waterCents: toCents(b.waterReais),
          energyCents: toCents(b.energyReais),
          internetCents: toCents(b.internetReais),
          marketingCents: toCents(b.marketingReais),
          accountingCents: toCents(b.accountingReais),
          systemsCents: toCents(b.systemsReais),
          otherExpensesCents: toCents(b.otherExpensesReais),
          notes: String(b.notes || '').trim(),
        })
        .returning();

      res.status(201).json({ row });
    } catch (error) {
      console.error('POST financial expenses error:', error);
      res.status(500).json({ error: 'Erro ao salvar despesas operacionais.' });
    }
  });

  app.delete('/api/beta/companies/:companyId/financial/expenses/:rowId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const rowId = Number(req.params.rowId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });
      await db.delete(financialExpenseRecords).where(and(eq(financialExpenseRecords.id, rowId), eq(financialExpenseRecords.companyId, companyId)));
      res.json({ deleted: true });
    } catch {
      res.status(500).json({ error: 'Erro ao remover despesa.' });
    }
  });

  app.post('/api/beta/companies/:companyId/financial/inventory', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as Record<string, unknown>;
      const categoryName = String(b.categoryName || '').trim() || 'Geral';
      const itemName = String(b.itemName || '').trim() || categoryName;
      await ensureCategoryByName(companyId, categoryName);

      const [row] = await db
        .insert(inventoryControlItems)
        .values({
          companyId,
          periodMonth: String(b.periodMonth || new Date().toISOString().slice(0, 7)).slice(0, 7),
          categoryName,
          sku: String(b.sku || '').trim(),
          itemName,
          initialStock: Math.max(0, Math.round(Number(b.initialStock || 0))),
          purchasesQty: Math.max(0, Math.round(Number(b.purchasesQty || 0))),
          salesQty: Math.max(0, Math.round(Number(b.salesQty || 0))),
          lossesQty: Math.max(0, Math.round(Number(b.lossesQty || 0))),
          unitCostCents: Math.max(0, Math.round(Number(b.unitCostReais || 0) * 100)),
          reorderPoint: Math.max(0, Math.round(Number(b.reorderPoint ?? 10))),
          periodDays: Math.max(1, Math.round(Number(b.periodDays ?? 30))),
          notes: String(b.notes || '').trim(),
        })
        .returning();

      res.status(201).json({ row });
    } catch (error) {
      console.error('POST financial inventory error:', error);
      res.status(500).json({ error: 'Erro ao salvar item no controle de estoque.' });
    }
  });

  app.patch('/api/beta/companies/:companyId/financial/inventory/:rowId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const rowId = Number(req.params.rowId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const b = req.body as Record<string, unknown>;
      const [row] = await db
        .update(inventoryControlItems)
        .set({
          ...(b.initialStock !== undefined ? { initialStock: Math.max(0, Math.round(Number(b.initialStock))) } : {}),
          ...(b.purchasesQty !== undefined ? { purchasesQty: Math.max(0, Math.round(Number(b.purchasesQty))) } : {}),
          ...(b.salesQty !== undefined ? { salesQty: Math.max(0, Math.round(Number(b.salesQty))) } : {}),
          ...(b.lossesQty !== undefined ? { lossesQty: Math.max(0, Math.round(Number(b.lossesQty))) } : {}),
          ...(b.reorderPoint !== undefined ? { reorderPoint: Math.max(0, Math.round(Number(b.reorderPoint))) } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(inventoryControlItems.id, rowId), eq(inventoryControlItems.companyId, companyId)))
        .returning();
      if (!row) return res.status(404).json({ error: 'Item de estoque não encontrado.' });
      res.json({ row });
    } catch {
      res.status(500).json({ error: 'Erro ao atualizar item de estoque.' });
    }
  });

  app.delete('/api/beta/companies/:companyId/financial/inventory/:rowId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const rowId = Number(req.params.rowId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });
      await db.delete(inventoryControlItems).where(and(eq(inventoryControlItems.id, rowId), eq(inventoryControlItems.companyId, companyId)));
      res.json({ deleted: true });
    } catch {
      res.status(500).json({ error: 'Erro ao remover item de estoque.' });
    }
  });

  app.post('/api/beta/companies/:companyId/financial/import-workbook', requireAuth, uploadLimiter, async (req: AuthRequest, res) => {
    try {
      const ctx = extractClientSecurityContext(req);
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access || access.role === 'viewer') return res.status(403).json({ error: 'Sem permissão.' });

      const { fileName, base64Data } = req.body as { fileName?: string; base64Data?: string };
      if (!base64Data) return res.status(400).json({ error: 'Arquivo não enviado.' });
      const checked = inspectDocumentOrImageUpload({
        fileName: fileName || 'planilha.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64Data,
      });
      if (!checked.ok) {
        void recordSecurityEvent({
          eventType: 'UPLOAD_REJECTED',
          severity: 'medium',
          ip: ctx.ip,
          method: req.method,
          path: req.path,
          userId: req.dbUser!.id,
          companyId,
          cfRay: ctx.cfRay,
          cfCountry: ctx.cfCountry,
          userAgent: ctx.userAgent,
          details: { reason: checked.error, fileName: checked.safeFileName },
        });
        return res.status(400).json({ error: checked.error });
      }
      const buf = checked.buffer;
      const ab = Uint8Array.from(buf).buffer;
      const parsed = parseFinancialWorkbookBuffer(ab);

      const categoryNames = new Set<string>();
      for (const s of parsed.sales) if (s.categoryName) categoryNames.add(s.categoryName);
      for (const i of parsed.inventory) if (i.categoryName) categoryNames.add(i.categoryName);
      for (const catName of categoryNames) {
        await ensureCategoryByName(companyId, catName);
      }

      if (parsed.sales.length > 0) {
        await db.insert(financialSalesRecords).values(parsed.sales.map((s) => ({ companyId, ...s })));
      }
      if (parsed.costs.length > 0) {
        await db.insert(financialCostRecords).values(parsed.costs.map((c) => ({ companyId, ...c })));
      }
      if (parsed.expenses.length > 0) {
        await db.insert(financialExpenseRecords).values(parsed.expenses.map((e) => ({ companyId, ...e })));
      }
      if (parsed.inventory.length > 0) {
        await db.insert(inventoryControlItems).values(parsed.inventory.map((i) => ({ companyId, ...i })));
      }

      await recordAuditLog({
        companyId,
        userId: req.dbUser!.id,
        userEmail: req.dbUser!.email,
        action: 'IMPORT_FINANCIAL_WORKBOOK',
        entityType: 'financial_workbook',
        entityId: companyId,
        details: {
          fileName: fileName || 'planilha.xlsx',
          salesCount: parsed.sales.length,
          costsCount: parsed.costs.length,
          expensesCount: parsed.expenses.length,
          inventoryCount: parsed.inventory.length,
        },
      });

      res.json({
        detectedSheets: parsed.detectedSheets,
        importedCounts: {
          sales: parsed.sales.length,
          costs: parsed.costs.length,
          expenses: parsed.expenses.length,
          inventory: parsed.inventory.length,
        },
      });
    } catch (error) {
      console.error('Import financial workbook error:', error);
      res.status(500).json({ error: 'Erro ao importar planilha financeira.' });
    }
  });

  app.post('/api/beta/companies/:companyId/cross-analysis', requireAuth, async (req: AuthRequest, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const access = await getUserCompanyAccess(req.dbUser!.id, companyId);
      if (!access) return res.status(403).json({ error: 'Acesso negado.' });

      const [macroBundle, comps, revs, syncBundle] = await Promise.all([
        getOfficialMacroBundle(access.company.state),
        db.select().from(competitors).where(eq(competitors.companyId, companyId)),
        db.select().from(customerReviews).where(eq(customerReviews.companyId, companyId)).orderBy(desc(customerReviews.createdAt)),
        buildCompanySyncSummaries(companyId),
      ]);

      const macroSummary = macroBundle.indicators
        .map((m) =>
          m.status === 'ok'
            ? `- ${m.label}: ${m.value} ${m.unit} (Ref: ${m.referenceDate || 'atual'} | ${m.source})`
            : `- ${m.label}: indisponível`
        )
        .join('\n');

      const consumersSummary = [
        syncBundle.reputationSummaryText,
        revs.length > 0
          ? `Amostra de comentários reais (${revs.length}):\n${revs.slice(0, 15).map((r) => `[${r.source} ${r.rating}/5] ${r.commentText}`).join('\n')}`
          : 'Nenhum comentário textual de consumidor registrado ainda.',
      ].join('\n');

      const competitorsSummary =
        comps.length > 0
          ? comps
              .map(
                (c) =>
                  `- ${c.name} (${c.threatLevel || 'Impacto médio'}): Nota ${c.publicRating || 'N/A'} | Faixa ${c.announcedPriceRange || 'não divulgada'} | Críticas: ${c.complaintsNote || 'N/A'}`
              )
              .join('\n')
          : 'Nenhum concorrente monitorado ainda.';

      const result = await analyzeCrossSectionCorrelations({
        companyName: access.company.name,
        segment: access.company.segment,
        cityState: [access.company.city, access.company.state].filter(Boolean).join('/'),
        macroSummary,
        consumersSummary,
        competitorsSummary,
        financialAndInventorySummary: syncBundle.financialSummaryText,
      });

      await db
        .delete(strategicItems)
        .where(and(eq(strategicItems.companyId, companyId), eq(strategicItems.kind, 'cross_sync_ai')));

      await db.insert(strategicItems).values({
        companyId,
        kind: 'cross_sync_ai',
        category: 'Sincronização Cruzada',
        title: `Síntese Integrada — ${access.company.name}`,
        description: result.executiveDiagnosis,
        priority: 'alta',
        status: 'aberto',
        impactNote: result.priorityAlerts.join(' · ') || 'Correlação multissetorial atualizada',
        dueDate: new Date().toLocaleDateString('pt-BR'),
        metadataJson: result as unknown as Record<string, unknown>,
      });

      res.json(result);
    } catch (error) {
      console.error('Cross analysis error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao cruzar informações entre módulos.',
      });
    }
  });

  // =========================================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global fallback error handler (never expose internal stack traces to clients)
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('Unhandled server error:', err instanceof Error ? err.message : 'unknown');
      if (res.headersSent) return;
      res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
    }
  );

  // Start automated periodic database backups with SHA-256 verification
  startPeriodicBackups();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gêmeo Digital server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
