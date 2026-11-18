import { GoogleGenAI, Type } from '@google/genai';
import type { MacroIndicator } from './externalData.ts';

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Chave GEMINI_API_KEY não configurada no servidor. Verifique as configurações de Secrets.'
    );
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
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export interface CompanyContextSnapshot {
  companyName: string;
  segment: string;
  operationType: string;
  cityState: string;
  description?: string;
  productsCount: number;
  categoriesCount: number;
  metricsCount: number;
  competitorsCount: number;
  reviewsCount: number;
  importsCount?: number;
  connectedIntegrations: string[];
  recentMetricsSummary: string;
  topProductsSummary: string;
  competitorsSummary: string;
  reviewsSummary: string;
  importsSummary?: string;
  financialSummaryText?: string;
  reputationSummaryText?: string;
  macroIndicators: MacroIndicator[];
}

export type ChatToolMode = 'cloudsql' | 'maps' | 'search' | 'general';

export interface GroundingLinkOutput {
  title: string;
  uri: string;
  sourceType: 'maps' | 'search';
}

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

function buildMultiTurnContents(
  history: ChatHistoryTurn[],
  currentQuestion: string
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const turns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const item of history) {
    const txt = (item.content || '').trim();
    if (!txt) continue;
    const role: 'user' | 'model' = item.role === 'user' ? 'user' : 'model';
    if (turns.length === 0 && role === 'model') {
      // Skip initial static greeting so conversation cleanly starts with user
      continue;
    }
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) {
      prev.parts[0].text = `${prev.parts[0].text}\n\n${txt}`;
    } else {
      turns.push({ role, parts: [{ text: txt }] });
    }
  }

  const trimmedQ = currentQuestion.trim();
  const last = turns[turns.length - 1];
  if (!last || last.role !== 'user' || last.parts[0].text !== trimmedQ) {
    if (last && last.role === 'user') {
      last.parts[0].text = `${last.parts[0].text}\n\n${trimmedQ}`;
    } else {
      turns.push({ role: 'user', parts: [{ text: trimmedQ }] });
    }
  }

  return turns;
}

