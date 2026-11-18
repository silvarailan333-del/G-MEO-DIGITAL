export interface MacroIndicator {
  code: string;
  label: string;
  value: string | null;
  unit: string;
  referenceDate: string | null;
  previousValue?: string | null;
  previousDate?: string | null;
  comparisonText?: string | null;
  source: string;
  sourceUrl?: string;
  status: 'ok' | 'unavailable';
  isStale?: boolean;
  lastKnownDate?: string | null;
  note: string;
}

export interface MacroHistorySeries {
  labels: string[];
  values: number[];
  source: string;
}

export interface OfficialMacroBundle {
  indicators: MacroIndicator[];
  ipcaHistory: MacroHistorySeries;
  selicHistory: MacroHistorySeries;
  cambioHistory: MacroHistorySeries;
  fetchedAt: string;
}

const MODAL_ICMS_BY_UF: Record<string, { rate: number; note: string }> = {
  AC: { rate: 19, note: 'Alíquota modal interna do Acre (19%).' },
  AL: { rate: 19, note: 'Alíquota modal interna de Alagoas (19% + FECOEP quando aplicável).' },
  AM: { rate: 20, note: 'Alíquota modal interna do Amazonas (20%).' },
  AP: { rate: 18, note: 'Alíquota modal interna do Amapá (18%).' },
  BA: { rate: 20.5, note: 'Alíquota modal interna da Bahia (20,5%).' },
  CE: { rate: 20, note: 'Alíquota modal interna do Ceará (20%).' },
  DF: { rate: 20, note: 'Alíquota modal interna do Distrito Federal (20%).' },
  ES: { rate: 17, note: 'Alíquota modal interna do Espírito Santo (17%).' },
  GO: { rate: 19, note: 'Alíquota modal interna de Goiás (19%).' },
  MA: { rate: 22, note: 'Alíquota modal interna do Maranhão (22%).' },
  MG: { rate: 18, note: 'Alíquota modal interna de Minas Gerais (18%).' },
  MS: { rate: 17, note: 'Alíquota modal interna do Mato Grosso do Sul (17%).' },
  MT: { rate: 17, note: 'Alíquota modal interna do Mato Grosso (17%).' },
  PA: { rate: 19, note: 'Alíquota modal interna do Pará (19%).' },
  PB: { rate: 20, note: 'Alíquota modal interna da Paraíba (20%).' },
  PE: { rate: 20.5, note: 'Alíquota modal interna de Pernambuco (20,5%).' },
  PI: { rate: 21, note: 'Alíquota modal interna do Piauí (21%).' },
  PR: { rate: 19.5, note: 'Alíquota modal interna do Paraná (19,5%).' },
  RJ: { rate: 22, note: 'Alíquota modal interna do Rio de Janeiro (20% + 2% FECP).' },
  RN: { rate: 18, note: 'Alíquota modal interna do Rio Grande do Norte (18%).' },
  RO: { rate: 19.5, note: 'Alíquota modal interna de Rondônia (19,5%).' },
  RR: { rate: 20, note: 'Alíquota modal interna de Roraima (20%).' },
  RS: { rate: 17, note: 'Alíquota modal interna do Rio Grande do Sul (17%).' },
  SC: { rate: 17, note: 'Alíquota modal interna de Santa Catarina (17%).' },
  SE: { rate: 19, note: 'Alíquota modal interna de Sergipe (19%).' },
  SP: { rate: 18, note: 'Alíquota modal interna de São Paulo (18%).' },
  TO: { rate: 20, note: 'Alíquota modal interna do Tocantins (20%).' },
};

interface CacheEntry {
  expiresAt: number;
  baseIndicators: MacroIndicator[];
  ipcaHistory: MacroHistorySeries;
  selicHistory: MacroHistorySeries;
  cambioHistory: MacroHistorySeries;
  fetchedAt: string;
}

let macroCache: CacheEntry | null = null;
const lastKnownByCode = new Map<string, MacroIndicator>();

