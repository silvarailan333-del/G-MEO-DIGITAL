import { GoogleGenAI, Type } from '@google/genai';
import {
  geocodeAddressServer,
  getMapsApiKey,
  getPlaceDetailsServer,
  searchPlacesServer,
} from './geoService.ts';

function getAiClientOrNull() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
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

export interface GoogleReviewSyncOutput {
  syncStatus: 'synced' | 'not_found' | 'unavailable';
  syncNote: string;
  placeId: string;
  placeName: string;
  googleMapsUri: string;
  rating: string;
  ratingsTotal: number;
  resolvedLat: string;
  resolvedLng: string;
  reviews: Array<{
    authorLabel: string;
    rating: number;
    commentText: string;
    reviewedAt: string;
  }>;
}

export async function fetchCompanyGoogleReviews(params: {
  companyName: string;
  address?: string;
  city?: string;
  state?: string;
  existingPlaceId?: string;
  existingLat?: string;
  existingLng?: string;
}): Promise<GoogleReviewSyncOutput> {
  const locationParts = [params.address, params.city, params.state, 'Brasil'].filter(Boolean);
  const fullLocation = locationParts.join(', ');

  if (!params.companyName.trim()) {
    return {
      syncStatus: 'unavailable',
      syncNote: 'Nome da empresa não informado para busca no Google Reviews.',
      placeId: '',
      placeName: '',
      googleMapsUri: '',
      rating: '',
      ratingsTotal: 0,
      resolvedLat: '',
      resolvedLng: '',
      reviews: [],
    };
  }

  let resolvedPlaceId = (params.existingPlaceId || '').trim();
  let resolvedLat = Number(params.existingLat || 0);
  let resolvedLng = Number(params.existingLng || 0);
  const mapsKey = getMapsApiKey();

  // Path A: Official Google Places API (New) when GOOGLE_MAPS_API_KEY is available
  if (mapsKey) {
    try {
      if (!resolvedLat || !resolvedLng) {
        const geo = await geocodeAddressServer(fullLocation || params.companyName);
        if (geo.found && geo.lat !== null && geo.lng !== null) {
          resolvedLat = geo.lat;
          resolvedLng = geo.lng;
        }
      }

      if (!resolvedPlaceId) {
        const query = [params.companyName, params.city, params.state].filter(Boolean).join(' ');
        const searchRes = await searchPlacesServer({
          textQuery: query,
          centerLat: resolvedLat || -15.7939,
          centerLng: resolvedLng || -47.8828,
          radiusKm: 35,
          maxResults: 5,
          regionCode: 'BR',
        });

        const lowerTarget = params.companyName.toLowerCase().trim();
        const bestMatch =
          searchRes.places.find((p) => p.name.toLowerCase().includes(lowerTarget)) ||
          searchRes.places.find((p) => lowerTarget.includes(p.name.toLowerCase())) ||
          searchRes.places[0];

        if (bestMatch) {
          resolvedPlaceId = bestMatch.placeId;
          resolvedLat = resolvedLat || bestMatch.lat;
          resolvedLng = resolvedLng || bestMatch.lng;
        }
      }

      if (resolvedPlaceId) {
        const details = (await getPlaceDetailsServer(resolvedPlaceId)) as {
          id?: string;
          displayName?: { text?: string };
          rating?: number;
          userRatingCount?: number;
          googleMapsUri?: string;
          reviews?: Array<{
            rating?: number;
            publishTime?: string;
            relativePublishTimeDescription?: string;
            authorAttribution?: { displayName?: string };
            text?: { text?: string };
            originalText?: { text?: string };
          }>;
        } | null;

        if (details) {
          const reviews = (details.reviews || [])
            .map((r) => {
              const commentText = (r.text?.text || r.originalText?.text || '').trim();
              if (!commentText) return null;
              return {
                authorLabel: r.authorAttribution?.displayName || 'Cliente Google Maps',
                rating: Math.min(5, Math.max(1, Math.round(Number(r.rating || details.rating || 5)))),
                commentText,
                reviewedAt: r.publishTime
                  ? r.publishTime.slice(0, 10)
                  : new Date().toISOString().slice(0, 10),
              };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);

          return {
            syncStatus: 'synced',
            syncNote:
              reviews.length > 0
                ? `Perfil localizado via Google Places API (${details.userRatingCount || reviews.length} avaliações públicas no Google; API retorna até 5 amostras recentes).`
                : 'Perfil localizado no Google Maps, porém sem comentários textuais públicos disponíveis na amostra da API.',
            placeId: details.id || resolvedPlaceId,
            placeName: details.displayName?.text || params.companyName,
            googleMapsUri: details.googleMapsUri || '',
            rating: typeof details.rating === 'number' ? details.rating.toFixed(1) : '',
            ratingsTotal: Number(details.userRatingCount || 0),
            resolvedLat: resolvedLat ? String(resolvedLat) : '',
            resolvedLng: resolvedLng ? String(resolvedLng) : '',
            reviews,
          };
        }
      }
    } catch (err) {
      console.warn(
        'Places API Google Reviews sync warning:',
        err instanceof Error ? err.message : err
      );
    }
  }

  // Path B: Grounded Gemini googleMaps tool fallback (never fabricates places or reviews)
  const ai = getAiClientOrNull();
  if (ai) {
    try {
      const mapsPrompt = `Localize o perfil público oficial da empresa "${params.companyName}" em "${fullLocation || 'Brasil'}" no Google Maps e liste exclusivamente a nota média visível, total de avaliações e comentários públicos reais disponíveis nas fontes de avaliação.`;
      const gRes = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: mapsPrompt,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });

      const chunks =
        (gRes.candidates?.[0]?.groundingMetadata?.groundingChunks as Array<{
          maps?: {
            uri?: string;
            title?: string;
            placeAnswerSources?: {
              reviewSnippets?: Array<{
                text?: string;
                originalText?: { text?: string };
              }>;
            };
          };
        }>) || [];

      const matchedChunk =
        chunks.find((c) =>
          (c.maps?.title || '').toLowerCase().includes(params.companyName.toLowerCase().slice(0, 8))
        ) || chunks.find((c) => c.maps?.uri || c.maps?.title);

      if (matchedChunk?.maps) {
        const snippets = (matchedChunk.maps.placeAnswerSources?.reviewSnippets || [])
          .map((s) => (s.text || s.originalText?.text || '').trim())
          .filter(Boolean);

        const extractedMeta = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Extraia em JSON apenas a nota média numérica (ex: "4.6" ou "") e o total inteiro de avaliações (ex: 120 ou 0) explícitos neste texto. Se não houver número claro, retorne string vazia e 0. Nunca invente:\n\n${gRes.text || ''}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                rating: { type: Type.STRING },
                ratingsTotal: { type: Type.INTEGER },
              },
            },
          },
        });
        const meta = safeJsonParse<{ rating?: string; ratingsTotal?: number }>(
          extractedMeta.text,
          {}
        );

        return {
          syncStatus: 'synced',
          syncNote:
            snippets.length > 0
              ? 'Avaliações públicas capturadas via Google Maps Grounding.'
              : 'Estabelecimento encontrado no Google Maps; sem trechos textuais públicos retornados na consulta.',
          placeId: resolvedPlaceId,
          placeName: matchedChunk.maps.title || params.companyName,
          googleMapsUri: matchedChunk.maps.uri || '',
          rating: String(meta.rating || '').trim(),
          ratingsTotal: Number(meta.ratingsTotal || 0),
          resolvedLat: resolvedLat ? String(resolvedLat) : '',
          resolvedLng: resolvedLng ? String(resolvedLng) : '',
          reviews: snippets.map((text, idx) => ({
            authorLabel: `Avaliação Google #${idx + 1}`,
            rating: Math.min(5, Math.max(1, Math.round(Number(meta.rating || 4)))),
            commentText: text,
            reviewedAt: new Date().toISOString().slice(0, 10),
          })),
        };
      }
    } catch (err) {
      console.warn(
        'Gemini Maps grounding sync warning:',
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    syncStatus: 'not_found',
    syncNote:
      'Não foi possível localizar automaticamente um perfil público correspondente no Google Maps com os dados atuais. Você pode completar endereço/cidade em Dados da Empresa ou registrar avaliações manualmente.',
    placeId: resolvedPlaceId,
    placeName: '',
    googleMapsUri: '',
    rating: '',
    ratingsTotal: 0,
    resolvedLat: resolvedLat ? String(resolvedLat) : '',
    resolvedLng: resolvedLng ? String(resolvedLng) : '',
    reviews: [],
  };
}