async function classifyChatToolMode(params: {
  question: string;
  hasCloudSqlContext: boolean;
}): Promise<ChatToolMode> {
  const q = params.question.toLowerCase();

  // Deterministic Maps / Route / Location intent
  const mapsPatterns =
    /\b(rota|rotas|caminho|como chegar|trajeto|google maps|mapa|localiza[çc][ãa]o|endere[çc]o|onde fica|perto de|pr[óo]xim[oa]s?|raio|km|quil[ôo]metros?|hor[áa]rio de funcionamento|avalia[çc][õo]es no maps|concorrentes? na regi[ãa]o|restaurantes?|lojas? perto)\b/i;

  // Deterministic internal Cloud SQL data cues
  const cloudSqlPatterns =
    /\b(minha empresa|minhas empresas|nossa empresa|estoque|sku|produto|produtos|dre|cmv|margem|lucro|receita|faturamento|despesa|custo|venda|vendas|swot|tows|pestel|porter|concorrente cadastrado|avalia[çc][ãa]o interna|dist[âa]ncia entre.*empresas|empresas no banco|cloud sql)\b/i;

  // Deterministic current/real-time internet cues (Search Grounding ONLY when needed)
  const searchPatterns =
    /\b(hoje|atual|atuais|atualmente|2025|2026|not[íi]cia|not[íi]cias|recente|recentes|agora|nova lei|reforma tribut[áa]ria|legisla[çc][ãa]o vigente|tend[êe]ncia|pesquise na internet|buscar na web|google search|cot[açã][çã]o de hoje|taxa selic hoje|ipca atual|feriado)\b/i;

  if (mapsPatterns.test(q) && !/\bdist[âa]ncia entre.*(minhas|cadastradas)\b/i.test(q)) {
    return 'maps';
  }
  if (searchPatterns.test(q)) {
    return 'search';
  }
  if (params.hasCloudSqlContext && cloudSqlPatterns.test(q)) {
    return 'cloudsql';
  }

  // Lightweight classifier fallback via gemini-3.1-flash-lite
  try {
    const ai = getAiClient();
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Classifique a pergunta do usuário em APENAS UMA palavra exata:
- "maps": se precisar consultar locais reais, estabelecimentos, endereços, rotas, trânsito, horários ou lugares no Google Maps.
- "search": SOMENTE se precisar de informação atual/recente da internet (notícias recentes, leis atuais, cotações/taxas de hoje, eventos atuais).
- "cloudsql": se puder ser respondida com dados cadastrados das empresas, distância já calculada, produtos, financeiro, SWOT ou contexto histórico da conversa.

Pergunta: "${params.question}"
Responda apenas: maps, search ou cloudsql.`,
    });
    const out = (res.text || '').trim().toLowerCase();
    if (out.includes('maps')) return 'maps';
    if (out.includes('search')) return 'search';
  } catch {
    // Fallback cleanly without blocking chat
  }

  return params.hasCloudSqlContext ? 'cloudsql' : 'general';
}

function extractGroundingLinks(
  response: unknown,
  toolMode: ChatToolMode
): GroundingLinkOutput[] {
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
  const links: GroundingLinkOutput[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    if (toolMode === 'maps' && chunk.maps?.uri && !seen.has(chunk.maps.uri)) {
      seen.add(chunk.maps.uri);
      links.push({
        title: chunk.maps.title || 'Local no Google Maps',
        uri: chunk.maps.uri,
        sourceType: 'maps',
      });
    } else if (toolMode === 'search' && chunk.web?.uri && !seen.has(chunk.web.uri)) {
      seen.add(chunk.web.uri);
      links.push({
        title: chunk.web.title || 'Resultado Google Search',
        uri: chunk.web.uri,
        sourceType: 'search',
      });
    }
  }
  return links.slice(0, 10);
}

export async function askGroundedChatbot(params: {
  question: string;
  screenContext: string;
  history: ChatHistoryTurn[];
  isAuthenticated: boolean;
  companiesDirectoryText?: string;
  distanceQueriesSummary?: string;
  activeCompanySnapshot?: CompanyContextSnapshot | null;
  userLatLng?: { latitude: number; longitude: number } | null;
}): Promise<{
  answer: string;
  toolUsed: ChatToolMode;
  groundingLinks: GroundingLinkOutput[];
  sourcesUsed: string[];
}> {
  const ai = getAiClient();
  const hasCloudSqlContext = Boolean(
    params.isAuthenticated &&
      (params.companiesDirectoryText || params.activeCompanySnapshot)
  );

  const toolMode = await classifyChatToolMode({
    question: params.question,
    hasCloudSqlContext,
  });

  const snapshot = params.activeCompanySnapshot;
  const cloudSqlBlock = params.isAuthenticated
    ? `
EMPRESAS DO USUÁRIO NO CLOUD SQL (PostgreSQL):
${params.companiesDirectoryText || 'Nenhuma empresa cadastrada no Cloud SQL para este usuário ainda.'}

CONSULTAS RECENTES DE DISTÂNCIA E RAIO NO CLOUD SQL:
${params.distanceQueriesSummary || 'Nenhuma consulta de distância/raio registrada ainda.'}

${
  snapshot
    ? `DADOS DETALHADOS DA EMPRESA ATIVA (${snapshot.companyName}):
- Segmento: ${snapshot.segment || 'Não informado'} | Operação: ${snapshot.operationType} | Localização: ${snapshot.cityState || 'Não informada'}
- Descrição: ${snapshot.description || 'Não informada'}
- Produtos: ${snapshot.productsCount} | Categorias: ${snapshot.categoriesCount} | Métricas: ${snapshot.metricsCount} | Concorrentes: ${snapshot.competitorsCount} | Avaliações: ${snapshot.reviewsCount}
- Integrações conectadas: ${snapshot.connectedIntegrations.length > 0 ? snapshot.connectedIntegrations.join(', ') : 'Nenhuma'}
- Documentos importados: ${snapshot.importsSummary || 'Nenhum.'}
- Financeiro / DRE / Estoque: ${snapshot.financialSummaryText || 'Sem lançamentos.'}
- Métricas internas recentes: ${snapshot.recentMetricsSummary}
- Catálogo (amostra): ${snapshot.topProductsSummary}
- Concorrentes monitorados: ${snapshot.competitorsSummary}
- Reputação e avaliações: ${snapshot.reputationSummaryText || ''} ${snapshot.reviewsSummary}
- Indicadores macroeconômicos oficiais (BCB/IBGE/SEFAZ): ${snapshot.macroIndicators
        .map((m) => `${m.label}: ${m.status === 'ok' ? `${m.value} ${m.unit}` : 'Indisponível'}`)
        .join(' | ')}`
    : 'Nenhuma empresa ativa selecionada neste momento.'
}`
    : `USUÁRIO NÃO AUTENTICADO:
Você NÃO tem acesso a dados privados do Cloud SQL porque o usuário ainda não fez login. Caso pergunte sobre uma empresa privada dele, oriente-o a entrar com a conta Google/Email no sistema. Você pode responder dúvidas sobre o Gêmeo Digital, locais via Google Maps ou informações atuais da web via Busca do Google.`;

  const systemInstruction = `Você é o Chatbot Inteligente da plataforma Gêmeo Digital.
TELA ATUAL DO USUÁRIO: ${params.screenContext}

REGRAS ESTRITAS DE INTEGRIDADE E FONTES:
1. Consulte exclusivamente os dados reais do Cloud SQL (PostgreSQL) fornecidos abaixo e, quando ativada nesta rodada, a ferramenta conectada (${toolMode === 'maps' ? 'Google Maps Grounding em tempo real' : toolMode === 'search' ? 'Busca do Google (Google Search Grounding)' : 'Base real Cloud SQL'}).
2. Se você NÃO tiver a informação necessária nos dados reais fornecidos ou na ferramenta consultada, responda explicitamente: "Não encontrei essa informação" e informe exatamente o que falta cadastrar ou consultar. NUNCA invente números, endereços, distâncias, avaliações, preços ou fatos.
3. Respeite o isolamento do usuário: cite apenas as empresas pertencentes ao usuário autenticado listadas no contexto.
4. Lembre-se de toda a conversa anterior enviada no histórico para manter continuidade natural.
5. Responda em português do Brasil, de forma clara, objetiva e profissional. Não dê aconselhamento jurídico/contábil definitivo.

${cloudSqlBlock}`;

  const contents = buildMultiTurnContents(params.history, params.question);

  // Never combine googleMaps and googleSearch in the same call
  const config: Record<string, unknown> = {
    systemInstruction,
  };

  if (toolMode === 'maps') {
    config.tools = [{ googleMaps: {} }];
    if (params.userLatLng) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: params.userLatLng.latitude,
            longitude: params.userLatLng.longitude,
          },
        },
      };
    }
  } else if (toolMode === 'search') {
    config.tools = [{ googleSearch: {} }];
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents,
    config,
  });

  const groundingLinks = extractGroundingLinks(response, toolMode);
  const sourcesUsed: string[] = [];
  if (params.isAuthenticated && params.companiesDirectoryText) {
    sourcesUsed.push('Cloud SQL (PostgreSQL)');
  }
  if (snapshot) {
    sourcesUsed.push(`Empresa ativa: ${snapshot.companyName}`);
  }
  if (toolMode === 'maps') {
    sourcesUsed.push('Google Maps Grounding');
  } else if (toolMode === 'search') {
    sourcesUsed.push('Google Search Grounding');
  }

  return {
    answer:
      response.text?.trim() ||
      'Não encontrei essa informação nos dados disponíveis neste momento.',
    toolUsed: toolMode,
    groundingLinks,
    sourcesUsed,
  };
}

export async function askStrategicAssistant(params: {
  question: string;
  screenContext: string;
  snapshot: CompanyContextSnapshot;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  companiesDirectoryText?: string;
  distanceQueriesSummary?: string;
  userLatLng?: { latitude: number; longitude: number } | null;
}) {
  const result = await askGroundedChatbot({
    question: params.question,
    screenContext: params.screenContext,
    history: params.history,
    isAuthenticated: true,
    companiesDirectoryText: params.companiesDirectoryText,
    distanceQueriesSummary: params.distanceQueriesSummary,
    activeCompanySnapshot: params.snapshot,
    userLatLng: params.userLatLng,
  });

  return {
    answer: result.answer,
    toolUsed: result.toolUsed,
    groundingLinks: result.groundingLinks,
    sourcesUsed: [
      ...result.sourcesUsed,
      ...params.snapshot.macroIndicators
        .filter((m) => m.status === 'ok')
        .map((m) => m.source),
    ],
  };
}

export interface ConsumerPerceptionDiagnosis {
  hasSufficientData: boolean;
  summary: string;
  overallPerceptionDiagnosis: string;
  satisfactionLevel: string;
  positives: Array<{ theme: string; frequency: string; example: string; source: string }>;
  recurringComplaints: Array<{ theme: string; frequency: string; example: string; source: string }>;
  negatives: Array<{ theme: string; frequency: string; example: string; source: string }>;
  improvementOpportunities: string[];
  salesAndMarginImpact: string;
  dataLimitations: string;
  recommendations: string[];
  generatedAt?: string;
}

export async function interpretCustomerReviews(params: {
  companyName: string;
  reviews: Array<{ source: string; rating: number; sentiment: string; commentText: string; reviewedAt: string }>;
  reputationContext?: {
    googleRating?: string;
    googleRatingsTotal?: number;
    reclameAquiScore?: string;
    reclameAquiStatusLabel?: string;
    reclameAquiResponseRatePct?: string;
    reclameAquiSolvedRatePct?: string;
    reclameAquiBackToBuyPct?: string;
    reclameAquiComplaintsTotal?: number;
  };
}): Promise<ConsumerPerceptionDiagnosis> {
  const rep = params.reputationContext;
  const hasReputationMetrics = Boolean(
    rep &&
      (rep.googleRating ||
        (rep.googleRatingsTotal && rep.googleRatingsTotal > 0) ||
        rep.reclameAquiScore ||
        rep.reclameAquiStatusLabel ||
        (rep.reclameAquiComplaintsTotal && rep.reclameAquiComplaintsTotal > 0))
  );

  if (params.reviews.length === 0 && !hasReputationMetrics) {
    return {
      hasSufficientData: false,
      summary:
        'A investigar — não tenho evidência suficiente para diagnosticar a percepção dos consumidores. Sincronize o Google Reviews, informe o Reclame Aqui ou registre avaliações reais primeiro.',
      overallPerceptionDiagnosis:
        'Dados insuficientes até o momento para diagnóstico consolidado da percepção do cliente.',
      satisfactionLevel: 'A investigar',
      positives: [],
      recurringComplaints: [],
      negatives: [],
      improvementOpportunities: [],
      salesAndMarginImpact:
        'Cadastre ou sincronize avaliações para que a IA cruze a satisfação com vendas e margem.',
      dataLimitations: 'Nenhuma avaliação textual ou índice externo disponível.',
      recommendations: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const repLines = rep
    ? [
        rep.googleRating
          ? `- Google Reviews: Nota média ${rep.googleRating}/5 (${rep.googleRatingsTotal || 0} avaliações)`
          : '',
        rep.reclameAquiScore || rep.reclameAquiStatusLabel
          ? `- Reclame Aqui: Nota ${rep.reclameAquiScore || 'N/A'} | Classificação: ${rep.reclameAquiStatusLabel || 'N/A'} | Respondidas: ${rep.reclameAquiResponseRatePct || 'N/A'} | Solução: ${rep.reclameAquiSolvedRatePct || 'N/A'} | Voltariam a fazer negócio: ${rep.reclameAquiBackToBuyPct || 'N/A'} | Reclamações: ${rep.reclameAquiComplaintsTotal || 0}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Faça um diagnóstico completo e fiel à realidade da percepção dos consumidores sobre a empresa "${params.companyName}".

ÍNDICES EXTERNOS CAPTADOS:
${repLines || 'Nenhum índice numérico externo captado ainda.'}

COMENTÁRIOS E AVALIAÇÕES REAIS (${params.reviews.length}):
${
  params.reviews.length > 0
    ? params.reviews
        .map(
          (r, idx) =>
            `[${idx + 1}] Fonte: ${r.source} | Nota: ${r.rating}/5 | Data: ${r.reviewedAt} | Texto: "${r.commentText}"`
        )
        .join('\n')
    : 'Nenhum comentário textual capturado ainda; baseie-se apenas nos índices externos informados acima e declare explicitamente a ausência de comentários textuais.'
}

REGRAS ESTRITAS:
1. Extraia APENAS padrões realmente observados nos comentários e índices listados acima. Nunca invente citações, notas ou reclamações.
2. Diferencie elogios ("positives"), reclamações recorrentes ("recurringComplaints"), pontos negativos ("negatives") e oportunidades de melhoria ("improvementOpportunities").
3. Se não houver reclamações recorrentes na amostra, retorne [] em "recurringComplaints" e explique em "dataLimitations".`,
    config: {
      systemInstruction:
        'Você é o Analista de Experiência e Reputação do Consumidor do Gêmeo Digital. Nunca fabrique feedbacks inexistentes.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          overallPerceptionDiagnosis: { type: Type.STRING },
          satisfactionLevel: { type: Type.STRING },
          positives: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                theme: { type: Type.STRING },
                frequency: { type: Type.STRING },
                example: { type: Type.STRING },
                source: { type: Type.STRING },
              },
            },
          },
          recurringComplaints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                theme: { type: Type.STRING },
                frequency: { type: Type.STRING },
                example: { type: Type.STRING },
                source: { type: Type.STRING },
              },
            },
          },
          negatives: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                theme: { type: Type.STRING },
                frequency: { type: Type.STRING },
                example: { type: Type.STRING },
                source: { type: Type.STRING },
              },
            },
          },
          improvementOpportunities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          salesAndMarginImpact: { type: Type.STRING },
          dataLimitations: { type: Type.STRING },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  const parsed = safeJsonParse<Partial<ConsumerPerceptionDiagnosis>>(response.text, {});
  return {
    hasSufficientData: true,
    summary:
      parsed.summary ||
      parsed.overallPerceptionDiagnosis ||
      'Diagnóstico gerado a partir das avaliações capturadas.',
    overallPerceptionDiagnosis:
      parsed.overallPerceptionDiagnosis ||
      parsed.summary ||
      'Diagnóstico consolidado dos canais consultados.',
    satisfactionLevel: parsed.satisfactionLevel || 'Em monitoramento',
    positives: parsed.positives || [],
    recurringComplaints: parsed.recurringComplaints || [],
    negatives: parsed.negatives || [],
    improvementOpportunities: parsed.improvementOpportunities || [],
    salesAndMarginImpact:
      parsed.salesAndMarginImpact ||
      'Cruzar a percepção dos clientes com vendas e despesas operacionais para medir retenção.',
    dataLimitations:
      parsed.dataLimitations ||
      'Diagnóstico baseado exclusivamente nas amostras reais sincronizadas/registradas nesta base.',
    recommendations: parsed.recommendations || parsed.improvementOpportunities || [],
    generatedAt: new Date().toISOString(),
  };
}

export async function extractStructuredDataFromContent(params: {
  fileName: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
}) {
  const ai = getAiClient();

  const prompt = `Você é um analista e extrator de documentos empresariais da plataforma Gêmeo Digital.
Analise o arquivo enviado (${params.fileName}, tipo ${params.mimeType}) e faça DUAS tarefas sem inventar nada:
1. RESUMO E DESCOBERTAS: produza um resumo executivo claro do conteúdo real do documento ("documentSummary") e extraia descobertas/insights qualitativos ou quantitativos ("insights") com categoria (Comercial, Marketing, Operações, Custos, Financeiro, Pós-venda, Tributário) e tipo ("oportunidade", "ameaca", "alerta" ou "movimento").
2. MÉTRICAS NUMÉRICAS ("rows"): se o documento contiver tabela ou números claros de data, faturamento em reais, quantidade de pedidos ou perdas em reais, extraia essas linhas. Se for um relatório puramente textual/qualitativo sem série numérica diária/mensal, retorne "rows": [] e preencha "documentSummary" e "insights" normalmente. Nunca invente valores ausentes.`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  const canInline =
    Boolean(params.base64Data) &&
    (params.mimeType.startsWith('image/') || params.mimeType === 'application/pdf');

  if (params.base64Data && canInline) {
    const cleanBase64 = params.base64Data.includes(',')
      ? params.base64Data.split(',')[1]
      : params.base64Data;
    parts.push({
      inlineData: {
        mimeType: params.mimeType,
        data: cleanBase64,
      },
    });
  }

  parts.push({
    text: params.textContent
      ? `${prompt}\n\nCONTEÚDO DO ARQUIVO:\n${params.textContent.slice(0, 18000)}`
      : prompt,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reliability: { type: Type.STRING },
          extractionNote: { type: Type.STRING },
          documentSummary: { type: Type.STRING },
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                detail: { type: Type.STRING },
                kind: { type: Type.STRING },
              },
            },
          },
          rows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                periodDate: { type: Type.STRING },
                revenueReais: { type: Type.NUMBER },
                ordersCount: { type: Type.INTEGER },
                lossesReais: { type: Type.NUMBER },
                note: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  return safeJsonParse(response.text, {
    reliability: 'baixa',
    extractionNote: 'Não foi possível estruturar o arquivo automaticamente.',
    documentSummary: '',
    insights: [] as Array<{ category: string; title: string; detail: string; kind: string }>,
    rows: [] as Array<{
      periodDate: string;
      revenueReais: number;
      ordersCount: number;
      lossesReais: number;
      note: string;
    }>,
  });
}

export interface GroundedCompetitorResult {
  name: string;
  segment: string;
  positioning: string;
  locationDistance: string;
  announcedPriceRange: string;
  shippingInfo: string;
  deliveryDays: string;
  publicRating: string;
  positivesNote: string;
  complaintsNote: string;
  productsPromotions: string;
  differentials: string;
  threatsOpportunities: string;
  lastChangeNote: string;
  consultedAt: string;
  sourceUrl: string;
  channels: string;
  priceComparison: string;
  threatLevel: string;
  reviewSnippets: string[];
}

export async function discoverRegionalCompetitors(params: {
  companyName: string;
  segment: string;
  city: string;
  state: string;
  address?: string;
}): Promise<{
  competitors: GroundedCompetitorResult[];
  groundedLinks: Array<{ title: string; uri: string }>;
  searchSummary: string;
}> {
  const ai = getAiClient();
  const locationText = [params.address, params.city, params.state]
    .filter(Boolean)
    .join(', ');

  if (!params.segment && !locationText) {
    throw new Error(
      'Cadastre o segmento e a localização (cidade/UF) da sua empresa antes de buscar concorrentes na região.'
    );
  }

  const consultedAt = new Date().toLocaleDateString('pt-BR');

  // Step 1a: Google Maps Grounding ONLY (never mix responseMimeType/responseSchema or googleSearch)
  const mapsQuery = `Encontre empresas e estabelecimentos concorrentes reais no segmento de "${params.segment || 'comércio local'}" próximos a "${locationText || 'Brasil'}", excluindo "${params.companyName}".
Para cada concorrente encontrado no Google Maps, informe:
- Nome oficial no Google Maps
- Endereço / bairro e distância aproximada em relação a "${locationText || params.city || 'a região'}"
- Segmento específico e posicionamento
- Avaliação pública (nota média e quantidade de avaliações, se visível)
- Principais elogios e pontos positivos citados por clientes
- Principais reclamações e pontos negativos citados por clientes
- Diferenciais e canais visíveis (loja física, delivery, site, WhatsApp, etc.)`;

  const mapsResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: mapsQuery,
    config: {
      tools: [{ googleMaps: {} }],
    },
  });

  const rawChunks =
    (mapsResponse.candidates?.[0]?.groundingMetadata?.groundingChunks as Array<{
      maps?: {
        uri?: string;
        title?: string;
        placeAnswerSources?: {
          reviewSnippets?: Array<{
            text?: string;
            originalText?: { text?: string };
            relativePublishTimeDescription?: string;
          }>;
        };
      };
    }>) || [];

  const groundedPlaces = rawChunks
    .filter((c) => c.maps?.uri || c.maps?.title)
    .map((c) => {
      const snippets = (c.maps?.placeAnswerSources?.reviewSnippets || [])
        .map((s) => s.text || s.originalText?.text || '')
        .filter(Boolean);
      return {
        title: c.maps?.title || 'Local encontrado no Google Maps',
        uri: c.maps?.uri || '',
        reviewSnippets: snippets,
      };
    });

  const groundedText = mapsResponse.text || '';

  if (groundedPlaces.length === 0 && !groundedText.trim()) {
    return {
      competitors: [],
      groundedLinks: [],
      searchSummary:
        'Nenhum estabelecimento concorrente foi retornado pelo Google Maps para esta região/segmento.',
    };
  }

  // Step 1b: Optional Google Search Grounding ONLY on discovered competitor names for public site/social/promos
  let webPublicInfo = '';
  const entityNames = groundedPlaces
    .map((p) => p.title)
    .filter(Boolean)
    .slice(0, 5);
  if (entityNames.length > 0) {
    try {
      const searchRes = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Pesquise informações públicas na web (site oficial, redes sociais, produtos/serviços divulgados e promoções ou faixas de preço publicamente anunciadas) para estes estabelecimentos reais em "${params.city || locationText}": ${entityNames.join('; ')}. Relate apenas o que estiver publicado publicamente e não invente preços nem promoções caso não existam.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      webPublicInfo = searchRes.text || '';
    } catch {
      webPublicInfo = '';
    }
  }

  // Step 2: Structure strictly from grounded Maps + Web data
  const structureResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Organize em JSON até 5 concorrentes reais encontrados para a empresa "${params.companyName}" (${params.segment}, ${locationText}).

TEXTO DO GOOGLE MAPS GROUNDING:
${groundedText}

LOCAIS E AVALIAÇÕES EXTRAÍDOS (groundingChunks):
${JSON.stringify(groundedPlaces, null, 2)}

INFORMAÇÕES PÚBLICAS ADICIONAIS ENCONTRADAS NA WEB:
${webPublicInfo || 'Nenhuma informação web complementar retornada.'}

DATA DA CONSULTA: ${consultedAt}

REGRAS ESTRITAS:
1. Inclua APENAS concorrentes explicitamente presentes nos dados acima. NUNCA invente empresas, notas, preços ou promoções.
2. Associe o campo "sourceUrl" ao link exato "uri" correspondente nos groundingChunks (se houver).
3. Preencha separadamente "positivesNote" (pontos positivos e elogios públicos) e "complaintsNote" (pontos negativos e reclamações públicas). Se não houver reclamação visível, diga "Nenhuma reclamação relevante visível nas avaliações consultadas".
4. Em "productsPromotions", cite apenas produtos, serviços ou promoções realmente visíveis nas fontes consultadas; se não houver, preencha "Não divulgado publicamente nas fontes consultadas".
5. Em "locationDistance", informe endereço/bairro e distância aproximada (ou "Região de ${params.city || 'atuação'}").
6. Em "differentials", cite os diferenciais competitivos percebidos; em "threatsOpportunities", explique a ameaça ou oportunidade para "${params.companyName}".
7. Em "priceComparison", use apenas "Similar", "Abaixo", "Acima" ou "Não informado".
8. Em "threatLevel", classifique como "Impacto alto", "Impacto médio" ou "Impacto baixo".`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          searchSummary: { type: Type.STRING },
          competitors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                segment: { type: Type.STRING },
                positioning: { type: Type.STRING },
                locationDistance: { type: Type.STRING },
                announcedPriceRange: { type: Type.STRING },
                shippingInfo: { type: Type.STRING },
                deliveryDays: { type: Type.STRING },
                publicRating: { type: Type.STRING },
                positivesNote: { type: Type.STRING },
                complaintsNote: { type: Type.STRING },
                productsPromotions: { type: Type.STRING },
                differentials: { type: Type.STRING },
                threatsOpportunities: { type: Type.STRING },
                lastChangeNote: { type: Type.STRING },
                consultedAt: { type: Type.STRING },
                sourceUrl: { type: Type.STRING },
                channels: { type: Type.STRING },
                priceComparison: { type: Type.STRING },
                threatLevel: { type: Type.STRING },
                reviewSnippets: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    },
  });

  const structured = safeJsonParse<{
    searchSummary?: string;
    competitors?: GroundedCompetitorResult[];
  }>(structureResponse.text, { competitors: [] });

  return {
    competitors: (structured.competitors || [])
      .filter(
        (c) =>
          c.name &&
          c.name.toLowerCase().trim() !== params.companyName.toLowerCase().trim()
      )
      .map((c) => ({
        ...c,
        consultedAt: c.consultedAt || consultedAt,
      })),
    groundedLinks: groundedPlaces
      .filter((p) => p.uri)
      .map((p) => ({ title: p.title, uri: p.uri })),
    searchSummary:
      structured.searchSummary ||
      `Busca regional concluída via Google Maps para ${params.segment} em ${locationText}.`,
  };
}

