import type { SemanticKind } from '../components/ui/TwinUI';

export const ATLANTICA_BRAND = {
  name: 'Atlântica Moda',
  legalName: 'Atlântica Moda e Confecções Ltda.',
  cnpj: '27.491.820/0001-54',
  cnae: '4781-4/00 — Comércio varejista de artigos do vestuário e acessórios',
  segment: 'Moda feminina e casual',
  operationType: 'Física e E-commerce',
  city: 'Florianópolis',
  state: 'SC',
  address: 'Rua Bocaiúva, 1890 — Centro',
  phone: '(48) 3224-8890',
  email: 'gestao@atlanticamoda.com.br',
  website: 'https://loja.atlanticamoda.com.br',
  logoUrl: '/src/assets/images/atlantica_moda_logo_1794938598900.jpg',
  units: ['Matriz — Centro (Florianópolis/SC)', 'E-commerce Nacional'],
};

export interface DemoProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  status: 'Ativo' | 'Estoque crítico';
  marginPct: number;
  sales30d: number;
  trend: string;
  imageUrl: string;
  description: string;
}

export const ATLANTICA_PRODUCTS: DemoProduct[] = [
  {
    id: 'atl-1',
    sku: 'ATL-VES-014',
    name: 'Vestido Midi Linho Marinho',
    category: 'Vestidos',
    price: 389.9,
    cost: 158.0,
    stock: 42,
    status: 'Ativo',
    marginPct: 59.5,
    sales30d: 84,
    trend: '+18% vs. mês anterior',
    imageUrl: '/src/assets/images/atlantica_vestido_linho_1794938600696.jpg',
    description:
      'Vestido midi confeccionado em linho misto respirável com botões frontais e faixa ajustável.',
  },
  {
    id: 'atl-2',
    sku: 'ATL-BLZ-008',
    name: 'Blazer Alfaiataria Linho Areia',
    category: 'Alfaiataria',
    price: 549.0,
    cost: 235.0,
    stock: 9,
    status: 'Estoque crítico',
    marginPct: 57.2,
    sales30d: 51,
    trend: '+24% em buscas orgânicas',
    imageUrl: '/src/assets/images/atlantica_blazer_areia_1794938601289.jpg',
    description:
      'Blazer estruturado em tom areia neutro, ideal para transição escritório-litoral.',
  },
  {
    id: 'atl-3',
    sku: 'ATL-CAM-021',
    name: 'Camisa Resort Listrada Algodão',
    category: 'Camisaria',
    price: 269.9,
    cost: 104.0,
    stock: 67,
    status: 'Ativo',
    marginPct: 61.5,
    sales30d: 96,
    trend: '+11% de recompra',
    imageUrl: '/src/assets/images/atlantica_camisa_resort_1794938600921.jpg',
    description:
      'Camisa em algodão peruano listrado azul-céu com modelagem leve e gola aberta.',
  },
  {
    id: 'atl-4',
    sku: 'ATL-BOL-003',
    name: 'Bolsa Tote Palha & Couro Marinho',
    category: 'Acessórios',
    price: 329.0,
    cost: 142.0,
    stock: 7,
    status: 'Estoque crítico',
    marginPct: 56.8,
    sales30d: 38,
    trend: 'Alta demanda pré-verão',
    imageUrl: '/src/assets/images/atlantica_bolsa_palha_1794938601990.jpg',
    description:
      'Bolsa artesanal estruturada em fibra natural com alças em couro legítimo azul-marinho.',
  },
];

export const ATLANTICA_KPIS = [
  { label: 'Faturamento semanal', value: 'R$ 318 mil', delta: '+4,2% vs. sem.' },
  { label: 'Ticket médio', value: 'R$ 236', delta: '+R$ 12 vs. out.' },
  { label: 'Conversão online', value: '1,9%', delta: '-0,3 p.p. · atenção' },
  { label: 'Margem bruta', value: '52%', delta: '-1,4 p.p. · meta 54%' },
];

export const ATLANTICA_EXTENDED_KPIS = [
  { label: 'Faturamento semanal', value: 'R$ 318 mil', note: '+4,2% vs. sem.', tone: 'green' as const },
  { label: 'Ticket médio', value: 'R$ 236', note: '+R$ 12 vs. out.', tone: 'green' as const },
  { label: 'Conversão online', value: '1,9%', note: 'Abaixo da meta 2,4%', tone: 'red' as const },
  { label: 'Abandono de carrinho', value: '74%', note: 'Era 68% no ciclo ant.', tone: 'amber' as const },
  { label: 'Margem bruta', value: '52%', note: 'Meta 54% · pressão algodão', tone: 'amber' as const },
  { label: 'NPS', value: '41', note: 'Avaliações pós-venda', tone: 'cyan' as const },
];

export interface DemoSignal {
  code: string;
  kind: SemanticKind;
  impactLabel: string;
  category: 'Concorrência' | 'Setor' | 'Custos' | 'Canais' | 'Eventos' | 'Tributação' | 'Macroeconomia' | 'Legislação' | 'Consumidor';
  radarGroup: 'setorial' | 'macro' | 'consumidor';
  metaRight: string;
  publishedDate?: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceVerified: string;
  lastChecked: string;
  relevance: string;
  potentialImpact: string;
  recommendation: string;
  needsVerification?: boolean;
  confidenceLabel?: string;
  trace: Array<{ label: string; code: string; target?: string }>;
}