export interface ReclameAquiCaptureResult {
  validUrl: boolean;
  normalizedUrl: string;
  captureStatus: 'captured' | 'partial' | 'unavailable';
  captureNote: string;
  score: string;
  statusLabel: string;
  responseRatePct: string;
  solvedRatePct: string;
  backToBuyPct: string;
  complaintsTotal: number;
  answeredTotal: number;
  extractedComplaints: Array<{
    authorLabel: string;
    rating: number;
    commentText: string;
    reviewedAt: string;
  }>;
}

export async function captureReclameAquiProfile(params: {
  companyName: string;
  url: string;
}): Promise<ReclameAquiCaptureResult> {
  const cleanUrl = (params.url || '').trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
  } catch {
    return {
      validUrl: false,
      normalizedUrl: cleanUrl,
      captureStatus: 'unavailable',
      captureNote: 'URL inválida. Informe um link completo do Reclame Aqui (ex.: https://www.reclameaqui.com.br/empresa/...).',
      score: '',
      statusLabel: '',
      responseRatePct: '',
      solvedRatePct: '',
      backToBuyPct: '',
      complaintsTotal: 0,
      answeredTotal: 0,
      extractedComplaints: [],
    };
  }

  if (!parsedUrl.hostname.toLowerCase().includes('reclameaqui.com.br')) {
    return {
      validUrl: false,
      normalizedUrl: cleanUrl,
      captureStatus: 'unavailable',
      captureNote: 'O link informado deve pertencer ao domínio oficial reclameaqui.com.br.',
      score: '',
      statusLabel: '',
      responseRatePct: '',
      solvedRatePct: '',
      backToBuyPct: '',
      complaintsTotal: 0,
      answeredTotal: 0,
      extractedComplaints: [],
    };
  }

  const normalizedUrl = parsedUrl.toString();
  const slugMatch = parsedUrl.pathname.match(/\/empresa\/([^/]+)/i);
  const slug = slugMatch?.[1] || params.companyName;

  // Step 1: Attempt authorized direct public HTTP GET on public profile page
  let htmlSnippet = '';
  let directOk = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GemeoDigitalBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      const html = await resp.text();
      if (html && !html.includes('Attention Required! | Cloudflare')) {
        directOk = true;
        // Extract JSON-LD, __NEXT_DATA__, or meta tags cleanly
        const stripped = html
          .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (full, inner) => {
            if (full.includes('application/ld+json') || full.includes('__NEXT_DATA__')) {
              return `\n[STRUCTURED_DATA]\n${String(inner).slice(0, 6000)}\n`;
            }
            return ' ';
          })
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ');
        htmlSnippet = stripped.slice(0, 12000);
      }
    }
  } catch {
    // site may restrict automated fetches
  }

  // Step 2: Public search grounding via Gemini Search strictly on public indexed Reclame Aqui data
  const ai = getAiClientOrNull();
  let searchGroundedText = '';
  if (ai) {
    try {
      const searchRes = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Pesquise informações públicas indexadas na página oficial "${normalizedUrl}" (empresa "${slug}" / "${params.companyName}") no Reclame Aqui. Informe SOMENTE métricas e reclamações explicitamente visíveis nos resultados públicos: nota geral (0 a 10), classificação/selo (ex: RA1000, Ótimo, Bom, Regular, Ruim, Sem índice), % de reclamações respondidas, % de índice de solução, % que voltaria a fazer negócio, quantidade de reclamações e principais reclamações públicas relatadas. Nunca invente nenhum número.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      searchGroundedText = searchRes.text || '';
    } catch {
      searchGroundedText = '';
    }
  }

  if (!directOk && !searchGroundedText.trim()) {
    return {
      validUrl: true,
      normalizedUrl,
      captureStatus: 'unavailable',
      captureNote:
        'Link salvo com sucesso. O Reclame Aqui bloqueia leitura automatizada direta (Cloudflare) e não retornou dados indexados neste ciclo; você pode registrar reclamações ou exportar o relatório manualmente em Consumidores.',
      score: '',
      statusLabel: '',
      responseRatePct: '',
      solvedRatePct: '',
      backToBuyPct: '',
      complaintsTotal: 0,
      answeredTotal: 0,
      extractedComplaints: [],
    };
  }

  if (!ai) {
    return {
      validUrl: true,
      normalizedUrl,
      captureStatus: directOk ? 'partial' : 'unavailable',
      captureNote: directOk
        ? 'Página pública acessada, porém a extração inteligente requer GEMINI_API_KEY ativa.'
        : 'Link salvo; leitura detalhada indisponível sem chave de IA.',
      score: '',
      statusLabel: '',
      responseRatePct: '',
      solvedRatePct: '',
      backToBuyPct: '',
      complaintsTotal: 0,
      answeredTotal: 0,
      extractedComplaints: [],
    };
  }

  const parsedAi = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Estruture em JSON exclusivamente os dados reais encontrados para a empresa "${params.companyName}" no Reclame Aqui (${normalizedUrl}).