export interface MacroInterpretationItem {
  indicatorCode: string;
  indicatorLabel: string;
  plainExplanation: string;
  businessEffect: string;
  practicalTip: string;
}

export async function interpretMacroForSegment(params: {
  companyName: string;
  segment: string;
  cityState: string;
  macroIndicators: MacroIndicator[];
}): Promise<MacroInterpretationItem[]> {
  const ai = getAiClient();
  const validIndicators = params.macroIndicators.filter((m) => m.status === 'ok');
  if (validIndicators.length === 0) {
    return [];
  }

  const res = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Explique em português simples e acessível para um empreendedor (sem jargões financeiros difíceis) o que cada indicador econômico abaixo significa na prática para a empresa "${params.companyName}" (Segmento: "${params.segment || 'Comércio/Serviços'}", Região: "${params.cityState || 'Brasil'}").

INDICADORES OFICIAIS ATUAIS:
${validIndicators
  .map(
    (m) =>
      `- Código: ${m.code} | Nome: ${m.label} | Valor atual: ${m.value} ${m.unit} | Comparação: ${m.comparisonText || 'N/A'} | Ref: ${m.referenceDate} | Fonte: ${m.source}`
  )
  .join('\n')}

Para cada indicador listado acima, gere um item no array "interpretations" com:
- "indicatorCode": exatamente o Código listado acima
- "indicatorLabel": nome do indicador
- "plainExplanation": o que esse número significa de forma fácil
- "businessEffect": como esse número mexe nas vendas, nos custos, no estoque ou no bolso do cliente do segmento "${params.segment || 'deste negócio'}"
- "practicalTip": 1 atitude prática simples para o gestor tomar agora.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          interpretations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                indicatorCode: { type: Type.STRING },
                indicatorLabel: { type: Type.STRING },
                plainExplanation: { type: Type.STRING },
                businessEffect: { type: Type.STRING },
                practicalTip: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const parsed = safeJsonParse<{ interpretations?: MacroInterpretationItem[] }>(res.text, {
    interpretations: [],
  });
  return parsed.interpretations || [];
}

