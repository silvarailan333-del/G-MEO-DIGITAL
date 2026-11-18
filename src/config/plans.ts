export type PlanCode = 'basico' | 'profissional' | 'empresarial';
export type BillingCycle = 'monthly' | 'annual';

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  tagline: string;
  recommended?: boolean;
  monthlyPrice: number;
  annualMonthlyEquivalent: number;
  trialDays: number;
  limits: {
    aiInteractionsPerMonth: number;
    competitorsMax: number;
    whatsappReviewsPerMonth: number;
    unitsIncluded: number;
    teamMembersMax: number;
  };
  includedModules: string[];
  features: string[];
}

export interface PlanAddOn {
  code: 'extra_competitor' | 'extra_unit' | 'whatsapp_pack';
  name: string;
  description: string;
  monthlyPrice: number;
  unitLabel: string;
}

export const PLANS_CONFIG: Record<PlanCode, PlanDefinition> = {
  basico: {
    code: 'basico',
    name: 'Básico',
    tagline: 'Para MEIs e pequenas lojas estruturando seu Gêmeo Digital.',
    monthlyPrice: 19.9,
    annualMonthlyEquivalent: 15.9,
    trialDays: 7,
    limits: {
      aiInteractionsPerMonth: 40,
      competitorsMax: 2,
      whatsappReviewsPerMonth: 50,
      unitsIncluded: 1,
      teamMembersMax: 2,
    },
    includedModules: [
      'painel',
      'resumo-do-dia',
      'produtos',
      'dados-empresa',
      'importacao',
      'indicadores',
      'swot',
      'configuracoes',
      'privacidade-lgpd',
    ],
    features: [
      '1 unidade cadastrada',
      'Até 2 concorrentes monitorados',
      '40 consultas/mês ao Assistente de IA',
      '50 envios de avaliação WhatsApp/mês',
      'Painel macroeconômico oficial (BCB/IBGE)',
      'Catálogo de produtos e importação CSV/Excel',
    ],
  },
  profissional: {
    code: 'profissional',
    name: 'Profissional',
    tagline: 'Para MEs e EPPs em expansão com inteligência competitiva completa.',
    recommended: true,
    monthlyPrice: 44.9,
    annualMonthlyEquivalent: 35.9,
    trialDays: 14,
    limits: {
      aiInteractionsPerMonth: 250,
      competitorsMax: 6,
      whatsappReviewsPerMonth: 300,
      unitsIncluded: 2,
      teamMembersMax: 6,
    },
    includedModules: [
      'painel',
      'resumo-do-dia',
      'radar',
      'tendencias',
      'concorrentes',
      'indicadores',
      'pestel',
      'porter',
      'swot',
      'tows',
      'decisoes',
      'planos-acao',
      'simulador',
      'consumidores',
      'voz-do-cliente',
      'produtos',
      'oportunidades',
      'dados-empresa',
      'integracoes',
      'importacao',
      'relatorios',
      'historico',
      'configuracoes',
      'privacidade-lgpd',
    ],
    features: [
      '2 unidades incluídas',
      'Até 6 concorrentes monitorados',
      '250 consultas/mês ao Assistente de IA',
      '300 avaliações WhatsApp/mês + Interpretação IA',
      'Todos os frameworks: PESTEL, Porter, SWOT e TOWS',
      'Simulador de cenários (30, 90 e 180 dias) + Exportação PDF/Excel',
    ],
  },
  empresarial: {
    code: 'empresarial',
    name: 'Empresarial',
    tagline: 'Para operações multiunidade com governança, equipe e alto volume.',
    monthlyPrice: 89.9,
    annualMonthlyEquivalent: 71.9,
    trialDays: 14,
    limits: {
      aiInteractionsPerMonth: 1200,
      competitorsMax: 20,
      whatsappReviewsPerMonth: 1500,
      unitsIncluded: 5,
      teamMembersMax: 25,
    },
    includedModules: [
      'painel',
      'resumo-do-dia',
      'radar',
      'tendencias',
      'concorrentes',
      'indicadores',
      'pestel',
      'porter',
      'swot',
      'tows',
      'decisoes',
      'planos-acao',
      'simulador',
      'consumidores',
      'voz-do-cliente',
      'produtos',
      'oportunidades',
      'dados-empresa',
      'integracoes',
      'importacao',
      'relatorios',
      'historico',
      'configuracoes',
      'privacidade-lgpd',
    ],
    features: [
      '5 unidades incluídas',
      'Até 20 concorrentes monitorados',
      '1.200 consultas/mês ao Assistente de IA',
      '1.500 avaliações WhatsApp/mês',
      'Até 25 membros com controle de acesso por papel (RBAC)',
      'Trilha completa de auditoria, LGPD avançado e relatórios executivos',
    ],
  },
};

export const PLAN_ADDONS: PlanAddOn[] = [
  {
    code: 'extra_competitor',
    name: 'Concorrente extra',
    description: 'Adiciona +1 concorrente monitorado acima do limite do plano.',
    monthlyPrice: 9.9,
    unitLabel: 'por concorrente/mês',
  },
  {
    code: 'extra_unit',
    name: 'Unidade extra',
    description: 'Adiciona +1 loja, filial ou centro de distribuição.',
    monthlyPrice: 29.9,
    unitLabel: 'por unidade/mês',
  },
  {
    code: 'whatsapp_pack',
    name: 'Pacote adicional WhatsApp',
    description: 'Adiciona +250 questionários de avaliação via WhatsApp Business.',
    monthlyPrice: 19.9,
    unitLabel: 'por pacote/mês',
  },
];

export const ANNUAL_DISCOUNT_LABEL = 'Economia de 20% no plano anual';
export const PAYMENT_NOTICE_DEMO =
  'Contratação demonstrativa — nenhum pagamento real ou cobrança automática é processada nesta etapa sem gateway oficial configurado.';

export function calculateSubscriptionMonthlyTotal(params: {
  planCode: PlanCode;
  billingCycle: BillingCycle;
  extraCompetitors: number;
  extraUnits: number;
  extraWhatsappPacks: number;
}): number {
  const plan = PLANS_CONFIG[params.planCode];
  const base =
    params.billingCycle === 'annual' ? plan.annualMonthlyEquivalent : plan.monthlyPrice;
  const extras =
    params.extraCompetitors * 9.9 +
    params.extraUnits * 29.9 +
    params.extraWhatsappPacks * 19.9;
  return Number((base + extras).toFixed(2));
}