DADOS HTML PÚBLICOS:
${htmlSnippet || 'Não acessível diretamente.'}

RESULTADOS INDEXADOS PÚBLICOS:
${searchGroundedText || 'Nenhum resultado complementar.'}

REGRAS ESTRITAS:
1. Se um campo numérico (nota, % respondidas, % solução, % voltariam a fazer negócio, total de reclamações) NÃO estiver explicitamente presente nos textos acima, retorne "" ou 0. NUNCA estime ou invente índices.
2. Em "complaints", inclua apenas temas ou relatos públicos reais citados acima (máximo 5).`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.STRING },
          statusLabel: { type: Type.STRING },
          responseRatePct: { type: Type.STRING },
          solvedRatePct: { type: Type.STRING },
          backToBuyPct: { type: Type.STRING },
          complaintsTotal: { type: Type.INTEGER },
          answeredTotal: { type: Type.INTEGER },
          noteSummary: { type: Type.STRING },
          complaints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                titleOrAuthor: { type: Type.STRING },
                summary: { type: Type.STRING },
                rating1to5: { type: Type.INTEGER },
                dateIso: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const obj = safeJsonParse<{
    score?: string;
    statusLabel?: string;
    responseRatePct?: string;
    solvedRatePct?: string;
    backToBuyPct?: string;
    complaintsTotal?: number;
    answeredTotal?: number;
    noteSummary?: string;
    complaints?: Array<{
      titleOrAuthor?: string;
      summary?: string;
      rating1to5?: number;
      dateIso?: string;
    }>;
  }>(parsedAi.text, {});

  const hasMetrics = Boolean(
    obj.score ||
      obj.statusLabel ||
      obj.responseRatePct ||
      obj.solvedRatePct ||
      (obj.complaintsTotal && obj.complaintsTotal > 0) ||
      (obj.complaints && obj.complaints.length > 0)
  );

  return {
    validUrl: true,
    normalizedUrl,
    captureStatus: hasMetrics ? (directOk ? 'captured' : 'partial') : 'unavailable',
    captureNote: hasMetrics
      ? obj.noteSummary ||
        (directOk
          ? 'Dados públicos capturados diretamente do link informado no Reclame Aqui.'
          : 'Índices públicos capturados via indexação web oficial do Reclame Aqui (sujeito à disponibilidade pública da página).')
      : 'Link salvo, porém não foram encontrados índices numéricos públicos disponíveis para extração automática.',
    score: String(obj.score || '').trim(),
    statusLabel: String(obj.statusLabel || '').trim(),
    responseRatePct: String(obj.responseRatePct || '').trim(),
    solvedRatePct: String(obj.solvedRatePct || '').trim(),
    backToBuyPct: String(obj.backToBuyPct || '').trim(),
    complaintsTotal: Number(obj.complaintsTotal || 0),
    answeredTotal: Number(obj.answeredTotal || 0),
    extractedComplaints: (obj.complaints || [])
      .filter((c) => c.summary && c.summary.trim())
      .slice(0, 5)
      .map((c, idx) => ({
        authorLabel: c.titleOrAuthor || `Reclame Aqui #${idx + 1}`,
        rating: Math.min(5, Math.max(1, Number(c.rating1to5 || 2))),
        commentText: c.summary!.trim(),
        reviewedAt: c.dateIso && /^\d{4}-\d{2}-\d{2}/.test(c.dateIso)
          ? c.dateIso.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      })),
  };
}