export const ATLANTICA_SIGNALS: DemoSignal[] = [
  {
    code: 'S-01',
    kind: 'ameaca',
    impactLabel: 'Impacto alto',
    category: 'Concorrência',
    radarGroup: 'setorial',
    metaRight: 'Setorial · Publicado em 10/11/2026',
    title: 'Brisa Concept oferece frete grátis acima de R$ 199',
    summary: 'Política válida para todo o Sul, publicada na página de entregas do concorrente.',
    sourceName: 'Site oficial da Brisa Concept',
    sourceVerified: 'Fonte primária da empresa citada · Situação: confirmada',
    lastChecked: '11/11/2026',
    relevance: 'Nossa régua de frete grátis é R$ 349. A diferença pode reduzir conversões online.',
    potentialImpact: 'Ameaça',
    recommendation: 'Avaliar a redução do valor mínimo para frete grátis.',
    trace: [
      { label: 'Documento', code: 'DOC-02', target: 'documentos' },
      { label: 'Radar', code: 'S-01', target: 'radar' },
      { label: 'Análise', code: 'A-01', target: 'analises' },
      { label: 'Decisão', code: 'D-01', target: 'decisoes' },
      { label: 'Ação', code: 'P-01', target: 'planos-acao' },
    ],
  },
  {
    code: 'S-02',
    kind: 'oportunidade',
    impactLabel: 'Impacto alto',
    category: 'Setor',
    radarGroup: 'setorial',
    metaRight: 'Setorial · Publicado em 09/11/2026',
    title: 'Marcas do setor antecipam coleções de linho para o verão',
    summary: 'Ao menos duas marcas regionais anunciaram lançamentos de linho para novembro.',
    sourceName: 'Revista setorial de moda',
    sourceVerified: 'Fonte jornalística identificada · Situação: em acompanhamento',
    lastChecked: '11/11/2026 · Anúncio da coleção no site da Costa Linho',
    relevance: 'Temos fornecedor homologado de linho. Antecipar pode garantir espaço antes dos concorrentes.',
    potentialImpact: 'Oportunidade (+R$ 42 mil estimativa)',
    recommendation: 'Avaliar a antecipação da coleção de linho.',
    trace: [
      { label: 'Radar', code: 'S-02', target: 'radar' },
      { label: 'Análise', code: 'A-02', target: 'analises' },
      { label: 'Decisão', code: 'D-02', target: 'decisoes' },
      { label: 'Ação', code: 'P-03', target: 'planos-acao' },
    ],
  },
  {
    code: 'S-03',
    kind: 'ameaca',
    impactLabel: 'Impacto médio',
    category: 'Custos',
    radarGroup: 'setorial',
    metaRight: 'Setorial · Publicado em 07/11/2026',
    title: 'Fornecedores anunciam alta de 12% no algodão',
    summary: 'Dois dos três fornecedores comunicaram reajuste por escrito para dezembro.',
    sourceName: 'Comunicados formais dos fornecedores',
    sourceVerified: 'Fonte primária identificada · Situação: confirmada',
    lastChecked: '07/11/2026 · Vigência prevista: 01/12/2026',
    relevance: 'Pressiona o custo das peças de algodão a partir de dezembro.',
    potentialImpact: 'Ameaça na margem bruta',
    recommendation: 'Renegociar contratos e cotar fornecedor alternativo.',
    trace: [
      { label: 'Radar', code: 'S-03', target: 'radar' },
      { label: 'Análise', code: 'A-03', target: 'analises' },
      { label: 'Decisão', code: 'D-03', target: 'decisoes' },
      { label: 'Ação', code: 'P-05', target: 'planos-acao' },
    ],
  },
  {
    code: 'S-04',
    kind: 'ameaca',
    impactLabel: 'Impacto médio',
    category: 'Concorrência',
    radarGroup: 'setorial',
    metaRight: 'Setorial · Publicado em 06/11/2026',
    title: 'Vitrine Sul inaugura loja no Shopping Beira-Mar',
    summary: 'Nova unidade fica a 1,2 km da nossa loja Centro.',
    sourceName: 'Jornal local & Comunicado do shopping',
    sourceVerified: 'Fonte jornalística identificada · Situação: confirmada',
    lastChecked: '10/11/2026 · Abertura prevista: 28/11/2026',
    relevance: 'Pode reduzir o fluxo da loja Centro nas semanas de inauguração.',
    potentialImpact: 'Ameaça local',
    recommendation: 'Preparar ação de vitrine e fidelidade para a semana da abertura.',
    trace: [
      { label: 'Documento', code: 'DOC-02', target: 'documentos' },
      { label: 'Radar', code: 'S-04', target: 'radar' },
      { label: 'Análise', code: 'A-01', target: 'analises' },
      { label: 'Decisão', code: 'D-01', target: 'decisoes' },
    ],
  },
  {
    code: 'S-05',
    kind: 'oportunidade',
    impactLabel: 'Impacto alto',
    category: 'Canais',
    radarGroup: 'consumidor',
    metaRight: 'Canais · Publicado em 05/11/2026',
    title: 'Vendas de moda pelo Instagram chegam a 18% do segmento',
    summary: 'Levantamento setorial aponta o canal como o que mais cresce entre 25 e 34 anos.',
    sourceName: 'Levantamento da entidade do varejo de moda',
    sourceVerified: 'Entidade setorial identificada · Situação: confirmada',
    lastChecked: '08/11/2026',
    relevance: 'Nosso catálogo ainda não está totalmente integrado ao canal.',
    potentialImpact: 'Oportunidade (+6% vendas online est.)',
    recommendation: 'Integrar o catálogo e publicar vitrines semanais.',
    trace: [
      { label: 'Radar', code: 'S-05', target: 'radar' },
      { label: 'Análise', code: 'A-05', target: 'analises' },
      { label: 'Decisão', code: 'D-05', target: 'decisoes' },
      { label: 'Ação', code: 'P-07', target: 'planos-acao' },
    ],
  },
  {
    code: 'S-06',
    kind: 'oportunidade',
    impactLabel: 'Impacto alto',
    category: 'Consumidor',
    radarGroup: 'consumidor',
    metaRight: 'Consumidor · 09/11/2026',
    title: 'Buscas por "vestido de linho" crescem 38% na região',
    summary: 'O crescimento apareceu entre mulheres de 25 a 44 anos nos últimos 30 dias.',
    sourceName: 'Tendências de busca regionais',
    sourceVerified: 'Painel de buscas · Situação: confirmada',
    lastChecked: '10/11/2026',
    relevance: 'Alta demanda por peças de linho na região Sul.',
    potentialImpact: 'Oportunidade (+R$ 42 mil na temporada)',
    recommendation: 'Reforçar estoque do Vestido Midi Linho e Blazer Linho Areia.',
    trace: [
      { label: 'Radar', code: 'S-06', target: 'radar' },
      { label: 'Análise', code: 'A-02', target: 'analises' },
      { label: 'Decisão', code: 'D-02', target: 'decisoes' },
    ],
  },
  {
    code: 'S-07',
    kind: 'oportunidade',
    impactLabel: 'Impacto médio',
    category: 'Eventos',
    radarGroup: 'setorial',
    metaRight: 'Setorial · Publicado em 05/11/2026',
    title: 'Feira regional de moda praia abre inscrições',
    summary: 'Público estimado de 12 mil visitantes. Inscrições até 30/11.',
    sourceName: 'Associação comercial regional',
    sourceVerified: 'Entidade setorial identificada · Situação: confirmada',
    lastChecked: '05/11/2026 · Evento em Janeiro/2027',
    relevance: 'Vitrine para a coleção de verão e captação de contatos.',
    potentialImpact: 'Oportunidade (300 contatos qualificados est.)',
    recommendation: 'Reservar estande até 30/11.',
    trace: [
      { label: 'Radar', code: 'S-07', target: 'radar' },
      { label: 'Análise', code: 'A-02', target: 'analises' },
      { label: 'Decisão', code: 'D-02', target: 'decisoes' },
    ],
  },
  {
    code: 'S-08',
    kind: 'pendente',
    impactLabel: 'Impacto médio',
    category: 'Tributação',
    radarGroup: 'macro',
    metaRight: 'Político e regulatório · 08/11/2026',
    title: 'Proposta de alteração do ICMS em vendas interestaduais',
    summary: 'Tema em pauta no conselho. Não há norma aprovada até a última verificação.',
    sourceName: 'CONFAZ — Conselho Nacional de Política Fazendária',
    sourceVerified: 'Fonte oficial · Situação: proposta em discussão',
    lastChecked: '11/11/2026',
    relevance: 'Se aprovada, pode alterar o preço final das vendas online para outros estados.',
    potentialImpact: 'Informação para verificação',
    recommendation: 'Solicitar ao responsável tributário uma avaliação da exposição da empresa.',
    needsVerification: true,
    confidenceLabel: 'proposta em discussão',
    trace: [
      { label: 'Radar', code: 'S-08', target: 'radar' },
      { label: 'Análise', code: 'A-06', target: 'analises' },
      { label: 'Decisão', code: 'D-09', target: 'decisoes' },
    ],
  },
  {
    code: 'S-09',
    kind: 'pendente',
    impactLabel: 'Impacto alto',
    category: 'Concorrência',
    radarGroup: 'setorial',
    metaRight: 'Setorial · Publicado em 09/11/2026',
    title: 'Brisa Concept teria reduzido preços em 8%',
    summary: 'Relato de cliente na loja. Sem confirmação no catálogo público.',
    sourceName: 'Relato de cliente',
    sourceVerified: 'Fonte não verificável · Situação: não confirmada',
    lastChecked: '09/11/2026',
    relevance: 'Se confirmado, aumentaria a pressão sobre preços.',
    potentialImpact: 'Informação para verificação',
    recommendation: 'Conferir o catálogo público antes de qualquer reação.',
    needsVerification: true,
    confidenceLabel: 'não confirmada',
    trace: [
      { label: 'Radar', code: 'S-09', target: 'radar' },
      { label: 'Verificar', code: 'V-02', target: 'verificar' },
    ],
  },
  {
    code: 'S-10',
    kind: 'movimento',
    impactLabel: 'Impacto baixo',
    category: 'Setor',
    radarGroup: 'setorial',
    metaRight: 'Setorial · Publicado em 02/11/2026',
    title: 'Moda sustentável ganha espaço nas vitrines locais',
    summary: '3 de 5 concorrentes destacam peças com tecido reciclado.',
    sourceName: 'Visita de campo da equipe',
    sourceVerified: 'Observação interna · Situação: confirmada',
    lastChecked: '02/11/2026',
    relevance: 'Tendência a acompanhar na próxima coleção.',
    potentialImpact: 'Informação para acompanhamento',
    recommendation: 'Considerar linha cápsula de algodão reciclado.',
    trace: [{ label: 'Radar', code: 'S-10', target: 'radar' }],
  },
  {
    code: 'S-11',
    kind: 'movimento',
    impactLabel: 'Impacto médio',
    category: 'Macroeconomia',
    radarGroup: 'macro',
    metaRight: 'Macroeconômico · 20/11/2026',
    title: 'Copom mantém a taxa Selic',
    summary: 'Juros básicos seguem no mesmo patamar da reunião anterior.',
    sourceName: 'Banco Central do Brasil',
    sourceVerified: 'Fonte oficial · Situação: confirmada',
    lastChecked: '11/11/2026',
    relevance: 'Crédito para compra de estoque segue caro. Antecipar pedidos exige cautela.',
    potentialImpact: 'Informação para acompanhamento',
    recommendation: 'Limitar parcelamento sem juros acima de 6x.',
    trace: [{ label: 'Radar', code: 'S-11', target: 'radar' }],
  },
  {
    code: 'S-12',
    kind: 'movimento',
    impactLabel: 'Impacto médio',
    category: 'Macroeconomia',
    radarGroup: 'macro',
    metaRight: 'Macroeconômico · 10/11/2026',
    title: 'Preços de vestuário sobem acima da inflação geral',
    summary: 'Grupo vestuário acumula alta maior que o índice geral em 12 meses.',
    sourceName: 'IBGE — Instituto Brasileiro de Geografia e Estatística',
    sourceVerified: 'Fonte oficial · Situação: confirmada',
    lastChecked: '11/11/2026',
    relevance: 'Espaço limitado para repassar a alta do algodão sem perder competitividade.',
    potentialImpact: 'Informação para acompanhamento',
    recommendation: 'Priorizar ganho de ticket médio via kits e acessórios.',
    trace: [
      { label: 'Radar', code: 'S-12', target: 'radar' },
      { label: 'Análise', code: 'A-03', target: 'analises' },
    ],
  },
  {
    code: 'S-13',
    kind: 'ameaca',
    impactLabel: 'Impacto baixo',
    category: 'Macroeconomia',
    radarGroup: 'macro',
    metaRight: 'Macroeconômico · 11/11/2026',
    title: 'Dólar em alta encarece tecidos importados',
    summary: 'Moeda americana subiu nas últimas quatro semanas.',
    sourceName: 'Banco Central do Brasil',
    sourceVerified: 'Fonte oficial · Situação: confirmada',
    lastChecked: '11/11/2026',
    relevance: 'Afeta cerca de 20% do mix que usa tecido importado.',
    potentialImpact: 'Ameaça',
    recommendation: 'Revisar custos de aviamentos e tecidos importados.',
    trace: [
      { label: 'Radar', code: 'S-13', target: 'radar' },
      { label: 'Análise', code: 'A-03', target: 'analises' },
      { label: 'Decisão', code: 'D-03', target: 'decisoes' },
    ],
  },
  {
    code: 'S-14',
    kind: 'movimento',
    impactLabel: 'Impacto alto',
    category: 'Tributação',
    radarGroup: 'macro',
    metaRight: 'Político e regulatório · 04/11/2026',
    title: 'Orientações sobre a transição para IBS e CBS',
    summary: 'Cronograma define novas obrigações para o comércio varejista.',
    sourceName: 'Receita Federal do Brasil',
    sourceVerified: 'Fonte oficial · Situação: norma vigente',
    lastChecked: '11/11/2026',
    relevance: 'Sistemas de nota fiscal e formação de preços precisarão de ajustes.',
    potentialImpact: 'Informação para acompanhamento',
    recommendation: 'Planejar a adaptação com o responsável tributário.',
    trace: [
      { label: 'Radar', code: 'S-14', target: 'radar' },
      { label: 'Análise', code: 'A-06', target: 'analises' },
      { label: 'Decisão', code: 'D-09', target: 'decisoes' },
    ],
  },
  {
    code: 'S-15',
    kind: 'pendente',
    impactLabel: 'Impacto médio',
    category: 'Legislação',
    radarGroup: 'macro',
    metaRight: 'Político e regulatório · 06/11/2026',
    title: 'Projeto de lei propõe novas regras para trocas em compras online',
    summary: 'Em tramitação. Não foi aprovado e não gera obrigação vigente.',
    sourceName: 'Câmara dos Deputados',
    sourceVerified: 'Fonte oficial · Situação: projeto de lei',
    lastChecked: '11/11/2026',
    relevance: 'Se aprovado, poderia exigir prazos de troca menores que os nossos.',
    potentialImpact: 'Informação para verificação',
    recommendation: 'Acompanhar a tramitação. Não tratar como obrigação vigente.',
    needsVerification: true,
    confidenceLabel: 'projeto de lei',
    trace: [{ label: 'Radar', code: 'S-15', target: 'radar' }],
  },
  {
    code: 'S-16',
    kind: 'ameaca',
    impactLabel: 'Impacto médio',
    category: 'Consumidor',
    radarGroup: 'consumidor',
    metaRight: 'Reputação · 06/11',
    title: 'Avaliações citam demora nas trocas',
    summary: 'Reclamações mencionam espera de 9 a 10 dias. Prazo médio atual: 9 dias.',
    sourceName: 'Google Reviews & Pós-venda',
    sourceVerified: 'Canal monitorado · Situação: confirmada',
    lastChecked: '06/11/2026',
    relevance: 'Clientes que passam por troca têm 50% menos recompra em 60 dias.',
    potentialImpact: 'Ameaça à retenção',
    recommendation: 'Implantar troca na loja física e coleta em até 48h.',
    trace: [
      { label: 'Documento', code: 'DOC-03', target: 'documentos' },
      { label: 'Análise', code: 'A-04', target: 'analises' },
      { label: 'Decisão', code: 'D-04', target: 'decisoes' },
    ],
  },
];