function buildComparisonText(latestRaw: string, prevRaw: string | undefined, unit: string, prevDate?: string): string | null {
  if (!prevRaw) return null;
  const curNum = Number(String(latestRaw).replace(/\./g, '').replace(',', '.')) || Number(latestRaw);
  const prevNum = Number(String(prevRaw).replace(/\./g, '').replace(',', '.')) || Number(prevRaw);
  if (!Number.isFinite(curNum) || !Number.isFinite(prevNum)) {
    return prevDate ? `Anterior (${prevDate}): ${prevRaw} ${unit}` : `Anterior: ${prevRaw} ${unit}`;
  }
  const diff = curNum - prevNum;
  const sign = diff > 0 ? '+' : '';
  const diffStr = Math.abs(diff) < 0.005 ? 'Estável' : `${sign}${diff.toFixed(2).replace('.', ',')} ${unit.includes('%') ? 'p.p.' : unit}`;
  return `Anterior${prevDate ? ` (${prevDate})` : ''}: ${prevRaw} ${unit} (${diffStr})`;
}

async function fetchBcbSeries(
  seriesCode: number,
  code: string,
  label: string,
  unit: string,
  note: string,
  sourceUrl: string
): Promise<MacroIndicator> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados/ultimos/2?formato=json`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Array<{ data: string; valor: string }>;
    if (!Array.isArray(json) || json.length === 0) throw new Error('Empty series');
    const latest = json[json.length - 1];
    const prev = json.length >= 2 ? json[json.length - 2] : undefined;
    const indicator: MacroIndicator = {
      code,
      label,
      value: latest.valor,
      unit,
      referenceDate: latest.data,
      previousValue: prev?.valor ?? null,
      previousDate: prev?.data ?? null,
      comparisonText: buildComparisonText(latest.valor, prev?.valor, unit, prev?.data),
      source: `Banco Central do Brasil (SGS #${seriesCode})`,
      sourceUrl,
      status: 'ok',
      isStale: false,
      note,
    };
    lastKnownByCode.set(code, indicator);
    return indicator;
  } catch {
    const prevKnown = lastKnownByCode.get(code);
    return {
      code,
      label,
      value: prevKnown?.value ?? null,
      unit,
      referenceDate: prevKnown?.referenceDate ?? null,
      previousValue: prevKnown?.previousValue ?? null,
      previousDate: prevKnown?.previousDate ?? null,
      comparisonText: prevKnown?.comparisonText ?? null,
      source: `Banco Central do Brasil (SGS #${seriesCode})`,
      sourceUrl,
      status: 'unavailable',
      isStale: Boolean(prevKnown),
      lastKnownDate: prevKnown?.referenceDate ?? null,
      note: prevKnown
        ? `Consulta em tempo real indisponível; último valor conhecido de ${prevKnown.referenceDate}: ${prevKnown.value} ${unit}.`
        : 'Indisponível no momento na fonte oficial.',
    };
  }
}

async function fetchBcbIpcaYtd(): Promise<MacroIndicator> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json`;
  const sourceUrl = 'https://www.ibge.gov.br/indicadores';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Array<{ data: string; valor: string }>;
    if (!Array.isArray(json) || json.length === 0) throw new Error('Empty IPCA YTD');
    const latest = json[json.length - 1];
    const latestYear = latest.data.split('/')[2];
    const yearEntries = json.filter((item) => item.data.split('/')[2] === latestYear);
    let factor = 1;
    let prevFactor = 1;
    yearEntries.forEach((item, idx) => {
      const mVal = Number(item.valor) || 0;
      factor *= 1 + mVal / 100;
      if (idx < yearEntries.length - 1) prevFactor *= 1 + mVal / 100;
    });
    const ytdPct = ((factor - 1) * 100).toFixed(2);
    const prevYtdPct = yearEntries.length > 1 ? ((prevFactor - 1) * 100).toFixed(2) : undefined;
    const prevEntry = yearEntries.length > 1 ? yearEntries[yearEntries.length - 2] : undefined;
    const indicator: MacroIndicator = {
      code: 'IPCA_ANO',
      label: `IPCA (Acumulado no Ano ${latestYear})`,
      value: ytdPct,
      unit: '%',
      referenceDate: `Jan–${latest.data.slice(3)}`,
      previousValue: prevYtdPct ?? null,
      previousDate: prevEntry ? `Até ${prevEntry.data.slice(3)}` : null,
      comparisonText: buildComparisonText(ytdPct, prevYtdPct, '%', prevEntry ? prevEntry.data.slice(3) : undefined),
      source: 'Banco Central / IBGE (SGS #433 composto)',
      sourceUrl,
      status: 'ok',
      isStale: false,
      note: 'Inflação acumulada desde janeiro do ano de referência com base na variação mensal oficial.',
    };
    lastKnownByCode.set('IPCA_ANO', indicator);
    return indicator;
  } catch {
    const prevKnown = lastKnownByCode.get('IPCA_ANO');
    return {
      code: 'IPCA_ANO',
      label: 'IPCA (Acumulado no Ano)',
      value: prevKnown?.value ?? null,
      unit: '%',
      referenceDate: prevKnown?.referenceDate ?? null,
      source: 'Banco Central / IBGE (SGS #433)',
      sourceUrl,
      status: 'unavailable',
      isStale: Boolean(prevKnown),
      lastKnownDate: prevKnown?.referenceDate ?? null,
      note: prevKnown
        ? `Indisponível no momento; último acumulado conhecido (${prevKnown.referenceDate}): ${prevKnown.value}%.`
        : 'Indisponível no momento na fonte oficial.',
    };
  }
}

async function fetchBcbHistory(seriesCode: number, count: number, sourceLabel: string): Promise<MacroHistorySeries> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados/ultimos/${count}?formato=json`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Array<{ data: string; valor: string }>;
    if (!Array.isArray(json) || json.length === 0) throw new Error('Empty history');
    return {
      labels: json.map((item) => {
        const parts = item.data.split('/');
        return parts.length === 3 ? `${parts[1]}/${parts[2].slice(2)}` : item.data;
      }),
      values: json.map((item) => Number(item.valor) || 0),
      source: sourceLabel,
    };
  } catch {
    return {
      labels: [],
      values: [],
      source: sourceLabel,
    };
  }
}