export interface GeneratedIntelligenceBundle {
  radarSignals: Array<{
    category: string;
    kind: 'oportunidade' | 'ameaca' | 'movimento' | 'pendente';
    impactLabel: string;
    title: string;
    summary: string;
    sourceName: string;
    sourceUrl?: string;
    publishedDate?: string;
    lastCheckedDate?: string;
    relevance: string;
    potentialImpact: string;
    recommendation: string;
  }>;
  verifications: Array<{
    category: string;
    title: string;
    description: string;
    impactNote: string;
    sourceName: string;
    relevance?: string;
    recommendation?: string;
    statusNote?: string;
  }>;
  swot: Array<{
    category: 'Força' | 'Fraqueza' | 'Oportunidade' | 'Ameaça';
    title: string;
    description: string;
  }>;
  pestel: Array<{
    category: string;
    title: string;
    description: string;
    priority: 'alta' | 'media' | 'baixa';
  }>;
  porter: Array<{
    category: string;
    title: string;
    description: string;
    priority: 'alta' | 'media' | 'baixa';
  }>;
  tows: Array<{
    category: string;
    title: string;
    description: string;
  }>;
  analyses: Array<{
    category: string;
    classification?: 'oportunidade' | 'ameaca' | 'atencao';
    title: string;
    problem?: string;
    description: string;
    evidenceSummary?: string;
    dataSourcesUsed?: string;
    impactNote: string;
    strategicRecommendation?: string;
    justification?: string;
    originSignals: Array<{ kind: string; text: string }>;
  }>;
  decisions: Array<{
    title: string;
    priority: 'alta' | 'media' | 'baixa';
    problem: string;
    evidence: string;
    justification?: string;
    suggestedAction: string;
    expectedOutcome: string;
    kpisToTrack?: string;
    dueDate: string;
  }>;
  opportunities: Array<{
    category: string;
    title: string;
    description: string;
    impactNote: string;
    priority: 'alta' | 'media' | 'baixa';
  }>;
  macroInterpretations: MacroInterpretationItem[];
  groundedWebSources: Array<{ title: string; uri: string }>;
}