export interface DemoAnalysis {
  code: string;
  tag: string;
  classification: 'oportunidade' | 'ameaca' | 'atencao';
  updatedAt: string;
  title: string;
  summary: string;
  problem: string;
  evidenceSummary: string;
  dataSourcesUsed: string;
  potentialImpact: string;
  strategicRecommendation: string;
  justification: string;
  originSignals: Array<{ kind: SemanticKind; text: string }>;
  trace: Array<{ label: string; code: string; target?: string }>;
}

export const ATLANTICA_ANALYSES: DemoAnalysis[] = [
  {
    code: 'A-01',
    tag: 'Concorrência',
    classification: 'ameaca',
    updatedAt: 'Atualizada 10/11',
    title: 'Pressão competitiva no e-commerce e na loja Centro',
    summary: 'Frete e proximidade física reduzem nossa vantagem. Risco de perda de vendas online.',
    problem: 'Abandono de carrinho subiu de 68% para 74% no e-commerce e a loja Centro enfrenta nova concorrente a 1,2 km.',
    evidenceSummary: 'Brisa Concept lançou frete grátis a partir de R$ 199 (vs. R$ 349 da Atlântica Moda) e Vitrine Sul inaugura loja no Shopping Beira-Mar em 28/11.',
    dataSourcesUsed: 'DOC-02 (Comercial Out/2026) + S-01 (Site Brisa Concept) + S-04 (Shopping Beira-Mar)',
    potentialImpact: 'Ameaça direta de 4 p.p. na conversão online e fluxo presencial de novembro/dezembro.',
    strategicRecommendation: 'Reduzir frete grátis para R$ 249 em teste de 60 dias e ativar campanha local de fidelidade na loja Centro.',
    justification: 'Ticket médio atual é R$ 236; régua de R$ 249 estimula adição de +1 acessório sem comprometer a margem de 52%.',
    originSignals: [
      { kind: 'ameaca', text: 'Brisa Concept oferece frete grátis acima de R$ 199' },
      { kind: 'ameaca', text: 'Vitrine Sul inaugura loja no Shopping Beira-Mar' },
    ],
    trace: [
      { label: 'Documento', code: 'DOC-02', target: 'documentos' },
      { label: 'Radar', code: 'S-01', target: 'radar' },
      { label: 'Análise', code: 'A-01', target: 'analises' },
      { label: 'Decisão', code: 'D-01', target: 'decisoes' },
      { label: 'Ação', code: 'P-01 P-02', target: 'planos-acao' },
    ],
  },
  {
    code: 'A-02',
    tag: 'Setor',
    classification: 'oportunidade',
    updatedAt: 'Atualizada 09/11',
    title: 'Janela para coleção de verão em linho',
    summary: 'Janela de 6 a 8 semanas para chegar antes dos concorrentes.',
    problem: 'Estoque do Blazer Alfaiataria Linho Areia caiu para 9 unidades enquanto buscas por linho disparam.',
    evidenceSummary: 'Buscas regionais por "vestido de linho" cresceram +38% em 30 dias e Costa Linho antecipou coleção para novembro.',
    dataSourcesUsed: 'Catálogo Atlântica Moda (ATL-BLZ-008) + S-02 (Costa Linho) + S-06 (Tendências de Busca) + S-07 (Feira Moda Praia)',
    potentialImpact: 'Oportunidade estimada de +R$ 42 mil na temporada pré-verão com margem acima de 57%.',
    strategicRecommendation: 'Antecipar pedido de 400 peças com fornecedor homologado de linho e reservar estande na feira.',
    justification: 'Peças em linho apresentam as maiores margens da loja (57,2% a 59,5%) e tendência positiva de demanda orgânica.',
    originSignals: [
      { kind: 'oportunidade', text: 'Marcas do setor antecipam coleções de linho para o verão' },
      { kind: 'oportunidade', text: 'Feira regional de moda praia abre inscrições' },
    ],
    trace: [
      { label: 'Radar', code: 'S-02 S-07', target: 'radar' },
      { label: 'Análise', code: 'A-02', target: 'analises' },
      { label: 'Decisão', code: 'D-02', target: 'decisoes' },
      { label: 'Ação', code: 'P-03 P-04', target: 'planos-acao' },
    ],
  },
  {
    code: 'A-03',
    tag: 'Custos',
    classification: 'ameaca',
    updatedAt: 'Atualizada 11/11',
    title: 'Custo de insumos em alta',
    summary: 'Algodão, câmbio e inflação do vestuário pressionam o preço das peças.',
    problem: 'Margem bruta recuou para 52% (meta 54%) e enfrenta novo reajuste de matéria-prima em dezembro.',
    evidenceSummary: '2 de 3 fornecedores anunciaram +12% no algodão, dólar PTAX em alta encarece 20% do mix importado e IPCA vestuário (+5,8%) já supera o geral.',
    dataSourcesUsed: 'S-03 (Fornecedores) + S-12 (IBGE IPCA Vestuário) + S-13 (BCB Câmbio)',
    potentialImpact: 'Risco de compressão de até 2,5 p.p. na margem bruta no 1º trimestre.',
    strategicRecommendation: 'Fechar compra programada semestral com desconto de volume e homologar fornecedor nacional alternativo.',
    justification: 'Como o vestuário já subiu acima da inflação, repassar 100% do aumento ao cliente reduziria giro nas lojas.',
    originSignals: [
      { kind: 'ameaca', text: 'Fornecedores anunciam alta de 12% no algodão' },
      { kind: 'movimento', text: 'Preços de vestuário sobem acima da inflação geral' },
      { kind: 'ameaca', text: 'Dólar em alta encarece tecidos importados' },
    ],
    trace: [
      { label: 'Radar', code: 'S-03 S-12 S-13', target: 'radar' },
      { label: 'Análise', code: 'A-03', target: 'analises' },
      { label: 'Decisão', code: 'D-03', target: 'decisoes' },
      { label: 'Ação', code: 'P-05', target: 'planos-acao' },
    ],
  },
  {
    code: 'A-04',
    tag: 'Experiência',
    classification: 'atencao',
    updatedAt: 'Atualizada 06/11',
    title: 'Experiência pós-venda afeta recompra',
    summary: 'Clientes que passam por troca têm 50% menos recompra em 60 dias.',
    problem: 'Prazo médio real de troca está em 9 dias (vs. meta interna de 3 dias), derrubando o NPS para 41.',
    evidenceSummary: 'DOC-03 revela que 36% das avaliações neutras/negativas citam lentidão na logística reversa; há divergência entre p. 2 e p. 6 a auditar.',
    dataSourcesUsed: 'DOC-03 (Pós-Venda) + Google Reviews + Voz do Consumidor',
    potentialImpact: 'Retenção comprometida na base ativa de e-commerce.',
    strategicRecommendation: 'Habilitar troca presencial expressa na loja Centro/Beira-Mar e coleta reversa em até 48h.',
    justification: 'Transformar a troca em visita presencial gera oportunidade de venda adicional no provador.',
    originSignals: [{ kind: 'ameaca', text: 'Avaliações citam demora nas trocas' }],
    trace: [
      { label: 'Documento', code: 'DOC-03', target: 'documentos' },
      { label: 'Análise', code: 'A-04', target: 'analises' },
      { label: 'Decisão', code: 'D-04', target: 'decisoes' },
      { label: 'Ação', code: 'P-06', target: 'planos-acao' },
    ],
  },
  {
    code: 'A-05',
    tag: 'Canais',
    classification: 'oportunidade',
    updatedAt: 'Atualizada 05/11',
    title: 'Redes sociais como canal de venda direta',
    summary: 'Canal em crescimento no setor e ainda pouco explorado pela marca.',
    problem: 'Queda de alcance em mídia paga reduz retorno de tráfego enquanto o Instagram orgânico cresce sem link de compra direta.',
    evidenceSummary: 'DOC-05 (Marketing Out/2026) comprova alta de engajamento orgânico (F-02) e levantamento setorial mostra 18% das vendas do setor via Instagram.',
    dataSourcesUsed: 'DOC-05 (Relatório Marketing) + S-05 (Entidade Varejo Moda)',
    potentialImpact: 'Estimativa de +6% nas vendas online sem depender apenas de tráfego pago caro.',
    strategicRecommendation: 'Integrar catálogo completo no Instagram Shopping e padronizar roteiros de atendimento via Direct.',
    justification: 'Aproveita audiência orgânica já conquistada pela Atlântica Moda com custo marginal baixo.',
    originSignals: [{ kind: 'oportunidade', text: 'Vendas de moda pelo Instagram chegam a 18% do segmento' }],
    trace: [
      { label: 'Radar', code: 'S-05', target: 'radar' },
      { label: 'Análise', code: 'A-05', target: 'analises' },
      { label: 'Decisão', code: 'D-05', target: 'decisoes' },
      { label: 'Ação', code: 'P-07 P-08 P-09', target: 'planos-acao' },
    ],
  },
  {
    code: 'A-06',
    tag: 'Regulatório',
    classification: 'atencao',
    updatedAt: 'Atualizada 11/11',
    title: 'Exposição tributária do comércio eletrônico',
    summary: 'Transição IBS/CBS exige adaptação. Mudança no ICMS ainda é proposta.',
    problem: 'Vendas interestaduais pelo e-commerce precisarão adaptar regras de destaque fiscal e precificação na transição tributária.',
    evidenceSummary: 'Orientações vigentes da Receita Federal sobre IBS/CBS (S-14) e pauta em discussão no CONFAZ (S-08, ainda sem aprovação).',
    dataSourcesUsed: 'S-14 (Receita Federal) + S-08 (CONFAZ - pendente de verificação)',
    potentialImpact: 'Risco de erro fiscal ou distorção de margem líquida em pedidos para fora de SC.',
    strategicRecommendation: 'Solicitar diagnóstico de exposição tributária ao contador e revisar cadastro de NCM no ERP.',
    justification: 'Garante conformidade preventiva sem antecipar custos sobre propostas ainda não vigentes.',
    originSignals: [
      { kind: 'movimento', text: 'Orientações sobre a transição para IBS e CBS' },
      { kind: 'pendente', text: 'Proposta de alteração do ICMS em vendas interestaduais' },
    ],
    trace: [
      { label: 'Radar', code: 'S-14 S-08', target: 'radar' },
      { label: 'Análise', code: 'A-06', target: 'analises' },
      { label: 'Decisão', code: 'D-09', target: 'decisoes' },
      { label: 'Ação', code: 'P-15', target: 'planos-acao' },
    ],
  },
];