async function fetchIbgeSidraIndicator(
  url: string,
  code: string,
  label: string,
  unit: string,
  source: string,
  sourceUrl: string,
  note: string,
  formatter?: (raw: string) => string
): Promise<MacroIndicator> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Array<Record<string, string>>;
    if (!Array.isArray(json) || json.length < 2) throw new Error('Unexpected SIDRA format');
    const missingMarkers = new Set(['', '..', '...', '-', 'X']);
    const validRows = json
      .slice(1)
      .filter((r) => {
        const v = String(r?.V ?? '').trim();
        return !missingMarkers.has(v) && Number.isFinite(Number(v));
      });
    if (validRows.length === 0) throw new Error('Missing value');
    const latestRow = validRows[validRows.length - 1];
    const prevRow = validRows.length >= 2 ? validRows[validRows.length - 2] : undefined;
    const rawLatest = String(latestRow.V).trim();
    const rawPrev = prevRow ? String(prevRow.V).trim() : undefined;
    const formattedLatest = formatter ? formatter(rawLatest) : rawLatest;
    const formattedPrev = rawPrev ? (formatter ? formatter(rawPrev) : rawPrev) : undefined;
    const periodo = latestRow.D3N || latestRow.D2N || '';
    const prevPeriodo = prevRow ? prevRow.D3N || prevRow.D2N || '' : undefined;

    const indicator: MacroIndicator = {
      code,
      label,
      value: formattedLatest,
      unit,
      referenceDate: periodo,
      previousValue: formattedPrev ?? null,
      previousDate: prevPeriodo ?? null,
      comparisonText: rawPrev
        ? prevPeriodo
          ? `Anterior (${prevPeriodo}): ${formattedPrev} ${unit}`
          : `Anterior: ${formattedPrev} ${unit}`
        : null,
      source,
      sourceUrl,
      status: 'ok',
      isStale: false,
      note,
    };
    lastKnownByCode.set(code, indicator);
    return indicator;
  } catch {
    const prevKnown = lastKnownByCode.get(code);
    return {
      code,
      label,
      value: prevKnown?.value ?? null,
      unit,
      referenceDate: prevKnown?.referenceDate ?? null,
      previousValue: prevKnown?.previousValue ?? null,
      previousDate: prevKnown?.previousDate ?? null,
      comparisonText: prevKnown?.comparisonText ?? null,
      source,
      sourceUrl,
      status: 'unavailable',
      isStale: Boolean(prevKnown),
      lastKnownDate: prevKnown?.referenceDate ?? null,
      note: prevKnown
        ? `Indisponível no momento; último dado conhecido (${prevKnown.referenceDate}): ${prevKnown.value} ${unit}.`
        : 'Indisponível no momento na fonte oficial.',
    };
  }
}