export async function generateCompanyIntelligenceBundle(params: {
  snapshot: CompanyContextSnapshot;
  documentsText: string;
  focus?: 'all' | 'radar' | 'strategy';
}): Promise<GeneratedIntelligenceBundle> {
  const ai = getAiClient();
  const todayStr = new Date().toLocaleDateString('pt-BR');

  // Step 1: Google Search grounding for real sector / regulatory / local market news
  let webContext = '';
  let groundedWebSources: Array<{ title: string; uri: string }> = [];
  try {
    const searchRes = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Pesquise notícias, tendências de mercado recentes, movimentações do setor "${params.snapshot.segment || 'comércio e serviços'}", e mudanças regulatórias/tributárias vigentes no Brasil e em "${params.snapshot.cityState || 'Brasil'}" que afetam empresas desse segmento (ex.: comportamento de consumo, logística, fornecedores, normas setoriais, transição tributária). Resuma apenas fatos reais verificados com a data de publicação aproximada/exata e a fonte.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    webContext = searchRes.text || '';
    const webChunks =
      (searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks as Array<{
        web?: { uri?: string; title?: string };
      }>) || [];
    groundedWebSources = webChunks
      .filter((c) => c.web?.uri)
      .slice(0, 8)
      .map((c) => ({
        title: c.web?.title || 'Fonte externa',
        uri: c.web?.uri || '',
      }));
  } catch {
    webContext = 'Busca web adicional indisponível neste ciclo; utilize exclusivamente os indicadores oficiais e os registros internos da empresa.';
  }

  // Step 2: Generate structured intelligence bundle grounded strictly in company + macro + web search
  const prompt = `Você é o motor central de inteligência estratégica da plataforma Gêmeo Digital.
Gere uma atualização completa, cruzada e rastreável de Radar de Mercado, Informações a Verificar, SWOT/FOFA, PESTEL, 5 Forças de Porter, Matriz TOWS, Análises Estratégicas (Análises em curso), Oportunidades, Decisões Recomendadas e Interpretações Macroeconômicas para a empresa abaixo.

EMPRESA:
- Nome: ${params.snapshot.companyName}
- Segmento: ${params.snapshot.segment || 'Não informado'}
- Localização: ${params.snapshot.cityState || 'Não informada'}
- Operação: ${params.snapshot.operationType}
- Descrição: ${params.snapshot.description || 'Não informada'}

DOCUMENTOS E RELATÓRIOS IMPORTADOS PELO USUÁRIO:
${params.documentsText || 'Nenhum documento importado ainda.'}

MÉTRICAS INTERNAS:
${params.snapshot.recentMetricsSummary}

GESTÃO FINANCEIRA, DRE E ESTOQUE (RESUMO DAS 6 ABAS):
${params.snapshot.financialSummaryText || 'Sem registros detalhados de Vendas/Custos/Despesas/Estoque ainda.'}

CATÁLOGO DE PRODUTOS:
${params.snapshot.topProductsSummary}

CONCORRENTES MONITORADOS (GOOGLE MAPS & PESQUISA PÚBLICA):
${params.snapshot.competitorsSummary}

REPUTAÇÃO E PERCEPÇÃO DOS CONSUMIDORES (GOOGLE REVIEWS & RECLAME AQUI):
${params.snapshot.reputationSummaryText || 'Sem métricas consolidadas de reputação externa.'}

AVALIAÇÕES DE CONSUMIDORES:
${params.snapshot.reviewsSummary}

INDICADORES MACROECONÔMICOS OFICIAIS (BCB / IBGE / SEFAZ):
${params.snapshot.macroIndicators
  .map((m) => `- ${m.code} (${m.label}): ${m.status === 'ok' ? `${m.value} ${m.unit} (${m.comparisonText || ''}) - Fonte: ${m.source}` : 'Indisponível'}`)
  .join('\n')}

PESQUISA SETORIAL E REGULATÓRIA (Google Search - Data da consulta: ${todayStr}):
${webContext}
Fontes web encontradas: ${JSON.stringify(groundedWebSources)}

REGRAS CRÍTICAS DE QUALIDADE E SEPARAÇÃO DE ABAS:
1. NUNCA invente vendas, faturamento, custos ou reclamações que não estejam nos dados acima. Se faltarem métricas financeiras ou documentos, escreva explicitamente nas evidências/justificativas: "A investigar — cadastre métricas/documentos internos para quantificar este impacto."
2. **RADAR DE MERCADO ("radarSignals")**: Deve focar EXCLUSIVAMENTE em mudanças externas de mercado, setor, concorrência, consumo, legislação ou tendências setoriais (NÃO coloque repetição isolada de números de Selic/IPCA/Dólar aqui, pois estes ficam na aba Macroeconômica). Use categorias entre: "Concorrência", "Setor", "Custos", "Canais", "Eventos", "Tributação", "Legislação", "Consumidor". Informe "publishedDate" (data da notícia/fato ou mês/ano identificado na fonte) e "lastCheckedDate" ("${todayStr}"). Em "kind", use estritamente: "oportunidade", "ameaca", "movimento" ou "pendente".
3. **INFORMAÇÕES A VERIFICAR ("verifications")**: 2 a 4 afirmações, rumores ou temas em discussão que ainda precisam de validação prática antes de virar decisão. Preencha "relevance", "recommendation" (o que verificar na prática) e "statusNote" ("Pendente de confirmação").
4. **SWOT ("swot")**: Exatamente 4 a 8 itens distribuídos nos 4 quadrantes ("Força", "Fraqueza", "Oportunidade", "Ameaça"), cruzando dados reais da empresa + concorrentes + mercado.
5. **PESTEL ("pestel")**: 6 fatores (Político, Econômico, Social, Tecnológico, Ecológico/Ambiental, Legal). **PORTER ("porter")**: 5 forças. **TOWS ("tows")**: 4 quadrantes ("SO", "ST", "WO", "WT").
6. **ANÁLISES EM CURSO ("analyses")**: 3 a 4 análises integradas ligando causa -> evidências reais -> recomendação. Preencha todos os campos: "classification" ("oportunidade" | "ameaca" | "atencao"), "problem" (problema ou ponto identificado), "evidenceSummary" (evidências encontradas), "dataSourcesUsed" (quais informações/documentos/fontes foram usadas), "impactNote" (impacto potencial), "strategicRecommendation" (recomendação estratégica) e "justification" (por que isso importa).
7. **DECISÕES RECOMENDADAS ("decisions")**: 3 a 4 decisões práticas para o gestor aprovar, adiar ou descartar, contendo: "title", "priority", "problem", "evidence", "justification" (por que tomar esta decisão agora), "suggestedAction", "expectedOutcome", "kpisToTrack" (quais indicadores acompanhar após aprovar) e "dueDate".
8. **INTERPRETAÇÕES MACROECONÔMICAS ("macroInterpretations")**: Explique em português muito simples como os principais indicadores disponíveis (SELIC, IPCA, IPCA_ANO, CAMBIO, PIB_REAL, DESEMPREGO, ICMS) impactam especificamente o setor "${params.snapshot.segment || 'desta empresa'}".`;

  const res = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          radarSignals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                kind: { type: Type.STRING },
                impactLabel: { type: Type.STRING },
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                sourceName: { type: Type.STRING },
                sourceUrl: { type: Type.STRING },
                publishedDate: { type: Type.STRING },
                lastCheckedDate: { type: Type.STRING },
                relevance: { type: Type.STRING },
                potentialImpact: { type: Type.STRING },
                recommendation: { type: Type.STRING },
              },
            },
          },
          verifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                impactNote: { type: Type.STRING },
                sourceName: { type: Type.STRING },
                relevance: { type: Type.STRING },
                recommendation: { type: Type.STRING },
                statusNote: { type: Type.STRING },
              },
            },
          },
          swot: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          pestel: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING },
              },
            },
          },
          porter: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING },
              },
            },
          },
          tows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          analyses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                classification: { type: Type.STRING },
                title: { type: Type.STRING },
                problem: { type: Type.STRING },
                description: { type: Type.STRING },
                evidenceSummary: { type: Type.STRING },
                dataSourcesUsed: { type: Type.STRING },
                impactNote: { type: Type.STRING },
                strategicRecommendation: { type: Type.STRING },
                justification: { type: Type.STRING },
                originSignals: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      kind: { type: Type.STRING },
                      text: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
          decisions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                priority: { type: Type.STRING },
                problem: { type: Type.STRING },
                evidence: { type: Type.STRING },
                justification: { type: Type.STRING },
                suggestedAction: { type: Type.STRING },
                expectedOutcome: { type: Type.STRING },
                kpisToTrack: { type: Type.STRING },
                dueDate: { type: Type.STRING },
              },
            },
          },
          opportunities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                impactNote: { type: Type.STRING },
                priority: { type: Type.STRING },
              },
            },
          },
          macroInterpretations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                indicatorCode: { type: Type.STRING },
                indicatorLabel: { type: Type.STRING },
                plainExplanation: { type: Type.STRING },
                businessEffect: { type: Type.STRING },
                practicalTip: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const parsed = safeJsonParse<Omit<GeneratedIntelligenceBundle, 'groundedWebSources'>>(res.text, {
    radarSignals: [],
    verifications: [],
    swot: [],
    pestel: [],
    porter: [],
    tows: [],
    analyses: [],
    decisions: [],
    opportunities: [],
    macroInterpretations: [],
  });

  return {
    ...parsed,
    macroInterpretations: parsed.macroInterpretations || [],
    groundedWebSources,
  };
}

export async function generateActionPlansForDecision(params: {
  companyName: string;
  segment: string;
  decisionTitle: string;
  problem: string;
  suggestedAction: string;
  expectedOutcome: string;
  kpisToTrack?: string;
}): Promise<
  Array<{
    title: string;
    description: string;
    owner: string;
    dueDate: string;
    priority: 'alta' | 'media' | 'baixa';
    resources: string;
    kpi: string;
  }>
> {
  const ai = getAiClient();
  const res = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `A empresa "${params.companyName}" (${params.segment || 'PME'}) acabou de APROVAR a seguinte decisão estratégica:
- Decisão: ${params.decisionTitle}
- Problema: ${params.problem}
- Ação sugerida: ${params.suggestedAction}
- Resultado esperado: ${params.expectedOutcome}
- Indicadores citados na decisão: ${params.kpisToTrack || 'Vendas, margem e satisfação do cliente'}

Quebre esta decisão em 3 atividades práticas e executáveis para o Plano de Ação em linguagem simples.
Para cada atividade, defina obrigatoriamente:
- title (nome objetivo da atividade)
- description (passo a passo claro para a equipe executar)
- owner (área ou cargo responsável)
- dueDate (prazo prático ex: "Em 7 dias", "Em 15 dias")
- priority ("alta", "media" ou "baixa")
- resources (recursos necessários: orçamento aproximado, ferramentas ou horas da equipe)
- kpi (indicador claro de desempenho para saber se funcionou)`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                owner: { type: Type.STRING },
                dueDate: { type: Type.STRING },
                priority: { type: Type.STRING },
                resources: { type: Type.STRING },
                kpi: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const parsed = safeJsonParse<{
    tasks?: Array<{
      title: string;
      description: string;
      owner: string;
      dueDate: string;
      priority: 'alta' | 'media' | 'baixa';
      resources: string;
      kpi: string;
    }>;
  }>(res.text, { tasks: [] });

  if (parsed.tasks && parsed.tasks.length > 0) {
    return parsed.tasks.slice(0, 4);
  }
  return [
    {
      title: params.suggestedAction || params.decisionTitle,
      description: `Executar ação derivada da decisão "${params.decisionTitle}".`,
      owner: `Equipe ${params.companyName}`,
      dueDate: 'Em 15 dias',
      priority: 'alta',
      resources: 'Equipe interna e acompanhamento semanal',
      kpi: params.kpisToTrack || 'Cumprimento do prazo e impacto no faturamento',
    },
  ];
}

export async function reviewActionPlansProgress(params: {
  companyName: string;
  segment: string;
  actionPlans: Array<{
    title: string;
    status: string;
    priority: string;
    dueDate: string;
    owner?: string;
    completionPct?: number;
    kpi?: string;
  }>;
  pendingDecisionsCount: number;
}): Promise<{
  overallSummary: string;
  alerts: string[];
  recommendations: string[];
}> {
  if (params.actionPlans.length === 0 && params.pendingDecisionsCount === 0) {
    return {
      overallSummary:
        'Ainda não há planos de ação cadastrados. Aprove uma recomendação na Central de Decisões ou crie uma tarefa manualmente para iniciar o acompanhamento.',
      alerts: [],
      recommendations: [
        'Revise as recomendações pendentes na Central de Decisões para gerar planos de ação automaticamente.',
      ],
    };
  }

  const ai = getAiClient();
  const res = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Avalie o andamento atual dos Planos de Ação da empresa "${params.companyName}" (${params.segment || 'PME'}):
Decisões aguardando aprovação do gestor: ${params.pendingDecisionsCount}
Planos de Ação:
${params.actionPlans
  .map(
    (p, idx) =>
      `${idx + 1}. "${p.title}" | Status: ${p.status} | Prioridade: ${p.priority} | Conclusão: ${p.completionPct ?? 0}% | Prazo: ${p.dueDate} | Responsável: ${p.owner || 'Não definido'} | KPI: ${p.kpi || 'Não definido'}`
  )
  .join('\n')}

Aponte possíveis atrasos, gargalos, decisões pendentes que travam a execução e melhorias práticas em linguagem simples.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallSummary: { type: Type.STRING },
          alerts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  return safeJsonParse(res.text, {
    overallSummary: `Existem ${params.actionPlans.length} ação(ões) monitorada(s) e ${params.pendingDecisionsCount} decisão(ões) aguardando aprovação.`,
    alerts:
      params.pendingDecisionsCount > 0
        ? [`Existem ${params.pendingDecisionsCount} recomendações aguardando sua decisão na Central de Decisões.`]
        : [],
    recommendations: [
      'Priorize tarefas de prioridade alta com percentual de conclusão abaixo de 50%.',
    ],
  });
}