export interface DemoDecision {
  code: string;
  title: string;
  priority: 'Prioridade alta' | 'Prioridade média';
  status: 'pendente' | 'aprovada' | 'adiada' | 'descartada';
  due: string;
  problem: string;
  evidence: string;
  justification: string;
  suggestedAction: string;
  expectedOutcome: string;
  kpisToTrack: string;
  trace: Array<{ label: string; code: string; target?: string }>;
}

export const ATLANTICA_INITIAL_DECISIONS: DemoDecision[] = [
  {
    code: 'D-01',
    title: 'Reduzir valor mínimo para frete grátis',
    priority: 'Prioridade alta',
    status: 'pendente',
    due: 'Prazo 15/11',
    problem: 'Perda de competitividade no e-commerce.',
    evidence: 'Brisa Concept: frete grátis a partir de R$ 199. Relatório comercial: abandono de carrinho de 68% para 74%.',
    justification: 'Com ticket médio de R$ 236, baixar a régua de R$ 349 para R$ 249 estimula adição de itens sem subsidiar pedidos pequenos.',
    suggestedAction: 'Testar frete grátis acima de R$ 249 por 60 dias.',
    expectedOutcome: 'Recuperar 4 p.p. na conversão online',
    kpisToTrack: 'Taxa de conversão online · Abandono de carrinho · Ticket médio e-commerce',
    trace: [
      { label: 'Documento', code: 'DOC-02', target: 'documentos' },
      { label: 'Radar', code: 'S-01 S-04', target: 'radar' },
      { label: 'Análise', code: 'A-01', target: 'analises' },
      { label: 'Decisão', code: 'D-01', target: 'decisoes' },
      { label: 'Ação', code: 'P-01 P-02', target: 'planos-acao' },
    ],
  },
  {
    code: 'D-02',
    title: 'Antecipar coleção de linho',
    priority: 'Prioridade alta',
    status: 'pendente',
    due: 'Prazo 20/11',
    problem: 'Concorrentes devem chegar antes ao verão e estoque do Blazer Areia caiu para 9 un.',
    evidence: 'Marcas do setor antecipam linho. Buscas subiram +38%. Feira de moda praia em janeiro.',
    justification: 'Garantir abastecimento dos 2 SKUs mais rentáveis (margem >57%) antes do pico sazonal de dezembro/janeiro.',
    suggestedAction: 'Antecipar pedido de 400 peças e reservar estande na feira.',
    expectedOutcome: '+R$ 42 mil na temporada (estimativa)',
    kpisToTrack: 'Receita da cápsula linho · Dias de estoque · Contatos qualificados na feira',
    trace: [
      { label: 'Radar', code: 'S-02 S-07', target: 'radar' },
      { label: 'Análise', code: 'A-02', target: 'analises' },
      { label: 'Decisão', code: 'D-02', target: 'decisoes' },
      { label: 'Ação', code: 'P-03 P-04', target: 'planos-acao' },
    ],
  },
  {
    code: 'D-09',
    title: 'Planejar adaptação à transição IBS/CBS',
    priority: 'Prioridade média',
    status: 'pendente',
    due: 'Prazo 10/12',
    problem: 'Mudança tributária com impacto no comércio eletrônico.',
    evidence: 'Orientações oficiais da Receita Federal sobre o calendário de transição.',
    justification: 'Evitar ajustes emergenciais de sistema fiscal e proteger a formação de preço nas vendas para outros estados.',
    suggestedAction: 'Avaliar a exposição da empresa e pedir plano de adaptação ao responsável tributário.',
    expectedOutcome: 'Sistemas e preços adaptados dentro do prazo oficial',
    kpisToTrack: 'Checklist fiscal concluído · Margem líquida interestadual',
    trace: [
      { label: 'Radar', code: 'S-14 S-08', target: 'radar' },
      { label: 'Análise', code: 'A-06', target: 'analises' },
      { label: 'Decisão', code: 'D-09', target: 'decisoes' },
      { label: 'Ação', code: 'P-15', target: 'planos-acao' },
    ],
  },
  {
    code: 'D-03',
    title: 'Renegociar contratos de algodão',
    priority: 'Prioridade média',
    status: 'pendente',
    due: 'Prazo 30/11',
    problem: 'Reajuste de insumos compromete a margem.',
    evidence: 'Dois fornecedores anunciaram alta de 12% para dezembro; dólar pressiona importados.',
    justification: 'Comprometer volume semestral garante desconto progressivo e reduz dependência de único fornecedor.',
    suggestedAction: 'Negociar volume semestral e cotar um fornecedor alternativo.',
    expectedOutcome: 'Conter a alta de custo das peças de algodão',
    kpisToTrack: 'Custo unitário de aquisição · Margem bruta mensal (meta 54%)',
    trace: [
      { label: 'Radar', code: 'S-03 S-12 S-13', target: 'radar' },
      { label: 'Análise', code: 'A-03', target: 'analises' },
      { label: 'Decisão', code: 'D-03', target: 'decisoes' },
      { label: 'Ação', code: 'P-05', target: 'planos-acao' },
    ],
  },
  {
    code: 'D-04',
    title: 'Reduzir prazo de trocas para 48 horas',
    priority: 'Prioridade média',
    status: 'pendente',
    due: 'Prazo 05/12',
    problem: 'Prazo de troca acima da meta interna (9 dias vs. meta 3).',
    evidence: 'Relatório operacional: 36% das menções neutras/negativas citam etapa de troca reversa.',
    justification: 'Clientes pós-troca recompram 50% menos em 60 dias; resolver rápido preserva LTV e melhora o NPS (41).',
    suggestedAction: 'Trocas na loja física para compras online e coleta em 48h.',
    expectedOutcome: 'Prazo médio de troca de até 3 dias',
    kpisToTrack: 'SLA médio de troca (dias) · NPS pós-venda · Taxa de recompra em 60d',
    trace: [
      { label: 'Documento', code: 'DOC-03', target: 'documentos' },
      { label: 'Decisão', code: 'D-04', target: 'decisoes' },
      { label: 'Ação', code: 'P-06', target: 'planos-acao' },
    ],
  },
  {
    code: 'D-05',
    title: 'Ativar vendas pelo Instagram',
    priority: 'Prioridade média',
    status: 'aprovada',
    due: 'Aprovada em 05/11',
    problem: 'Canal responde por 18% do setor e não estava integrado ao catálogo.',
    evidence: 'Relatório de Marketing F-02 aponta alto engajamento orgânico sem link direto.',
    justification: 'Converte tráfego orgânico já existente em vendas diretas com investimento mínimo em mídia paga.',
    suggestedAction: 'Integrar catálogo, publicar vitrines semanais e treinar direct.',
    expectedOutcome: '+6% nas vendas online (estimativa)',
    kpisToTrack: 'Pedidos originados no Instagram · Taxa de resposta via Direct',
    trace: [
      { label: 'Radar', code: 'S-05', target: 'radar' },
      { label: 'Análise', code: 'A-05', target: 'analises' },
      { label: 'Decisão', code: 'D-05', target: 'decisoes' },
      { label: 'Ação', code: 'P-07 P-08 P-09', target: 'planos-acao' },
    ],
  },
  {
    code: 'D-06',
    title: 'Oferecer 5% no Pix vs. limitar 6x sem juros',
    priority: 'Prioridade média',
    status: 'adiada',
    due: 'Revisar em 22/11',
    problem: 'Selic elevada encarece antecipação de recebíveis acima de 6x.',
    evidence: '41% das vendas e-commerce ocorrem entre 6x e 10x.',
    justification: 'Desconto à vista no Pix reduz custo financeiro de antecipação bancária com Selic a 13,75% a.a.',
    suggestedAction: 'Incentivar Pix com 5% de desconto no checkout.',
    expectedOutcome: '+2,1 p.p. margem líquida',
    kpisToTrack: '% participação Pix no checkout · Custo financeiro de antecipação',
    trace: [
      { label: 'Radar', code: 'S-11', target: 'radar' },
      { label: 'Decisão', code: 'D-06', target: 'decisoes' },
    ],
  },
];