function buildIcmsIndicator(stateCode?: string): MacroIndicator {
  const uf = (stateCode || '').trim().toUpperCase();
  const ufInfo = MODAL_ICMS_BY_UF[uf];
  if (ufInfo) {
    return {
      code: 'ICMS',
      label: `ICMS (${uf} — Alíquota Modal)`,
      value: String(ufInfo.rate).replace('.', ','),
      unit: '%',
      referenceDate: `Vigência estadual (${uf})`,
      comparisonText: 'Comparável por regime (Simples / Presumido / Real)',
      source: `SEFAZ-${uf} / CONFAZ`,
      sourceUrl: 'https://www.confaz.fazenda.gov.br/',
      status: 'ok',
      note: `${ufInfo.note} Alíquota efetiva varia conforme NCM, regime tributário e operações interestaduais. Valide com seu contador.`,
    };
  }
  return {
    code: 'ICMS',
    label: 'ICMS (Referência Estadual)',
    value: '17% a 22%',
    unit: 'modal UF',
    referenceDate: 'Vigência estadual',
    source: 'SEFAZ / CONFAZ (Regras Estaduais)',
    sourceUrl: 'https://www.confaz.fazenda.gov.br/',
    status: 'ok',
    note: 'Cadastre a UF da empresa para exibir a alíquota modal exata do seu estado.',
  };
}

export async function getOfficialMacroBundle(stateCode?: string): Promise<OfficialMacroBundle> {
  if (macroCache && macroCache.expiresAt > Date.now()) {
    return {
      indicators: [...macroCache.baseIndicators, buildIcmsIndicator(stateCode)],
      ipcaHistory: macroCache.ipcaHistory,
      selicHistory: macroCache.selicHistory,
      cambioHistory: macroCache.cambioHistory,
      fetchedAt: macroCache.fetchedAt,
    };
  }

  const [
    selic,
    ipca12m,
    ipcaAno,
    ipcaMensal,
    cambio,
    desemprego,
    pibVar,
    pibPerCapita,
    renda,
    ipcaHistory,
    selicHistory,
    cambioHistory,
  ] = await Promise.all([
    fetchBcbSeries(
      432,
      'SELIC',
      'Taxa Selic Meta',
      '% a.a.',
      'Taxa básica de juros definida pelo Copom; influencia custo de crédito, parcelamentos e capital de giro.',
      'https://www.bcb.gov.br/controleinflacao/taxaselic'
    ),
    fetchBcbSeries(
      13522,
      'IPCA',
      'IPCA (Acumulado 12 meses)',
      '%',
      'Inflação oficial acumulada em 12 meses medida pelo IBGE e divulgada pelo Banco Central.',
      'https://www.ibge.gov.br/indicadores'
    ),
    fetchBcbIpcaYtd(),
    fetchBcbSeries(
      433,
      'INFLACAO_MENSAL',
      'Taxa de Inflação Mensal (IPCA)',
      '% a.m.',
      'Variação mensal oficial do Índice Nacional de Preços ao Consumidor Amplo.',
      'https://www.ibge.gov.br/indicadores'
    ),
    fetchBcbSeries(
      1,
      'CAMBIO',
      'Dólar Comercial (PTAX)',
      'R$',
      'Cotação oficial de venda do dólar comercial; afeta insumos importados, embalagens e tecnologia.',
      'https://www.bcb.gov.br/estabilidadefinanceira/fechamentodolar'
    ),
    fetchIbgeSidraIndicator(
      'https://apisidra.ibge.gov.br/values/t/6381/n1/all/v/4099/p/last%202',
      'DESEMPREGO',
      'Taxa de Desemprego (PNAD)',
      '%',
      'IBGE / SIDRA (Tabela 6381)',
      'https://sidra.ibge.gov.br/tabela/6381',
      'Taxa oficial de desocupação trimestral nacional (influencia demanda das famílias e mercado de trabalho).'
    ),
    fetchIbgeSidraIndicator(
      'https://apisidra.ibge.gov.br/values/t/5932/n1/all/v/6561/p/last%202/c11255/90707',
      'PIB_REAL',
      'PIB Real (Variação Trimestral)',
      '%',
      'IBGE / SIDRA (Contas Nacionais)',
      'https://sidra.ibge.gov.br/tabela/5932',
      'Taxa de crescimento real da atividade econômica brasileira.'
    ),
    fetchIbgeSidraIndicator(
      'https://apisidra.ibge.gov.br/values/t/6784/n1/all/v/9812/p/last%202',
      'PIB_PER_CAPITA',
      'PIB Real per capita (IBGE)',
      'R$/hab',
      'IBGE / SIDRA (Tabela 6784)',
      'https://sidra.ibge.gov.br/tabela/6784',
      'Renda média gerada por habitante no Brasil segundo as Contas Nacionais.',
      (raw) => {
        const n = Number(raw);
        return Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : raw;
      }
    ),
    fetchIbgeSidraIndicator(
      'https://apisidra.ibge.gov.br/values/t/5436/n1/all/v/5932/p/last%202',
      'RENDA',
      'Rendimento Médio Real Habitual',
      'R$',
      'IBGE / SIDRA (PNAD Contínua)',
      'https://sidra.ibge.gov.br/tabela/5436',
      'Poder de compra médio mensal da população ocupada.'
    ),
    fetchBcbHistory(13522, 6, 'Banco Central / IBGE (SGS #13522 — últimos 6 meses)'),
    fetchBcbHistory(432, 6, 'Banco Central do Brasil (SGS #432 — últimas 6 atualizações)'),
    fetchBcbHistory(1, 6, 'Banco Central do Brasil (SGS #1 — últimos 6 registros PTAX)'),
  ]);

  const baseIndicators = [
    selic,
    ipca12m,
    ipcaAno,
    ipcaMensal,
    cambio,
    desemprego,
    pibVar,
    pibPerCapita,
    renda,
  ];
  const fetchedAt = new Date().toISOString();

  macroCache = {
    baseIndicators,
    ipcaHistory,
    selicHistory,
    cambioHistory,
    fetchedAt,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };

  return {
    indicators: [...baseIndicators, buildIcmsIndicator(stateCode)],
    ipcaHistory,
    selicHistory,
    cambioHistory,
    fetchedAt,
  };
}