export async function adviseScenarioGoal(params: {
  companyName: string;
  segment: string;
  hasSufficientData: boolean;
  macroIndicators: MacroIndicator[];
  assumptions: {
    horizonDays: number;
    avgSalesVariationPct: number;
    productionIncreasePct: number;
    currentProducedUnits: number;
    estimatedDemandUnits: number;
    unitPriceReais: number;
    fixedCostsReais: number;
    variableCostPerUnit: number;
    marginalCostPerUnit: number;
    marginalProductUnits: number;
    extraEmployeesCount: number;
    employeeCostReais: number;
    targetProfitReais: number;
  };
  computed: {
    worthIncreasingProduction: boolean;
    marginalRevenuePerUnit: number;
    contributionMarginPerUnit: number;
    projectedRevenueReais: number;
    projectedProfitReais: number;
    breakEvenUnits: number;
    successChancePct: number | null;
    fourScenarios: Array<{
      name: string;
      revenueReais: number;
      totalCostsReais: number;
      profitReais: number;
      marginPct: number;
    }>;
  };
}): Promise<{
  verdictSimple: string;
  explanationSimple: string;
  worthIncreasingProductionAnswer: string;
  worthHiringAnswer: string;
  salesCompensateCostsAnswer: string;
  costIncreaseImpactAnswer: string;
  salesNeededForGoalAnswer: string;
  profitabilityMeasuresAnswer: string;
  suggestions: string[];
}> {
  const ai = getAiClient();
  const res = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Você é um consultor financeiro e econômico que conversa com pequenos e médios empreendedores em português MUITO CLARO E SEM TERMOS TÉCNICOS DIFÍCEIS.

EMPRESA: ${params.companyName} (${params.segment || 'Comércio/Serviços'})
Possui base financeira/produtos reais suficientes no sistema? ${params.hasSufficientData ? 'SIM' : 'NÃO (faltam métricas financeiras e/ou produtos cadastrados)'}

PARÂMETROS DA SIMULAÇÃO (${params.assumptions.horizonDays} dias):
- Variação média de vendas simulada: ${params.assumptions.avgSalesVariationPct}%
- Aumento de produção planejado: ${params.assumptions.productionIncreasePct}%
- Quantidade produzida/ofertada base: ${params.assumptions.currentProducedUnits} un./mês
- Demanda estimada no período: ${params.assumptions.estimatedDemandUnits} un.
- Preço médio de venda: R$ ${params.assumptions.unitPriceReais.toFixed(2)}
- Custos fixos mensais (aluguel, energia, folha base, etc.): R$ ${params.assumptions.fixedCostsReais.toLocaleString('pt-BR')}
- Custo variável por unidade: R$ ${params.assumptions.variableCostPerUnit.toFixed(2)}
- Margem de contribuição por unidade (quanto sobra de cada venda para pagar custos fixos e gerar lucro): R$ ${params.computed.contributionMarginPerUnit.toFixed(2)}
- Custo marginal (custo de produzir/comprar 1 unidade extra): R$ ${params.assumptions.marginalCostPerUnit.toFixed(2)}
- Produto marginal (unidades extras geradas): ${params.assumptions.marginalProductUnits} un.
- Contratação de novos funcionários simulada: ${params.assumptions.extraEmployeesCount} pessoa(s) a R$ ${params.assumptions.employeeCostReais.toLocaleString('pt-BR')}/mês cada
- Ponto de equilíbrio (vendas mínimas para não ter prejuízo): ${params.computed.breakEvenUnits} un./mês
- Meta de lucro desejada: R$ ${params.assumptions.targetProfitReais.toLocaleString('pt-BR')}
- Lucro projetado no cenário atual simulado: R$ ${params.computed.projectedProfitReais.toLocaleString('pt-BR')}
- Probabilidade estatística estimada de atingir a meta: ${params.computed.successChancePct !== null ? `${params.computed.successChancePct}%` : 'A investigar (sem base histórica suficiente)'}

COMPARAÇÃO ENTRE OS 4 CENÁRIOS:
${params.computed.fourScenarios
  .map((s) => `- ${s.name}: Faturamento R$ ${s.revenueReais.toLocaleString('pt-BR')} | Custos R$ ${s.totalCostsReais.toLocaleString('pt-BR')} | Lucro R$ ${s.profitReais.toLocaleString('pt-BR')} (${s.marginPct}%)`)
  .join('\n')}

INDICADORES MACROECONÔMICOS OFICIAIS:
${params.macroIndicators.map((m) => `- ${m.label}: ${m.value ?? 'Indisponível'} ${m.unit}`).join('\n')}

Responda em JSON respondendo objetivamente às 6 dúvidas centrais do empresário em linguagem simples:
1. "verdictSimple": resumo direto do cenário simulado.
2. "explanationSimple": explicação simples conectando margem de contribuição, Selic, inflação/IPCA e ICMS.
3. "worthIncreasingProductionAnswer": "Vale a pena aumentar a produção agora?" (use custo marginal x produto marginal x demanda).
4. "worthHiringAnswer": "Vale a pena contratar novos funcionários?" (avalie se os funcionários extras geram mais retorno do que o custo salarial simulado).
5. "salesCompensateCostsAnswer": "O aumento das vendas compensa os novos custos?"
6. "costIncreaseImpactAnswer": "Qual o impacto caso os custos de insumos/energia/impostos aumentem?"
7. "salesNeededForGoalAnswer": "Quanto preciso vender para alcançar o lucro desejado de R$ ${params.assumptions.targetProfitReais.toLocaleString('pt-BR')}?" (cite unidades ou faturamento necessário).
8. "profitabilityMeasuresAnswer": "Quais medidas ajudam a melhorar minha lucratividade?"
9. "suggestions": 4 passos práticos recomendados.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verdictSimple: { type: Type.STRING },
          explanationSimple: { type: Type.STRING },
          worthIncreasingProductionAnswer: { type: Type.STRING },
          worthHiringAnswer: { type: Type.STRING },
          salesCompensateCostsAnswer: { type: Type.STRING },
          costIncreaseImpactAnswer: { type: Type.STRING },
          salesNeededForGoalAnswer: { type: Type.STRING },
          profitabilityMeasuresAnswer: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  const breakEvenSalesNeed =
    params.computed.contributionMarginPerUnit > 0
      ? Math.ceil(
          (params.assumptions.fixedCostsReais * (params.assumptions.horizonDays / 30) +
            params.assumptions.extraEmployeesCount *
              params.assumptions.employeeCostReais *
              (params.assumptions.horizonDays / 30) +
            params.assumptions.targetProfitReais) /
            params.computed.contributionMarginPerUnit
        )
      : 0;

  return safeJsonParse(res.text, {
    verdictSimple: params.computed.worthIncreasingProduction
      ? 'Sim, o cenário mostra espaço para expandir a produção com controle de custos.'
      : 'Atenção: expandir agora com esses custos pressiona sua margem e exige mais vendas para empatar.',
    explanationSimple:
      'Cada venda precisa primeiro cobrir o custo direto do produto e contribuir para pagar aluguel, equipe e juros. Só depois disso o valor vira lucro livre.',
    worthIncreasingProductionAnswer: params.computed.worthIncreasingProduction
      ? `Sim, pois cada unidade extra deixa cerca de R$ ${params.computed.contributionMarginPerUnit.toFixed(2)} acima do custo marginal e há demanda prevista.`
      : 'Não no ritmo simulado: o custo adicional por unidade e os juros comprimem o ganho ou faltará demanda para escoar o estoque.',
    worthHiringAnswer:
      params.assumptions.extraEmployeesCount > 0
        ? `Contratar ${params.assumptions.extraEmployeesCount} pessoa(s) adiciona R$ ${(params.assumptions.extraEmployeesCount * params.assumptions.employeeCostReais).toLocaleString('pt-BR')}/mês em custos fixos. Só compensa se a equipe nova elevar a produção e as vendas acima desse custo.`
        : 'Nenhuma contratação extra foi marcada nesta simulação. Se precisar contratar, garanta antes que a margem extra pague o novo salário com folga.',
    salesCompensateCostsAnswer:
      params.computed.projectedProfitReais > 0
        ? `Sim: no cenário simulado o faturamento projetado de R$ ${params.computed.projectedRevenueReais.toLocaleString('pt-BR')} cobre os custos totais e deixa lucro positivo.`
        : 'Ainda não compensa: os custos fixos, variáveis e contratações superam o retorno das vendas simuladas.',
    costIncreaseImpactAnswer:
      'Um aumento nos custos de mercadorias, frete ou impostos reduz a margem de cada unidade vendida e obriga o negócio a vender mais unidades apenas para não fechar no vermelho.',
    salesNeededForGoalAnswer:
      breakEvenSalesNeed > 0
        ? `Com a margem atual de R$ ${params.computed.contributionMarginPerUnit.toFixed(2)} por unidade, você precisa vender cerca de ${breakEvenSalesNeed.toLocaleString('pt-BR')} unidades (aprox. R$ ${(breakEvenSalesNeed * params.assumptions.unitPriceReais).toLocaleString('pt-BR')}) no período para bater a meta de lucro.`
        : 'A investigar — informe preço de venda superior ao custo variável para calcular o volume exato necessário.',
    profitabilityMeasuresAnswer:
      'Renegocie insumos para baixar o custo variável, priorize produtos de maior margem de contribuição, revise despesas fixas e aumente o ticket médio com combos.',
    suggestions: [
      'Acompanhe semanalmente a margem de contribuição dos seus 5 produtos mais vendidos.',
      'Evite contratações fixas antes de confirmar demanda estável por pelo menos 60 dias.',
      'Use o comparativo entre os cenários Pessimista e Otimista para manter reserva de caixa.',
      'Revise preços caso a inflação (IPCA) ou o custo de reposição suba acima da sua margem.',
    ],
  });
}