export interface DemoActionItem {
  code: string;
  decisionCode: string;
  decisionTitle: string;
  title: string;
  owner: string;
  due: string;
  priority: 'Alta' | 'Média' | 'Baixa';
  resources: string;
  kpi: string;
  completionPct: number;
  status: 'a_fazer' | 'em_andamento' | 'concluida';
  trace: Array<{ label: string; code: string; target?: string }>;
}

export const ATLANTICA_INITIAL_ACTIONS: DemoActionItem[] = [
  {
    code: 'P-07',
    decisionCode: 'D-05',
    decisionTitle: 'Ativar vendas pelo Instagram',
    title: 'Integrar catálogo ao Instagram',
    owner: 'Camila · Marketing',
    due: 'Prazo 14/11',
    priority: 'Alta',
    resources: 'ERP + Gerenciador Meta Commerce (sem custo extra)',
    kpi: '100% dos SKUs ativos sincronizados com tag de compra',
    completionPct: 65,
    status: 'em_andamento',
    trace: [
      { label: 'Radar', code: 'S-05', target: 'radar' },
      { label: 'Análise', code: 'A-05', target: 'analises' },
      { label: 'Decisão', code: 'D-05', target: 'decisoes' },
      { label: 'Ação', code: 'P-07', target: 'planos-acao' },
    ],
  },
  {
    code: 'P-08',
    decisionCode: 'D-05',
    decisionTitle: 'Ativar vendas pelo Instagram',
    title: 'Produzir 3 vitrines semanais de conteúdo',
    owner: 'Camila · Marketing',
    due: 'Prazo Contínuo',
    priority: 'Média',
    resources: '4h/semana equipe de conteúdo + provador loja Centro',
    kpi: 'Taxa de cliques na sacola >= 3,2% por publicação',
    completionPct: 25,
    status: 'a_fazer',
    trace: [
      { label: 'Radar', code: 'S-05', target: 'radar' },
      { label: 'Análise', code: 'A-05', target: 'analises' },
      { label: 'Decisão', code: 'D-05', target: 'decisoes' },
      { label: 'Ação', code: 'P-08', target: 'planos-acao' },
    ],
  },
  {
    code: 'P-09',
    decisionCode: 'D-05',
    decisionTitle: 'Ativar vendas pelo Instagram',
    title: 'Treinar equipe para atendimento via direct',
    owner: 'Juliana · Operações',
    due: 'Prazo 08/11',
    priority: 'Alta',
    resources: 'Roteiro de atendimento e links de pagamento rápido',
    kpi: 'Tempo médio de resposta <= 15 minutos em horário comercial',
    completionPct: 100,
    status: 'concluida',
    trace: [
      { label: 'Radar', code: 'S-05', target: 'radar' },
      { label: 'Análise', code: 'A-05', target: 'analises' },
      { label: 'Decisão', code: 'D-05', target: 'decisoes' },
      { label: 'Ação', code: 'P-09', target: 'planos-acao' },
    ],
  },
];

export interface DemoDocument {
  id: string;
  format: 'CSV' | 'DOCX' | 'PDF' | 'XLSX' | 'PPTX';
  status: 'Em processamento' | 'Aguardando interpretação' | 'Com inconsistências' | 'Interpretado' | 'Arquivado';
  title: string;
  meta: string;
  summary: string;
}

export const ATLANTICA_INITIAL_DOCUMENTS: DemoDocument[] = [
  {
    id: 'DOC-01',
    format: 'CSV',
    status: 'Em processamento',
    title: 'Relatório de RH — rotatividade nas lojas',
    meta: 'Recursos Humanos · Paulo Mendes · Enviado em 11/11/2026 · Período out/2026 · 180 KB',
    summary: 'Dados de turnover das equipes de loja física Centro e Beira-Mar.',
  },
  {
    id: 'DOC-04',
    format: 'DOCX',
    status: 'Aguardando interpretação',
    title: 'Planejamento estratégico 2027 — versão preliminar',
    meta: 'Gestão Estratégica · Marina Costa · Enviado em 10/11/2026 · Período 2027 · 1,1 MB',
    summary: 'Metas de expansão de coleções cápsula de linho e abertura de canais.',
  },
  {
    id: 'DOC-03',
    format: 'PDF',
    status: 'Com inconsistências',
    title: 'Relatório operacional — pós-venda',
    meta: 'Operações · Juliana Alves · Enviado em 06/11/2026 · Período out/2026 · 860 KB',
    summary: 'Prazo médio de troca 9 dias (meta 3 dias). Divergência entre p. 2 e p. 6 requer validação.',
  },
  {
    id: 'DOC-02',
    format: 'XLSX',
    status: 'Interpretado',
    title: 'Relatório comercial — outubro',
    meta: 'Comercial · Rafael Lima · Enviado em 05/11/2026 · Período out/2026 · 540 KB',
    summary: 'Abandono de carrinho subiu de 68% para 74%; pressão por descontos e impacto do frete grátis.',
  },
  {
    id: 'DOC-05',
    format: 'PDF',
    status: 'Interpretado',
    title: 'Relatório mensal de Marketing — outubro',
    meta: 'Marketing · Camila Rocha · Enviado em 04/11/2026 · Período out/2026 · 2,4 MB',
    summary: 'Redução de alcance pago e alta de engajamento orgânico no Instagram (F-02).',
  },
  {
    id: 'DOC-06',
    format: 'PPTX',
    status: 'Arquivado',
    title: 'Apresentação executiva — 3º trimestre',
    meta: 'Diretoria · Marina Costa · Enviado em 08/10/2026 · Período jul-set/2026 · 4,8 MB',
    summary: 'Fechamento consolidado Q3 com margens por coleção e desempenho das unidades.',
  },
];