export async function getOfficialMacroIndicators(stateCode?: string): Promise<{
  indicators: MacroIndicator[];
  fetchedAt: string;
}> {
  const bundle = await getOfficialMacroBundle(stateCode);
  return { indicators: bundle.indicators, fetchedAt: bundle.fetchedAt };
}

export async function lookupCnpjPublic(rawCnpj: string) {
  const digits = rawCnpj.replace(/\D/g, '');
  if (digits.length !== 14) {
    throw new Error('CNPJ inválido: informe exatamente 14 dígitos.');
  }

  // Primary: BrasilAPI
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      return {
        provider: 'BrasilAPI',
        cnpj: digits,
        legalName: String(data.razao_social || ''),
        tradeName: String(data.nome_fantasia || data.razao_social || ''),
        cnae: String(data.cnae_fiscal || ''),
        segment: String(data.cnae_fiscal_descricao || ''),
        companySize: String(data.porte || ''),
        registrationStatus: String(data.descricao_situacao_cadastral || ''),
        city: String(data.municipio || ''),
        state: String(data.uf || ''),
        address: [data.logradouro, data.numero, data.bairro].filter(Boolean).join(', '),
        phone: String(data.ddd_telefone_1 || ''),
        commercialEmail: String(data.email || ''),
      };
    }
  } catch {
    // Fallback to ReceitaWS
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      if (data.status === 'ERROR') {
        throw new Error(String(data.message || 'CNPJ não encontrado'));
      }
      const atividade = Array.isArray(data.atividade_principal)
        ? (data.atividade_principal[0] as { code?: string; text?: string })
        : undefined;
      return {
        provider: 'ReceitaWS',
        cnpj: digits,
        legalName: String(data.nome || ''),
        tradeName: String(data.fantasia || data.nome || ''),
        cnae: String(atividade?.code || ''),
        segment: String(atividade?.text || ''),
        companySize: String(data.porte || ''),
        registrationStatus: String(data.situacao || ''),
        city: String(data.municipio || ''),
        state: String(data.uf || ''),
        address: [data.logradouro, data.numero, data.bairro].filter(Boolean).join(', '),
        phone: String(data.telefone || ''),
        commercialEmail: String(data.email || ''),
      };
    }
  } catch {
    // Both failed
  }

  throw new Error(
    'Consulta pública de CNPJ indisponível no momento. Você pode preencher os dados da empresa manualmente.'
  );
}