export interface ExtractedProductCatalogRow {
  sku: string;
  name: string;
  priceReais: number;
  costReais?: number;
  stockQty: number;
  categoryName?: string;
}

export interface ExtractedProductSalesRow {
  sku: string;
  name: string;
  soldUnits: number;
  priceReais?: number;
}

export async function extractProductCatalogOrSalesFromContent(params: {
  mode: 'catalog' | 'sales';
  fileName: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
}) {
  const ai = getAiClient();

  const prompt =
    params.mode === 'catalog'
      ? `Você é um extrator rigoroso de catálogos de produtos e inventário de estoque.
Analise o documento enviado (${params.fileName}, tipo ${params.mimeType}) e extraia EXCLUSIVAMENTE os produtos reais encontrados no arquivo.
Para cada produto, retorne:
- "sku": código ou SKU do produto (string vazia "" se não houver no documento)
- "name": nome completo do produto
- "priceReais": preço unitário de venda em reais (número decimal, ex: 149.9; 0 se não informado)
- "costReais": custo unitário de aquisição em reais (0 se não informado)
- "stockQty": quantidade atual em estoque (inteiro; 0 se não informado)
- "categoryName": categoria do produto se explícita no arquivo (string vazia "" se ausente).
NUNCA invente produtos, códigos, preços ou estoques que não estejam no arquivo.`
      : `Você é um extrator rigoroso de relatórios de vendas por produto.
Analise o documento enviado (${params.fileName}, tipo ${params.mimeType}) e extraia EXCLUSIVAMENTE os produtos e suas respectivas quantidades/unidades vendidas encontradas no arquivo.
Para cada item encontrado, retorne:
- "sku": código ou SKU do produto (string vazia "" se não houver no documento)
- "name": nome do produto
- "soldUnits": quantidade de unidades vendidas (inteiro positivo; 0 se ilegível)
- "priceReais": preço unitário caso conste no relatório (0 se não informado).
NUNCA invente produtos ou quantidades vendidas que não estejam no documento.`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  const canInline =
    Boolean(params.base64Data) &&
    (params.mimeType.startsWith('image/') || params.mimeType === 'application/pdf');

  if (params.base64Data && canInline) {
    const cleanBase64 = params.base64Data.includes(',')
      ? params.base64Data.split(',')[1]
      : params.base64Data;
    parts.push({
      inlineData: {
        mimeType: params.mimeType,
        data: cleanBase64,
      },
    });
  }

  parts.push({
    text: params.textContent
      ? `${prompt}\n\nCONTEÚDO EXTRAÍDO DO ARQUIVO:\n${params.textContent.slice(0, 20000)}`
      : prompt,
  });

  if (params.mode === 'catalog') {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            note: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sku: { type: Type.STRING },
                  name: { type: Type.STRING },
                  priceReais: { type: Type.NUMBER },
                  costReais: { type: Type.NUMBER },
                  stockQty: { type: Type.INTEGER },
                  categoryName: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });
    const parsed = safeJsonParse<{ note?: string; items?: ExtractedProductCatalogRow[] }>(
      response.text,
      { note: 'Nenhum item identificado no arquivo.', items: [] }
    );
    return {
      mode: 'catalog' as const,
      note: parsed.note || `${(parsed.items || []).length} produto(s) identificado(s) no documento.`,
      items: (parsed.items || []).filter((it) => it && String(it.name || '').trim().length > 0),
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          note: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sku: { type: Type.STRING },
                name: { type: Type.STRING },
                soldUnits: { type: Type.INTEGER },
                priceReais: { type: Type.NUMBER },
              },
            },
          },
        },
      },
    },
  });
  const parsed = safeJsonParse<{ note?: string; items?: ExtractedProductSalesRow[] }>(
    response.text,
    { note: 'Nenhum registro de venda identificado no arquivo.', items: [] }
  );
  return {
    mode: 'sales' as const,
    note: parsed.note || `${(parsed.items || []).length} item(ns) vendido(s) identificado(s).`,
    items: (parsed.items || []).filter((it) => it && String(it.name || it.sku || '').trim().length > 0),
  };
}

export async function analyzeCompetitiveLandscapeGeo(params: {
  company: {
    name: string;
    segment: string;
    cnae: string;
    cityState: string;
    operationType: string;
    productsSummary: string;
  };
  radiusKm: number;
  places: Array<{
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
}) {
  if (params.places.length === 0) {
    return {
      classifiedPlaces: [],
      executiveSummary:
        'Nenhum estabelecimento retornado na busca para classificar. Amplie o raio ou ajuste os filtros de segmento.',
      confirmedData: ['Consulta executada sem estabelecimentos elegíveis neste recorte geográfico.'],
      estimatedData: [],
      hypotheses: [],
      unavailableData: [
        'Faturamento, margem, lucro líquido e participação de mercado (market share) reais de concorrentes privados não são públicos.',
      ],
      advantageVsFragility: [],
      swotLocal: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
    };
  }

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Você é um analista sênior de Inteligência Competitiva e Geomarketing do Gêmeo Digital.

EMPRESA ANALISADA:
- Nome: ${params.company.name}
- Segmento: ${params.company.segment || 'Não informado'}
- CNAE: ${params.company.cnae || 'Não informado'}
- Operação: ${params.company.operationType} | Localização: ${params.company.cityState || 'Não informada'}
- Portfólio/Produtos: ${params.company.productsSummary || 'Não cadastrado ainda'}
- Raio de análise: ${params.radiusKm} km

ESTABELECIMENTOS REAIS ENCONTRADOS VIA GOOGLE PLACES API (NEW):
${params.places
  .map(
    (p, idx) =>
      `[${idx + 1}] ID="${p.placeId}" | Nome="${p.name}" | Categoria="${p.primaryTypeLabel}" | Distância=${p.distanceKm}km (${p.travelTimeText || 'linha reta'}) | Nota=${p.rating ?? 'N/A'} (${p.userRatingCount} avaliações) | Preço=${p.priceLevel} | Site=${p.website || 'Sem site divulgado'} | Status=${p.businessStatus} | Endereço="${p.address}"`
  )
  .join('\n')}

REGRAS OBRIGATÓRIAS:
1. Classifique CADA estabelecimento por "placeId" como:
   - "direct": Concorrente direto (mesmo segmento/oferta/público principal)
   - "indirect": Concorrente indireto (atende necessidade substituta ou mix parcial)
   - "potential": Concorrente potencial (pode expandir para o mesmo público)
2. NUNCA invente faturamento, lucro, volume de vendas ou market share de concorrentes. Declare explicitamente em "unavailableData" o que não está disponível.
3. Separe rigorosamente em 4 listas:
   - "confirmedData": apenas fatos presentes nos dados reais da Places API e da empresa.
   - "estimatedData": interpretações baseadas em proximidade, nota pública, densidade e presença digital (explicite o critério).
   - "hypotheses": hipóteses estratégicas a confirmar em campo.
   - "unavailableData": informações privadas/ausentes que não podem ser afirmadas.
4. Responda em português do Brasil claro e profissional.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          classifiedPlaces: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                placeId: { type: Type.STRING },
                classification: { type: Type.STRING }, // direct | indirect | potential
                rationale: { type: Type.STRING },
                competitiveThreat: { type: Type.STRING }, // Alta | Média | Baixa
              },
            },
          },
          executiveSummary: { type: Type.STRING },
          confirmedData: { type: Type.ARRAY, items: { type: Type.STRING } },
          estimatedData: { type: Type.ARRAY, items: { type: Type.STRING } },
          hypotheses: { type: Type.ARRAY, items: { type: Type.STRING } },
          unavailableData: { type: Type.ARRAY, items: { type: Type.STRING } },
          advantageVsFragility: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                ourAdvantage: { type: Type.STRING },
                competitorStrengthOrGap: { type: Type.STRING },
              },
            },
          },
          swotLocal: {
            type: Type.OBJECT,
            properties: {
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
              threats: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      },
    },
  });

  return safeJsonParse(response.text, {
    classifiedPlaces: params.places.map((p) => ({
      placeId: p.placeId,
      classification: 'indirect',
      rationale: 'Classificação automática baseada na categoria retornada pela Places API.',
      competitiveThreat: 'Média',
    })),
    executiveSummary: 'Análise competitiva gerada sobre os estabelecimentos retornados no raio.',
    confirmedData: [`${params.places.length} estabelecimento(s) localizado(s) em até ${params.radiusKm} km.`],
    estimatedData: [],
    hypotheses: [],
    unavailableData: ['Dados financeiros e faturamento de concorrentes não são divulgados publicamente.'],
    advantageVsFragility: [],
    swotLocal: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
  });
}