export const ATLANTICA_MACRO = [
  {
    code: 'SELIC',
    label: 'Taxa Selic',
    value: '13,75% a.a.',
    delta: 'Estável vs. reunião anterior (0,00 p.p.)',
    source: 'Banco Central do Brasil (COPOM)',
    sourceUrl: 'https://www.bcb.gov.br/controleinflacao/taxaselic',
    date: 'Ref. demonstrativa (nov/2026)',
    impact: 'Crédito e parcelamento exigem controle.',
    plainExplanation: 'É a taxa básica de juros da economia; define quanto custa financiar estoques e antecipar parcelas de cartão.',
    businessEffect: 'Na Atlântica Moda, 41% das vendas online são parceladas de 6x a 10x — com Selic alta, a antecipação bancária reduz a margem líquida.',
    practicalTip: 'Incentive o Pix à vista (5% de desconto) ou limite o parcelamento sem juros até 6x.',
  },
  {
    code: 'IPCA',
    label: 'IPCA 12 meses',
    value: '4,6%',
    delta: '+0,1 p.p. vs. mês anterior (4,5%)',
    source: 'IBGE (SIDRA)',
    sourceUrl: 'https://www.ibge.gov.br/indicadores',
    date: 'Ref. demonstrativa (out/2026)',
    impact: 'Moderado: repasse gradual em coleções cápsula.',
    plainExplanation: 'Mede o quanto os preços médios ao consumidor subiram nos últimos 12 meses no Brasil.',
    businessEffect: 'Pressiona energia, aluguel da loja Centro e frete, reduzindo o poder de compra se o repasse for abrupto.',
    practicalTip: 'Evite reajustes lineares; ajuste preços primeiro em peças cápsula de linho com maior valor percebido.',
  },
  {
    code: 'IPCA_ANO',
    label: 'IPCA acumulado no ano',
    value: '3,9%',
    delta: '+0,4 p.p. vs. mesmo período anterior',
    source: 'IBGE (SIDRA)',
    sourceUrl: 'https://www.ibge.gov.br/indicadores',
    date: 'Ref. demonstrativa (jan–out/2026)',
    impact: 'Atenção no orçamento anual de despesas fixas.',
    plainExplanation: 'Mostra a inflação acumulada dentro do ano corrente até o último fechamento divulgado.',
    businessEffect: 'Serve como referência direta para renegociação de aluguel, folha e contratos semestrais com confecções.',
    practicalTip: 'Use o acumulado do ano como teto nas negociações com fornecedores de algodão.',
  },
  {
    code: 'IPCA_VEST',
    label: 'IPCA vestuário 12 meses',
    value: '5,8%',
    delta: '+1,2 p.p. acima do IPCA geral',
    source: 'IBGE (Grupo Vestuário)',
    sourceUrl: 'https://www.ibge.gov.br/indicadores',
    date: 'Ref. demonstrativa (out/2026)',
    impact: 'Acima da inflação geral; exige eficiência em margem.',
    plainExplanation: 'Variação específica dos preços de roupas e acessórios no varejo brasileiro.',
    businessEffect: 'Cliente percebe mais caro o vestuário e compara preço antes de fechar pedido online.',
    practicalTip: 'Trabalhe kits combinados (vestido + bolsa) para elevar ticket médio sem parecer aumento unitário.',
  },
  {
    code: 'CAMBIO',
    label: 'Dólar comercial (PTAX)',
    value: 'R$ 5,42',
    delta: '+2,8% vs. 30 dias atrás (R$ 5,27)',
    source: 'Banco Central do Brasil (PTAX)',
    sourceUrl: 'https://www.bcb.gov.br/estabilidadefinanceira/fechamentodolar',
    date: 'Ref. demonstrativa (11/11/2026)',
    impact: 'Afeta ~20% do mix com tecido importado.',
    plainExplanation: 'Cotação oficial do dólar que impacta tecidos importados, aviamentos e insumos cotados em moeda estrangeira.',
    businessEffect: 'Aproximadamente 20% das peças da Atlântica Moda sofrem pressão direta no custo de reposição.',
    practicalTip: 'Substitua parte dos tecidos importados por linho misto e algodão nacional com contrato semestral.',
  },
  {
    code: 'PIB_REAL',
    label: 'PIB trimestral',
    value: '+0,4%',
    delta: '-0,1 p.p. vs. trimestre anterior (+0,5%)',
    source: 'IBGE · Contas Nacionais',
    sourceUrl: 'https://www.ibge.gov.br/indicadores',
    date: 'Ref. demonstrativa (T3/2026)',
    impact: 'Crescimento moderado de demanda.',
    plainExplanation: 'Indica se a economia brasileira está acelerando ou desacelerando na produção e consumo.',
    businessEffect: 'Expansão moderada significa crescimento orgânico limitado — ganhar participação exige tirar cliente da concorrência.',
    practicalTip: 'Concentre esforços no diferencial de atendimento e frete competitivo (R$ 249) em vez de apostar em alta generalizada do mercado.',
  },
  {
    code: 'DESEMPREGO',
    label: 'Desemprego (PNAD)',
    value: '6,1%',
    delta: '-0,3 p.p. vs. trimestre anterior (6,4%)',
    source: 'IBGE · PNAD Contínua',
    sourceUrl: 'https://www.ibge.gov.br/indicadores',
    date: 'Ref. demonstrativa (out/2026)',
    impact: 'Sustenta consumo de moda em faixas A/B.',
    plainExplanation: 'Percentual da população economicamente ativa em busca de emprego; afeta diretamente renda disponível.',
    businessEffect: 'Desemprego em queda favorece o público 25–44 anos em Florianópolis com intenção de compra pré-verão.',
    practicalTip: 'Aproveite o bom momento de renda local para antecipar a coleção de verão em linho (D-02).',
  },
  {
    code: 'PIB_PER_CAPITA',
    label: 'PIB per capita',
    value: 'R$ 53,8 mil',
    delta: 'Referência anual nacional',
    source: 'IBGE · Contas Nacionais',
    sourceUrl: 'https://www.ibge.gov.br/indicadores',
    date: 'Ref. demonstrativa',
    impact: 'Termômetro de poder de compra médio.',
    plainExplanation: 'Renda econômica gerada por habitante no país; ajuda a balizar posicionamento de preço.',
    businessEffect: 'Mantém espaço para produtos de ticket médio R$ 236–R$ 389 com apelo de qualidade durável.',
    practicalTip: 'Destaque durabilidade e caimento do tecido nas descrições de produto para justificar o preço.',
  },
  {
    code: 'ICMS',
    label: 'ICMS Estadual (SC)',
    value: '17%',
    delta: 'Alíquota modal interna vigente',
    source: 'SEFAZ-SC',
    sourceUrl: 'https://www.sef.sc.gov.br',
    date: 'Ref. demonstrativa',
    impact: 'Peso tributário direto nas vendas dentro de SC e atenção ao IBS/CBS.',
    plainExplanation: 'Imposto estadual incidente sobre circulação de mercadorias na loja física e envios locais.',
    businessEffect: 'Incide sobre o preço bruto de venda e compõe o cálculo de margem real no Simulador.',
    practicalTip: 'Acompanhe a transição IBS/CBS com seu contador antes de revisar tabelas interestaduais (D-09).',
  },
];

export const ATLANTICA_MACRO_SERIES = {
  labels: ['jun', 'jul', 'ago', 'set', 'out', 'nov'],
  series: [
    { name: 'IPCA geral (%)', color: '#20C5D5', values: [4.2, 4.3, 4.4, 4.5, 4.5, 4.6] },
    { name: 'Vestuário (%)', color: '#F2B84B', values: [4.9, 5.1, 5.3, 5.5, 5.6, 5.8] },
  ],
};

export const ATLANTICA_SELIC_SERIES = {
  labels: ['jun', 'jul', 'ago', 'set', 'out', 'nov'],
  series: [{ name: 'Selic (% a.a.)', color: '#F2B84B', values: [13.25, 13.25, 13.5, 13.5, 13.75, 13.75] }],
};

export const ATLANTICA_CAMBIO_SERIES = {
  labels: ['jun', 'jul', 'ago', 'set', 'out', 'nov'],
  series: [{ name: 'Dólar PTAX (R$)', color: '#20B981', values: [5.14, 5.19, 5.24, 5.27, 5.35, 5.42] }],
};

export const ATLANTICA_CHANNEL_SERIES = {
  labels: ['sem 41', 'sem 42', 'sem 43', 'sem 44', 'sem 45', 'sem 46'],
  series: [
    { name: 'Lojas físicas (R$ mil)', color: '#20C5D5', values: [215, 222, 218, 226, 224, 232] },
    { name: 'E-commerce (R$ mil)', color: '#F2B84B', values: [72, 76, 79, 81, 83, 86] },
  ],
};

export const ATLANTICA_MARGIN_NPS_SERIES = {
  labels: ['jun', 'jul', 'ago', 'set', 'out', 'nov'],
  series: [
    { name: 'Margem bruta (%)', color: '#20C5D5', values: [54.2, 53.8, 53.1, 52.9, 52.4, 52.0] },
    { name: 'NPS (pts)', color: '#F2B84B', values: [46, 45, 44, 43, 42, 41] },
  ],
};

export const ATLANTICA_COMPETITORS = [
  {
    name: 'Brisa Concept',
    segment: 'E-commerce regional, foco 25–40 anos',
    locationDistance: 'Florianópolis/SC · Operação E-commerce Sul',
    priceVsUs: 'Similar',
    channels: 'Site · Instagram',
    lastMovement: 'Frete grátis acima de R$ 199 (S-01)',
    threatLevel: 'Impacto alto',
    threatTone: 'red' as const,
    positioning: 'Digital-first competitivo',
    priceRange: 'R$ 180 — R$ 520',
    shipping: 'Frete grátis acima de R$ 199',
    delivery: '2 a 4 dias úteis (Sul/Sudeste)',
    rating: '4,7 / 5 (Google & Marketplaces)',
    positivesNote: 'Entrega ágil no Sul e política agressiva de frete grátis.',
    complaints: 'Grade de numeração limitada no PP/GG',
    productsPromotions: 'Vestidos casuais e conjuntos entre R$ 180 e R$ 520; frete grátis divulgado acima de R$ 199.',
    differentials: 'Checkout rápido no Instagram e baixa barreira de frete.',
    threatsOpportunities: 'Ameaça direta à conversão online; oportunidade no atendimento de tamanhos PP/GG.',
    consultedAt: '11/11/2026',
    sourceUrl: 'https://www.google.com/maps/search/Brisa+Concept+Florianopolis',
  },
  {
    name: 'Vitrine Sul',
    segment: 'Rede com 6 lojas no estado',
    locationDistance: 'Shopping Beira-Mar, Florianópolis/SC (~1,2 km da Matriz)',
    priceVsUs: 'Abaixo',
    channels: 'Lojas · Site',
    lastMovement: 'Nova loja no Shopping Beira-Mar (S-04)',
    threatLevel: 'Impacto médio',
    threatTone: 'amber' as const,
    positioning: 'Varejo presencial regional',
    priceRange: 'R$ 150 — R$ 450',
    shipping: 'Retirada em loja grátis',
    delivery: '3 a 5 dias úteis',
    rating: '4,4 / 5',
    positivesNote: 'Capilaridade em shoppings e retirada presencial sem custo.',
    complaints: 'Demora no atendimento em horários de pico',
    productsPromotions: 'Moda feminina comercial de R$ 150 a R$ 450; retirada grátis em loja.',
    differentials: 'Alto fluxo de shopping e preço médio inferior.',
    threatsOpportunities: 'Risco de desvio de fluxo na inauguração (28/11); oportunidade em atendimento consultivo.',
    consultedAt: '10/11/2026',
    sourceUrl: 'https://www.google.com/maps/search/Shopping+Beira-Mar+Florianopolis',
  },
  {
    name: 'Maré Boutique',
    segment: 'Loja premium de bairro',
    locationDistance: 'Jurerê / Centro, Florianópolis/SC (~4,5 km)',
    priceVsUs: 'Acima',
    channels: 'Loja · WhatsApp',
    lastMovement: 'Linha de peças recicladas (S-10)',
    threatLevel: 'Impacto baixo',
    threatTone: 'green' as const,
    positioning: 'Artesanal sustentável',
    priceRange: 'R$ 340 — R$ 710',
    shipping: 'Frete fixo R$ 24,90',
    delivery: '4 a 7 dias úteis',
    rating: '4,6 / 5',
    positivesNote: 'Curadoria autoral e apelo sustentável com tecidos reciclados.',
    complaints: 'Prazo de estorno em devoluções',
    productsPromotions: 'Peças autorais de R$ 340 a R$ 710; sem promoções públicas recorrentes.',
    differentials: 'Narrativa ESG forte e atendimento personalizado via WhatsApp.',
    threatsOpportunities: 'Pressão baixa por preço acima; oportunidade de lançar cápsula sustentável equivalente.',
    consultedAt: '09/11/2026',
    sourceUrl: 'https://www.google.com/maps/search/Boutique+Centro+Florianopolis',
  },
  {
    name: 'ModaJá',
    segment: 'Marketplace nacional',
    locationDistance: 'Operação Nacional · Entrega 24h Grande Florianópolis',
    priceVsUs: 'Abaixo',
    channels: 'App · Site',
    lastMovement: 'Entrega em 24h na capital',
    threatLevel: 'Impacto médio',
    threatTone: 'amber' as const,
    positioning: 'Escala promocional',
    priceRange: 'R$ 110 — R$ 360',
    shipping: 'Frete expresso 24h',
    delivery: '1 a 3 dias úteis',
    rating: '4,1 / 5',
    positivesNote: 'Velocidade de entrega na capital e preços promocionais agressivos.',
    complaints: 'Divergência de tecido nas fotos',
    productsPromotions: 'Moda rápida de R$ 110 a R$ 360 com cupons sazonais no aplicativo.',
    differentials: 'Logística expressa em 24h.',
    threatsOpportunities: 'Ameaça em peças básicas; oportunidade ao destacar qualidade real e caimento (82% de aprovação).',
    consultedAt: '10/11/2026',
    sourceUrl: 'https://www.google.com/maps/search/Moda+Florianopolis',
  },
  {
    name: 'Costa Linho',
    segment: 'Marca especializada em linho',
    locationDistance: 'Lagoa da Conceição, Florianópolis/SC (~8,4 km)',
    priceVsUs: 'Acima',
    channels: 'Site · Pop-ups',
    lastMovement: 'Coleção de verão antecipada (S-02)',
    threatLevel: 'Impacto médio',
    threatTone: 'amber' as const,
    positioning: 'Nicho fibras naturais',
    priceRange: 'R$ 360 — R$ 780',
    shipping: 'Frete grátis acima de R$ 450',
    delivery: '3 a 6 dias úteis',
    rating: '4,8 / 5',
    positivesNote: 'Especialização reconhecida em fibras naturais e excelente acabamento.',
    complaints: 'Estoque reduzido em tamanhos maiores',
    productsPromotions: 'Coleção de linho verão de R$ 360 a R$ 780; frete grátis acima de R$ 450.',
    differentials: 'Lançamento antecipado de coleções de verão.',
    threatsOpportunities: 'Captura busca precoce de linho (+38%); oportunidade de entrar antes com preço mais competitivo.',
    consultedAt: '11/11/2026',
    sourceUrl: 'https://www.google.com/maps/search/Lagoa+da+Conceicao+Florianopolis',
  },
];

export const ATLANTICA_CONSUMER_VOICE = [
  { label: 'Qualidade do tecido', pct: 82, rightNote: '48 menções', tone: 'green' as const },
  { label: 'Atendimento na loja', pct: 74, rightNote: '35 menções', tone: 'green' as const },
  { label: 'Preço', pct: 58, rightNote: '38 menções', tone: 'amber' as const },
  { label: 'Prazo de troca', pct: 24, rightNote: '29 menções', tone: 'red' as const },
  { label: 'Entrega online', pct: 41, rightNote: '22 menções', tone: 'amber' as const },
];

export const ATLANTICA_SEARCH_TRENDS = [
  { label: 'Vestido de linho', delta: 38, negative: false },
  { label: 'Moda praia 2027', delta: 27, negative: false },
  { label: 'Consumo consciente', delta: 15, negative: false },
  { label: 'Preços sustentáveis', delta: 12, negative: false },
  { label: 'Jeans wide leg', delta: -12, negative: true },
];

export const ATLANTICA_CONSUMER_BARS = [
  { label: 'Caimento', value: 92, secondaryValue: 8 },
  { label: 'Tecido', value: 89, secondaryValue: 11 },
  { label: 'Atendimento', value: 86, secondaryValue: 14 },
  { label: 'Entrega', value: 78, secondaryValue: 22 },
  { label: 'Troca reversa', value: 64, secondaryValue: 36 },
];