export async function analyzeExpansionOpportunitiesGeo(params: {
  companyName: string;
  segment: string;
  cnae: string;
  localities: Array<{
    label: string;
    city: string;
    state: string;
    radiusKm: number;
    competitorsCount: number;
    avgRating: number | null;
    totalReviewsVolume: number;
    population: number | null;
    pibPerCapitaReais: number | null;
    pibTotalMilReais: number | null;
    industrialZonesCount: number;
    commercialZonesCount: number;
    highwaysCount: number;
  }>;
}) {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Você é o Especialista de Expansão Geográfica e Viabilidade Regional do Gêmeo Digital.
Analise comparativamente as localidades abaixo para a empresa "${params.companyName}" (Segmento: "${params.segment}", CNAE: "${params.cnae || 'N/A'}").

LOCALIDADES ANALISADAS COM DADOS REAIS (Google Places + IBGE + OpenStreetMap):
${params.localities
  .map(
    (loc, idx) =>
      `[${idx + 1}] ${loc.label} (${loc.city}/${loc.state}) — Raio: ${loc.radiusKm} km
- Concorrentes no segmento encontrados (Places API): ${loc.competitorsCount} | Nota média: ${loc.avgRating ?? 'N/A'} | Volume de avaliações: ${loc.totalReviewsVolume}
- População municipal (IBGE): ${loc.population !== null ? loc.population.toLocaleString('pt-BR') : 'Indisponível'}
- PIB per capita (IBGE): ${loc.pibPerCapitaReais !== null ? `R$ ${loc.pibPerCapitaReais.toLocaleString('pt-BR')}` : 'Indisponível'}
- Infraestrutura OSM no raio: ${loc.commercialZonesCount} polo(s) comercial(is), ${loc.industrialZonesCount} zona(s) industrial(is), ${loc.highwaysCount} eixo(s) viário(s) principal(is).`
  )
  .join('\n\n')}

REGRAS CRÍTICAS DE DECISÃO:
1. NUNCA conclua que "poucos concorrentes = alta oportunidade" se população ou PIB per capita forem baixos ou indisponíveis! Avalie SEMPRE demanda potencial (população + renda/PIB + polos comerciais) vs. saturação competitiva.
2. Separe explicitamente: Dados Confirmados, Dados Estimados, Hipóteses a validar em campo e Informações Indisponíveis.
3. Indique qual localidade exige cautela por saturação e qual oferece melhor equilíbrio demanda × competição × infraestrutura.
4. Nunca invente faturamento esperado ou lucro garantido.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verdictSummary: { type: Type.STRING },
          localityEvaluations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                demandVsSaturationTag: { type: Type.STRING },
                score0to100: { type: Type.INTEGER },
                pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                cautions: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          confirmedData: { type: Type.ARRAY, items: { type: Type.STRING } },
          estimatedData: { type: Type.ARRAY, items: { type: Type.STRING } },
          hypotheses: { type: Type.ARRAY, items: { type: Type.STRING } },
          unavailableData: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  return safeJsonParse(response.text, {
    verdictSummary:
      'Comparação regional gerada com base nos indicadores demográficos do IBGE, infraestrutura OSM e densidade de concorrentes.',
    localityEvaluations: [],
    confirmedData: [],
    estimatedData: [],
    hypotheses: [],
    unavailableData: ['Fluxo real de pedestres/tráfego local e custo de aluguel comercial exigem pesquisa de campo.'],
  });
}

export async function askGeoMarketAssistant(params: {
  question: string;
  companyName: string;
  segment: string;
  cityState: string;
  activeRadiusKm: number;
  currentCenter: string;
  competitorsSummary: string;
  suppliersSummary: string;
  territorialSummary: string;
  ibgeSummary: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userLatLng?: { latitude: number; longitude: number } | null;
}) {
  const ai = getAiClient();
  const wantsMaps = /\b(rota|rotas|caminho|como chegar|trajeto|google maps|mapa|local|lugares|hor[áa]rio|endere[çc]o|perto|estabelecimento)\b/i.test(
    params.question
  );

  const systemInstruction = `Você é o Analista de Inteligência Geográfica, Mercadológica e Competitiva (Geo-IA) do Gêmeo Digital.

EMPRESA: ${params.companyName} | Segmento: ${params.segment || 'N/A'} | Sede: ${params.cityState || 'N/A'}
CENTRO GEOGRÁFICO ATIVO: ${params.currentCenter} | RAIO: ${params.activeRadiusKm} km

CONCORRENTES / ESTABELECIMENTOS NO RADAR ATUAL:
${params.competitorsSummary || 'Nenhuma busca de concorrentes executada nesta sessão ainda.'}

FORNECEDORES E PARCEIROS SALVOS/BUSCADOS:
${params.suppliersSummary || 'Nenhum fornecedor mapeado ainda.'}

DADOS DEMOGRÁFICOS E ECONÔMICOS (IBGE):
${params.ibgeSummary || 'Consulta IBGE ainda não executada para esta localidade.'}

INTELIGÊNCIA TERRITORIAL, INFRAESTRUTURA, CLIMA E RISCO HÍDRICO:
${params.territorialSummary || 'Auditoria territorial ainda não executada para este ponto.'}

REGRAS OBRIGATÓRIAS DO GEO-IA:
1. Responda exclusivamente com base nas evidências reais do Cloud SQL, ferramentas geográficas e Google Maps Grounding (quando ativo). Se não tiver a informação, diga explicitamente "Não encontrei essa informação" e nunca invente concorrentes, faturamento, lucro ou fluxos.
2. Estruture sua resposta deixando claro o que são [Dados confirmados], [Dados estimados], [Hipóteses a validar] e [Informações indisponíveis].
3. Nunca declare uma zona como "totalmente segura" ou "de risco extremo" sem citar a fonte, data e limitações dos modelos climáticos/hidrológicos.`;

  const config: Record<string, unknown> = { systemInstruction };
  if (wantsMaps) {
    config.tools = [{ googleMaps: {} }];
    if (params.userLatLng) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: params.userLatLng,
        },
      };
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: buildMultiTurnContents(params.history, params.question),
    config,
  });

  const groundingLinks = wantsMaps ? extractGroundingLinks(response, 'maps') : [];

  return {
    answer:
      response.text ||
      'Não encontrei essa informação nos dados carregados do mapa neste momento.',
    groundingLinks,
  };
}

export interface CrossSectionCorrelationOutput {
  executiveDiagnosis: string;
  correlations: Array<{
    pillarPair: string;
    finding: string;
    evidenceType: 'Confirmado' | 'Estimado' | 'Hipótese';
    financialOrOperationalImpact: string;
    recommendedAction: string;
  }>;
  priorityAlerts: string[];
  unavailableOrMissingData: string[];
  generatedAt: string;
}

export async function analyzeCrossSectionCorrelations(params: {
  companyName: string;
  segment: string;
  cityState: string;
  macroSummary: string;
  consumersSummary: string;
  competitorsSummary: string;
  financialAndInventorySummary: string;
}): Promise<CrossSectionCorrelationOutput> {
  const ai = getAiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Você é o Motor Central de Sincronização Inteligente do Gêmeo Digital.
Analise de forma integrada e cruzada os 4 pilares REAIS da empresa "${params.companyName}" (${params.segment || 'Setor não informado'}, ${params.cityState || 'Brasil'}):

1. CENÁRIO MACROECONÔMICO (BCB / IBGE / SEFAZ):
${params.macroSummary}

2. CONSUMIDORES (Google Reviews, Reclame Aqui e Avaliações Reais):
${params.consumersSummary}

3. CONCORRENTES (Preços, Posicionamento, Avaliações e Diferenciais):
${params.competitorsSummary}

4. VENDAS, CUSTOS, DESPESAS, RESULTADO (DRE) E ESTOQUE:
${params.financialAndInventorySummary}

INSTRUÇÕES OBRIGATÓRIAS:
- Identifique relações reais entre comportamento dos consumidores, concorrência, cenário macroeconômico, vendas, custos, despesas, resultado operacional e estoque.
- Exemplos de cruzamentos válidos quando os dados existirem: taxa Selic/cartão vs. margem operacional; reclamações de entrega/estoque vs. frete/ruptura; preço de concorrentes vs. margem bruta por categoria; inflação (IPCA) vs. CMV.
- NUNCA invente números ausentes. Se algum pilar estiver vazio (ex.: sem custos ou sem avaliações), aponte em "unavailableOrMissingData" exatamente o que falta cadastrar.
- Classifique cada correlação em "evidenceType": "Confirmado", "Estimado" ou "Hipótese".`,
    config: {
      systemInstruction:
        'Sintetize correlações causais reais e acionáveis entre os módulos do Gêmeo Digital em português simples.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          executiveDiagnosis: { type: Type.STRING },
          correlations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pillarPair: { type: Type.STRING },
                finding: { type: Type.STRING },
                evidenceType: { type: Type.STRING },
                financialOrOperationalImpact: { type: Type.STRING },
                recommendedAction: { type: Type.STRING },
              },
            },
          },
          priorityAlerts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          unavailableOrMissingData: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  const parsed = safeJsonParse<Partial<CrossSectionCorrelationOutput>>(response.text, {});
  return {
    executiveDiagnosis:
      parsed.executiveDiagnosis ||
      'Cruzamento concluído com base nos módulos atualmente preenchidos.',
    correlations: (parsed.correlations || []).map((c) => ({
      pillarPair: c.pillarPair || 'Cruzamento multisetorial',
      finding: c.finding || '',
      evidenceType:
        c.evidenceType === 'Confirmado' || c.evidenceType === 'Estimado'
          ? c.evidenceType
          : 'Hipótese',
      financialOrOperationalImpact: c.financialOrOperationalImpact || '',
      recommendedAction: c.recommendedAction || '',
    })),
    priorityAlerts: parsed.priorityAlerts || [],
    unavailableOrMissingData: parsed.unavailableOrMissingData || [],
    generatedAt: new Date().toISOString(),
  };
}