export const ATLANTICA_EVIDENCE_CARDS = [
  {
    id: 'ev-1',
    module: 'Painel & Precificação',
    title: 'Sensibilidade da margem ao custo de antecipação (Selic)',
    externalFinding: 'Selic em 13,75% a.a. eleva CET de antecipação de parcelas acima de 6x.',
    internalDataUsed: '41% das vendas do e-commerce da Atlântica Moda são parceladas entre 6x e 10x.',
    source: 'Banco Central (COPOM) + Histórico de pedidos Atlântica Moda',
    date: 'Semana 46 · nov/2026',
    method: 'Cruzamento de taxa efetiva de antecipação × distribuição de parcelamento',
    scope: 'Vendas e-commerce e loja física',
    reliability: 'Alta (86/100)',
    limitations: 'Não contempla negociação individual futura com adquirente.',
    verificationNeeded: 'Confirmar taxa efetiva mensal na fatura da adquirente.',
    quality: 88,
  },
  {
    id: 'ev-2',
    module: 'Voz do Cliente & Logística',
    title: 'Correlação entre prazo de troca e abandono de recompra',
    externalFinding: 'Avaliações públicas apontam agilidade de troca como critério decisivo no vestuário online.',
    internalDataUsed: 'Clientes que passam por troca (média 9 dias) têm 50% menos recompra em 60 dias.',
    source: 'Google Reviews + DOC-03 Relatório Operacional Pós-Venda',
    date: 'Últimos 90 dias (Demonstração)',
    method: 'Agrupamento temático de avaliações + coorte de recompra',
    scope: 'Pedidos e-commerce entregues fora de SC',
    reliability: 'Alta (84/100)',
    limitations: 'Divergência entre p. 2 e p. 6 do DOC-03 ainda em verificação.',
    verificationNeeded: 'Auditar SLA da transportadora reversa nas regiões SP e RJ.',
    quality: 84,
  },
];

export const ATLANTICA_BRIEFING = {
  date: 'Resumo Executivo Semanal',
  priorities: [
    {
      title: 'Reduzir valor mínimo para frete grátis de R$ 349 para R$ 249 (D-01)',
      impact: 'Recuperar 4 p.p. na conversão online e conter avanço da Brisa Concept.',
      source: 'DOC-02 + Radar S-01 S-04 + Análise A-01',
    },
    {
      title: 'Antecipar coleção de linho e repor Blazer Linho Areia (D-02)',
      impact: '+R$ 42 mil na temporada e prevenção de ruptura em 2 SKUs curva A.',
      source: 'Radar S-02 S-07 + Análise A-02',
    },
    {
      title: 'Reduzir prazo médio de troca de 9 dias para 48h (D-04)',
      impact: 'Reduzir queda de 50% na recompra em clientes pós-troca.',
      source: 'DOC-03 + Google Reviews + Análise A-04',
    },
  ],
  alerts: [
    '2 SKUs de curva A (Blazer Linho Areia e Bolsa Tote) com estoque crítico (< 10 un.).',
    'Abandono de carrinho subiu de 68% para 74% no e-commerce.',
  ],
  opportunities: [
    'Buscas por "vestido de linho" subiram 38% na região Sul.',
    'Vendas pelo Instagram alcançam 18% do segmento (P-07/P-08 em andamento).',
  ],
  risks: [
    'Fornecedores anunciaram alta de 12% no algodão a partir de dezembro.',
    'Vitrine Sul inaugura loja no Shopping Beira-Mar a 1,2 km da matriz.',
  ],
};

export const ATLANTICA_STRATEGIC = {
  pestel: [
    { factor: 'Político / Tributário', summary: 'Transição IBS/CBS (S-14) e proposta de ICMS interestadual em pauta no CONFAZ (S-08).', impact: 'Alto' },
    { factor: 'Econômico', summary: 'Selic em 13,75% pressiona capital de giro; IPCA vestuário (+5,8%) acima do geral (+4,6%).', impact: 'Alto' },
    { factor: 'Social', summary: 'Buscas por vestido de linho (+38%) e consumo consciente em alta.', impact: 'Positivo' },
    { factor: 'Tecnológico', summary: 'Integração do catálogo ao Instagram (18% do segmento) e vendas via direct.', impact: 'Oportunidade' },
    { factor: 'Ecológico / ESG', summary: '3 de 5 concorrentes destacam tecidos reciclados e fibras naturais.', impact: 'Médio' },
    { factor: 'Legal / LGPD', summary: 'Projeto de lei sobre trocas online em tramitação (não gera obrigação vigente).', impact: 'Acompanhar' },
  ],
  porter: [
    { force: 'Rivalidade entre concorrentes', level: 'Alta', note: 'Brisa Concept com frete grátis R$ 199 e Vitrine Sul abrindo a 1,2 km.' },
    { force: 'Poder dos compradores', level: 'Alto', note: 'Sensibilidade a prazo de troca (9 dias) e frete online.' },
    { force: 'Poder dos fornecedores', level: 'Médio-Alto', note: 'Alta de 12% no algodão anunciada por 2 de 3 fornecedores.' },
    { force: 'Ameaça de novos entrantes', level: 'Média', note: 'Marketplaces nacionais com entrega em 24h.' },
    { force: 'Produtos substitutos', level: 'Média', note: 'Moda rápida promocional e brechós digitais.' },
  ],
  swot: {
    strengths: ['Qualidade do tecido bem avaliada (82%)', 'Atendimento na loja física (74%)', 'Base fiel em Florianópolis e e-commerce'],
    weaknesses: ['Prazo de troca de 9 dias', 'Frete grátis pouco competitivo (R$ 349)', 'Baixa integração nas redes sociais'],
    opportunities: ['Demanda crescente por linho (+38%)', 'Vendas via Instagram (18% do segmento)', 'Feira regional de moda praia em janeiro'],
    threats: ['Frete grátis da Brisa Concept (R$ 199)', 'Nova loja da Vitrine Sul no Shopping Beira-Mar', 'Alta de 12% no algodão e dólar em alta'],
  },
  tows: [
    { quadrant: 'FO (Forças + Oportunidades)', action: 'Usar curadoria de linho bem avaliada para capturar busca (+38%) e feira regional.' },
    { quadrant: 'FA (Forças + Ameaças)', action: 'Ativar atendimento consultivo e fidelidade na loja Centro contra estreia da Vitrine Sul.' },
    { quadrant: 'DO (Fraquezas + Oportunidades)', action: 'Integrar catálogo no Instagram e reduzir frete grátis para R$ 249.' },
    { quadrant: 'DA (Fraquezas + Ameaças)', action: 'Trocas na loja física em 48h e renegociação semestral de algodão.' },
  ],
};

export const ATLANTICA_NOTIFICATIONS = [
  { id: 'n1', category: 'Documentos', date: '11/11 09:12', text: 'Relatório de RH recebido e em processamento.', linkText: 'Abrir documento →', target: 'documentos' },
  { id: 'n2', category: 'Ambiente externo', date: '11/11 08:40', text: 'Nova informação oficial: dólar em alta encarece tecidos importados (S-13).', linkText: 'Ver no Radar →', target: 'radar' },
  { id: 'n3', category: 'Documentos', date: '10/11 17:05', text: 'Planejamento estratégico 2027 aguardando interpretação.', linkText: 'Abrir documento →', target: 'documentos' },
  { id: 'n4', category: 'Ambiente externo', date: '10/11 11:20', text: 'Concorrência: Brisa Concept lançou frete grátis acima de R$ 199 (S-01).', linkText: 'Ver no Radar →', target: 'radar' },
  { id: 'n5', category: 'Ambiente externo', date: '08/11 15:30', text: 'Proposta de ICMS enviada para verificação (S-08).', linkText: 'Ver verificação →', target: 'verificar' },
  { id: 'n6', category: 'Documentos', date: '06/11 10:02', text: 'Relatório operacional com inconsistências entre seções (DOC-03).', linkText: 'Abrir documento →', target: 'documentos' },
  { id: 'n7', category: 'Decisões', date: '05/11 16:48', text: 'Descoberta do relatório comercial gerou a decisão D-01.', linkText: 'Ver decisão →', target: 'decisoes' },
  { id: 'n8', category: 'Documentos', date: '04/11 14:15', text: 'Relatório de Marketing interpretado: 1 recomendação aguardando avaliação.', linkText: 'Abrir documento →', target: 'documentos' },
];

export const ATLANTICA_ASSISTANT_SUGGESTIONS = [
  'Interprete o último relatório de Marketing.',
  'Quais documentos apresentam problemas relevantes?',
  'Quais acontecimentos externos podem afetar minha empresa?',
  'Houve alterações tributárias relevantes?',
  'Quais recomendações estão aguardando aprovação?',
  'Existem relações entre os relatórios internos e os acontecimentos externos?',
  'Quais informações ainda precisam ser verificadas?',
];

export const ATLANTICA_AUDIT_LOG = [
  { date: 'Hoje, 09:42', user: 'camila@atlanticamoda.com.br', action: 'Atualizou preço de venda', target: 'Vestido Midi Linho Marinho' },
  { date: 'Ontem, 17:15', user: 'rafael@atlanticamoda.com.br', action: 'Registrou simulação Realista (90 dias)', target: 'Simulador de Cenários' },
  { date: '05/11, 16:48', user: 'marina@atlanticamoda.com.br', action: 'Aprovou decisão D-05 (Instagram)', target: 'Central de Decisões' },
];
