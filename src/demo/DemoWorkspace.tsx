import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  Info,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  Menu,
  MessageSquare,
  Package,
  Radar,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  ATLANTICA_ANALYSES,
  ATLANTICA_ASSISTANT_SUGGESTIONS,
  ATLANTICA_AUDIT_LOG,
  ATLANTICA_BRAND,
  ATLANTICA_BRIEFING,
  ATLANTICA_CAMBIO_SERIES,
  ATLANTICA_CHANNEL_SERIES,
  ATLANTICA_COMPETITORS,
  ATLANTICA_CONSUMER_VOICE,
  ATLANTICA_EVIDENCE_CARDS,
  ATLANTICA_EXTENDED_KPIS,
  ATLANTICA_INITIAL_ACTIONS,
  ATLANTICA_INITIAL_DECISIONS,
  ATLANTICA_INITIAL_DOCUMENTS,
  ATLANTICA_MACRO,
  ATLANTICA_MACRO_SERIES,
  ATLANTICA_MARGIN_NPS_SERIES,
  ATLANTICA_NOTIFICATIONS,
  ATLANTICA_PRODUCTS,
  ATLANTICA_SEARCH_TRENDS,
  ATLANTICA_SELIC_SERIES,
  ATLANTICA_SIGNALS,
  ATLANTICA_STRATEGIC,
  type DemoActionItem,
  type DemoDecision,
  type DemoDocument,
  type DemoProduct,
} from './atlanticaData';
import {
  ANNUAL_DISCOUNT_LABEL,
  PAYMENT_NOTICE_DEMO,
  PLAN_ADDONS,
  PLANS_CONFIG,
  type PlanCode,
} from '../config/plans';
import {
  AppShell,
  KpiStatCard,
  PageHeader,
  SignalCard,
  StatusBadge,
  TraceabilityBar,
  type NavGroup,
  type TraceStep,
} from '../components/ui/TwinUI';
import { HorizontalProgressList, TrendLineChart } from '../components/Charts';
import { SimpleBarChart } from '../components/SimpleBarChart';
import {
  downloadCatalogTemplateExcel,
  downloadSalesUnitsTemplateExcel,
  exportExecutiveReportExcel,
  exportExecutiveReportPDF,
  type ExecutiveReportPayload,
} from '../components/ReportExporter';
import {
  parseCatalogSpreadsheet,
  parseSalesUnitsSpreadsheet,
  type ParsedCatalogItem,
  type ParsedSalesItem,
} from '../lib/productImportParser';

type DemoSection =
  | 'painel'
  | 'documentos'
  | 'dados-empresa'
  | 'produtos'
  | 'consumidores'
  | 'radar'
  | 'macro'
  | 'verificar'
  | 'concorrentes'
  | 'analises'
  | 'decisoes'
  | 'planos-acao'
  | 'oportunidades'
  | 'simulador'
  | 'assistente'
  | 'relatorios'
  | 'indicadores'
  | 'historico'
  | 'plano'
  | 'configuracoes'
  | 'login'
  | 'cadastro';

// Map legacy demo URLs to unified section IDs
function normalizeDemoSection(raw?: string): DemoSection {
  if (!raw || raw === 'painel' || raw === 'resumo-do-dia') return 'painel';
  if (raw === 'importacao') return 'documentos';
  if (raw === 'integracoes') return 'dados-empresa';
  if (raw === 'monitoramento' || raw === 'tendencias') return 'radar';
  if (raw === 'indicadores-macro' || raw === 'ambiente') return 'macro';
  if (raw === 'pestel' || raw === 'porter' || raw === 'swot' || raw === 'tows') return 'analises';
  if (raw === 'voz-do-cliente') return 'consumidores';
  if (raw === 'empresa' || raw === 'equipe' || raw === 'privacidade-lgpd') return 'configuracoes';
  return raw as DemoSection;
}

export const DemoWorkspace: React.FC<{ initialSection?: string }> = ({
  initialSection,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const derivedSection = useMemo<DemoSection>(() => {
    if (initialSection) return normalizeDemoSection(initialSection);
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'painel') return 'painel';
    return normalizeDemoSection(parts[1]);
  }, [initialSection, location.pathname]);

  const [section, setSection] = useState<DemoSection>(derivedSection);
  useEffect(() => {
    setSection(derivedSection);
  }, [derivedSection]);
  const [selectedProduct, setSelectedProduct] = useState<DemoProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Session-only interactive states (never persisted to Beta DB)
  const [demoProducts, setDemoProducts] = useState<DemoProduct[]>(ATLANTICA_PRODUCTS);
  const [demoCatalogLoading, setDemoCatalogLoading] = useState(false);
  const [demoCatalogPreview, setDemoCatalogPreview] = useState<{
    fileName: string;
    note: string;
    items: ParsedCatalogItem[];
  } | null>(null);
  const [demoSalesLoading, setDemoSalesLoading] = useState(false);
  const [demoSalesStrategy, setDemoSalesStrategy] = useState<'replace' | 'add'>('replace');
  const [demoSalesPreview, setDemoSalesPreview] = useState<{
    fileName: string;
    note: string;
    items: ParsedSalesItem[];
  } | null>(null);
  const [demoProductNotice, setDemoProductNotice] = useState<string>('');
  const [decisions, setDecisions] = useState<DemoDecision[]>(ATLANTICA_INITIAL_DECISIONS);
  const [actions, setActions] = useState<DemoActionItem[]>(ATLANTICA_INITIAL_ACTIONS);
  const [documents, setDocuments] = useState<DemoDocument[]>(ATLANTICA_INITIAL_DOCUMENTS);
  const [verifiedSignals, setVerifiedSignals] = useState<Record<string, 'confirmed' | 'discarded'>>({});
  const [sessionLogs, setSessionLogs] = useState<Array<{ time: string; text: string }>>([]);

  // Filters
  const [radarTypeFilter, setRadarTypeFilter] = useState<string>('Todos');
  const [radarCatFilter, setRadarCatFilter] = useState<string>('Todas');
  const [decisionFilter, setDecisionFilter] = useState<'pendente' | 'aprovada' | 'adiada' | 'descartada' | 'todas'>('pendente');
  const [planFilter, setPlanFilter] = useState<'todos' | 'a_fazer' | 'em_andamento' | 'concluida' | 'aguardando_decisao'>('todos');
  const [showPlanReview, setShowPlanReview] = useState(false);
  const [showMacroTranslator, setShowMacroTranslator] = useState(true);
  const [docFilter, setDocFilter] = useState<string>('Todos');
  const [notifFilter, setNotifFilter] = useState<string>('Todas');
  const [analysisFrameworkTab, setAnalysisFrameworkTab] = useState<'swot' | 'pestel' | 'porter' | 'tows' | 'evidencias'>('swot');

  // Document preview modal & upload form
  const [openDoc, setOpenDoc] = useState<DemoDocument | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [newDocDept, setNewDocDept] = useState('Marketing');
  const [newDocCat, setNewDocCat] = useState('Relatório de marketing');
  const [newDocPeriod, setNewDocPeriod] = useState('');
  const [newDocNotes, setNewDocNotes] = useState('');

  // Simulator interactive state (lay-accessible + macro, operational & 4-scenario comparison)
  const [simScenario, setSimScenario] = useState<'pessimista' | 'realista' | 'otimista'>('realista');
  const [simHorizon, setSimHorizon] = useState<30 | 90 | 180>(90);
  const [simInflacao, setSimInflacao] = useState(4.6);
  const [simSelic, setSimSelic] = useState(13.75);
  const [simCambio, setSimCambio] = useState(5.42);
  const [simIcms, setSimIcms] = useState(17);
  const [simCrescimento, setSimCrescimento] = useState(8);
  const [simProductionDelta, setSimProductionDelta] = useState(12);
  const [simMarginalCost, setSimMarginalCost] = useState(145);
  const [simMarginalUnits, setSimMarginalUnits] = useState(120);
  const [simTargetProfit, setSimTargetProfit] = useState(250000);
  const [simProducedUnits, setSimProducedUnits] = useState(620);
  const [simDemandUnits, setSimDemandUnits] = useState(650);
  const [simUnitPrice, setSimUnitPrice] = useState(236);
  const [simFixedCosts, setSimFixedCosts] = useState(48000);
  const [simVariableCost, setSimVariableCost] = useState(113);
  const [simExtraEmployees, setSimExtraEmployees] = useState(0);
  const [simEmployeeCost, setSimEmployeeCost] = useState(2900);

  // Plans checkout multi-step demo state (PDF 2 pages 17-20)
  const [planStep, setPlanStep] = useState<'planos' | 'resumo' | 'dados' | 'confirmacao'>('planos');
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>('profissional');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // AI Assistant state (both full-page & discrete quick drawer)
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; source?: string }>>([]);

  const logSession = (text: string) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setSessionLogs((prev) => [{ time, text }, ...prev]);
  };

  const goToSection = (next: DemoSection) => {
    setSection(next);
    setSelectedProduct(null);
    if (next === 'plano') setPlanStep('planos');
    navigate(next === 'painel' ? '/painel' : `/demo/${next}`);
  };

  const mapTraceSteps = (steps: Array<{ label: string; code: string; target?: string }>): TraceStep[] =>
    steps.map((s) => ({
      label: s.label,
      code: s.code,
      onClick: s.target ? () => goToSection(normalizeDemoSection(s.target)) : undefined,
    }));

  const demoSalesStats = useMemo(() => {
    const ranked = [...demoProducts].sort((a, b) => {
      const diff = (b.sales30d || 0) - (a.sales30d || 0);
      if (diff !== 0) return diff;
      return (b.sales30d || 0) * b.price - (a.sales30d || 0) * a.price;
    });
    const totalSoldUnits = ranked.reduce((acc, p) => acc + (p.sales30d || 0), 0);
    const totalEstimatedRevenue = ranked.reduce((acc, p) => acc + (p.sales30d || 0) * p.price, 0);
    const topProduct = ranked.find((p) => (p.sales30d || 0) > 0) || null;
    const criticalTopSellers = ranked.filter(
      (p) => (p.sales30d || 0) > 0 && p.stock <= Math.max(11, Math.round((p.sales30d || 0) * 0.18))
    );
    const chartData = ranked.slice(0, 8).map((p) => ({
      label: p.name.length > 16 ? `${p.name.slice(0, 14)}…` : p.name,
      value: p.sales30d || 0,
      secondaryValue: p.stock,
      hint: `${p.name} — Vendidas: ${p.sales30d || 0} un. | Estoque atual: ${p.stock} un.`,
    }));
    return {
      ranked,
      totalSoldUnits,
      totalEstimatedRevenue,
      topProduct,
      criticalTopSellersCount: criticalTopSellers.length,
      chartData,
    };
  }, [demoProducts]);

  const handleDemoProductFileUpload = async (
    mode: 'catalog' | 'sales',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const setLoading = mode === 'catalog' ? setDemoCatalogLoading : setDemoSalesLoading;
    setLoading(true);
    setDemoProductNotice('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isSpreadsheet = ['xlsx', 'xls', 'csv'].includes(ext);

      if (isSpreadsheet) {
        const buffer = await file.arrayBuffer();
        if (mode === 'catalog') {
          const parsed = parseCatalogSpreadsheet(buffer);
          if (parsed.items.length > 0) {
            setDemoCatalogPreview({
              fileName: file.name,
              note: `${parsed.items.length} produto(s) identificado(s) na planilha. Confirme para aplicar na sessão demonstrativa.`,
              items: parsed.items,
            });
            return;
          }
          const resp = await fetch('/api/public/demo/products/extract-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'catalog',
              fileName: file.name,
              mimeType: 'text/csv',
              textContent: parsed.csvPreview,
            }),
          });
          const extracted = (await resp.json()) as { note?: string; items?: ParsedCatalogItem[]; error?: string };
          if (!resp.ok || !extracted.items?.length) {
            setDemoProductNotice(extracted.error || 'Nenhum produto identificado nesta planilha.');
            return;
          }
          setDemoCatalogPreview({
            fileName: file.name,
            note: extracted.note || `${extracted.items.length} produto(s) extraído(s).`,
            items: extracted.items,
          });
        } else {
          const parsed = parseSalesUnitsSpreadsheet(buffer);
          if (parsed.items.length > 0) {
            setDemoSalesPreview({
              fileName: file.name,
              note: `${parsed.items.length} item(ns) com unidades vendidas identificado(s). Confirme para atualizar o ranking.`,
              items: parsed.items,
            });
            return;
          }
          const resp = await fetch('/api/public/demo/products/extract-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'sales',
              fileName: file.name,
              mimeType: 'text/csv',
              textContent: parsed.csvPreview,
            }),
          });
          const extracted = (await resp.json()) as { note?: string; items?: ParsedSalesItem[]; error?: string };
          if (!resp.ok || !extracted.items?.length) {
            setDemoProductNotice(extracted.error || 'Nenhuma unidade vendida identificada nesta planilha.');
            return;
          }
          setDemoSalesPreview({
            fileName: file.name,
            note: extracted.note || `${extracted.items.length} item(ns) extraído(s).`,
            items: extracted.items,
          });
        }
      } else {
        const isText = file.type.startsWith('text/') || ['txt', 'md'].includes(ext);
        const base64Data = !isText
          ? await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
              reader.readAsDataURL(file);
            })
          : undefined;
        const textContent = isText ? await file.text() : undefined;

        const resp = await fetch('/api/public/demo/products/extract-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            fileName: file.name,
            mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
            base64Data,
            textContent,
          }),
        });

        if (mode === 'catalog') {
          const extracted = (await resp.json()) as { note?: string; items?: ParsedCatalogItem[]; error?: string };
          if (!resp.ok || !extracted.items?.length) {
            setDemoProductNotice(extracted.error || 'Não foi possível extrair produtos deste PDF.');
            return;
          }
          setDemoCatalogPreview({
            fileName: file.name,
            note: extracted.note || `${extracted.items.length} produto(s) extraído(s) do PDF.`,
            items: extracted.items,
          });
        } else {
          const extracted = (await resp.json()) as { note?: string; items?: ParsedSalesItem[]; error?: string };
          if (!resp.ok || !extracted.items?.length) {
            setDemoProductNotice(extracted.error || 'Não foi possível extrair unidades vendidas deste PDF.');
            return;
          }
          setDemoSalesPreview({
            fileName: file.name,
            note: extracted.note || `${extracted.items.length} item(ns) extraído(s) do PDF.`,
            items: extracted.items,
          });
        }
      }
    } catch (err) {
      setDemoProductNotice(err instanceof Error ? err.message : 'Erro ao processar arquivo.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDemoProductImport = (mode: 'catalog' | 'sales') => {
    const norm = (v?: string) =>
      String(v || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (mode === 'catalog' && demoCatalogPreview) {
      let created = 0;
      let updated = 0;
      setDemoProducts((prev) => {
        const next = [...prev];
        for (const item of demoCatalogPreview.items) {
          const cleanSku = String(item.sku || '').trim();
          const cleanName = String(item.name || '').trim() || cleanSku;
          if (!cleanName) continue;
          const idx = next.findIndex(
            (p) =>
              (cleanSku && norm(p.sku) === norm(cleanSku)) ||
              norm(p.name) === norm(cleanName)
          );
          if (idx >= 0) {
            const cur = next[idx];
            const price = item.priceReais > 0 ? item.priceReais : cur.price;
            const cost = item.costReais > 0 ? item.costReais : cur.cost;
            const stock = item.stockQty ?? cur.stock;
            const marginPct = price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : cur.marginPct;
            next[idx] = {
              ...cur,
              name: cleanName || cur.name,
              sku: cleanSku || cur.sku,
              category: item.categoryName || cur.category,
              price,
              cost,
              stock,
              marginPct,
              status: stock < 12 ? 'Estoque crítico' : 'Ativo',
            };
            updated += 1;
          } else {
            const price = Math.max(0, item.priceReais || 0);
            const cost = Math.max(0, item.costReais || 0);
            const marginPct = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : 50;
            const stock = Math.max(0, item.stockQty || 0);
            next.push({
              id: `demo-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              sku: cleanSku || `IMP-${next.length + 1}`,
              name: cleanName,
              category: item.categoryName || 'Importados',
              price,
              cost,
              stock,
              status: stock < 12 ? 'Estoque crítico' : 'Ativo',
              marginPct,
              sales30d: 0,
              trend: 'Recém-importado nesta sessão',
              imageUrl: '/src/assets/images/atlantica_vestido_linho_1794938600696.jpg',
              description: `Produto importado do arquivo ${demoCatalogPreview.fileName} na sessão demonstrativa.`,
            });
            created += 1;
          }
        }
        return next;
      });
      const msg = `Catálogo atualizado na sessão: ${created} novo(s), ${updated} atualizado(s).`;
      setDemoProductNotice(msg);
      logSession(msg);
      setDemoCatalogPreview(null);
    } else if (mode === 'sales' && demoSalesPreview) {
      let created = 0;
      let updated = 0;
      setDemoProducts((prev) => {
        const next = [...prev];
        for (const item of demoSalesPreview.items) {
          const cleanSku = String(item.sku || '').trim();
          const cleanName = String(item.name || '').trim() || cleanSku;
          if (!cleanName && !cleanSku) continue;
          const units = Math.max(0, Math.round(Number(item.soldUnits || 0)));
          const idx = next.findIndex(
            (p) =>
              (cleanSku && norm(p.sku) === norm(cleanSku)) ||
              norm(p.name) === norm(cleanName)
          );
          if (idx >= 0) {
            const cur = next[idx];
            const nextSales = demoSalesStrategy === 'add' ? cur.sales30d + units : units;
            next[idx] = {
              ...cur,
              sales30d: nextSales,
              price: cur.price === 0 && item.priceReais > 0 ? item.priceReais : cur.price,
            };
            updated += 1;
          } else {
            next.push({
              id: `demo-sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              sku: cleanSku || `VND-${next.length + 1}`,
              name: cleanName,
              category: 'Importados',
              price: Math.max(0, item.priceReais || 0),
              cost: 0,
              stock: 0,
              status: 'Estoque crítico',
              marginPct: 50,
              sales30d: units,
              trend: 'Importado via planilha de vendas',
              imageUrl: '/src/assets/images/atlantica_camisa_resort_1794938600921.jpg',
              description: `Vendas importadas do arquivo ${demoSalesPreview.fileName} na sessão demonstrativa.`,
            });
            created += 1;
          }
        }
        return next;
      });
      const msg = `Ranking atualizado na sessão: ${updated} produto(s) atualizado(s), ${created} adicionado(s).`;
      setDemoProductNotice(msg);
      logSession(msg);
      setDemoSalesPreview(null);
    }
  };

  const pendingDecisionsCount = decisions.filter((d) => d.status === 'pendente').length;
  const verificationQueue = ATLANTICA_SIGNALS.filter(
    (s) => s.needsVerification && !verifiedSignals[s.code]
  );
  const docsNeedingReviewCount = documents.filter(
    (d) =>
      d.status === 'Aguardando interpretação' ||
      d.status === 'Com inconsistências' ||
      d.status === 'Em processamento'
  ).length;
  const interpretedDocsCount = documents.filter((d) => d.status === 'Interpretado').length;

  const navGroups: NavGroup[] = [
    {
      title: 'VISÃO GERAL',
      items: [{ id: 'painel', label: 'Visão geral', icon: LayoutDashboard }],
    },
    {
      title: 'INTELIGÊNCIA INTERNA',
      items: [
        { id: 'documentos', label: 'Documentos e relatórios', icon: FileText, badgeCount: docsNeedingReviewCount },
        { id: 'dados-empresa', label: 'Dados da empresa', icon: Database },
        { id: 'produtos', label: 'Produtos e estoque', icon: Package },
        { id: 'consumidores', label: 'Consumidores', icon: Users },
      ],
    },
    {
      title: 'INTELIGÊNCIA EXTERNA',
      items: [
        { id: 'radar', label: 'Radar de mercado', icon: Radar },
        { id: 'macro', label: 'Ambiente macroeconômico', icon: Globe },
        { id: 'verificar', label: 'Informações a verificar', icon: Search, badgeCount: verificationQueue.length },
        { id: 'concorrentes', label: 'Concorrentes', icon: Target },
      ],
    },
    {
      title: 'ESTRATÉGIA E DECISÃO',
      items: [
        { id: 'analises', label: 'Análises estratégicas', icon: BarChart3 },
        { id: 'decisoes', label: 'Central de decisões', icon: CheckCircle2, badgeCount: pendingDecisionsCount },
        { id: 'planos-acao', label: 'Planos de ação', icon: Briefcase },
        { id: 'oportunidades', label: 'Oportunidades', icon: Lightbulb },
        { id: 'simulador', label: 'Simulador de cenários', icon: Sliders },
        { id: 'assistente', label: 'Assistente de inteligência', icon: Bot },
      ],
    },
    {
      title: 'DESEMPENHO',
      items: [
        { id: 'relatorios', label: 'Relatórios', icon: FileSpreadsheet },
        { id: 'indicadores', label: 'Indicadores', icon: Activity },
      ],
    },
    {
      title: 'CONTA',
      items: [
        { id: 'historico', label: 'Histórico e notificações', icon: Bell },
        { id: 'plano', label: 'Minha assinatura', icon: CreditCard },
        { id: 'configuracoes', label: 'Empresa e LGPD', icon: Settings },
      ],
    },
  ];

  const handleDecisionAction = (code: string, nextStatus: 'aprovada' | 'adiada' | 'descartada') => {
    setDecisions((prev) =>
      prev.map((d) => (d.code === code ? { ...d, status: nextStatus } : d))
    );
    const dec = decisions.find((d) => d.code === code);
    if (nextStatus === 'aprovada' && dec) {
      logSession(`Decisão ${code} aprovada nesta sessão: "${dec.title}".`);
      if (!actions.some((a) => a.decisionCode === code)) {
        setActions((prev) => [
          {
            code: `P-${10 + prev.length}`,
            decisionCode: code,
            decisionTitle: dec.title,
            title: dec.suggestedAction,
            owner: 'Equipe Atlântica Moda',
            due: dec.due,
            priority: dec.priority === 'Prioridade alta' ? 'Alta' : 'Média',
            resources: 'Equipe operacional e orçamento vigente da Atlântica Moda',
            kpi: dec.kpisToTrack,
            completionPct: 0,
            status: 'a_fazer',
            trace: dec.trace,
          },
          ...prev,
        ]);
      }
    } else if (dec) {
      logSession(
        `Decisão ${code} ${nextStatus === 'adiada' ? 'adiada' : 'descartada'} nesta sessão: "${dec.title}".`
      );
    }
  };

  const handleVerifySignal = (code: string, outcome: 'confirmed' | 'discarded') => {
    setVerifiedSignals((prev) => ({ ...prev, [code]: outcome }));
    logSession(
      `Informação ${code} marcada como ${outcome === 'confirmed' ? 'Confirmada' : 'Descartada'} nesta sessão.`
    );
  };

  const handleUploadDemoDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    const newId = `DOC-0${documents.length + 1}`;
    const doc: DemoDocument = {
      id: newId,
      format: 'PDF',
      status: 'Em processamento',
      title: newDocName.trim(),
      meta: `${newDocDept} · Sessão Demo · Enviado hoje · Período ${newDocPeriod || 'atual'}`,
      summary: newDocNotes || `Documento ${newDocCat} enviado nesta sessão demonstrativa (apenas navegador).`,
    };
    setDocuments((prev) => [doc, ...prev]);
    logSession(`Documento ${newId} ("${doc.title}") adicionado nesta sessão.`);
    setNewDocName('');
    setNewDocPeriod('');
    setNewDocNotes('');
  };

  const askDemoAssistant = (questionText: string) => {
    const q = questionText.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    let answer =
      'Na Atlântica Moda (dados demonstrativos), as principais prioridades conectadas são: reduzir o frete grátis para R$ 249 (D-01, baseado em S-01 + DOC-02), antecipar a coleção de linho (D-02, baseado em S-02 + S-06) e reduzir trocas para 48h (D-04, baseado em DOC-03).';
    let source = 'DOC-02 · S-01 · S-02 · DOC-03';

    if (lower.includes('marketing')) {
      answer =
        'O Relatório mensal de Marketing — outubro (DOC-05) aponta redução de alcance pago e forte crescimento de engajamento orgânico no Instagram (F-02). Cruzado ao sinal S-05 (18% das vendas do setor via Instagram), gerou a decisão aprovada D-05 e as ações P-07, P-08 e P-09.';
      source = 'DOC-05 · Radar S-05 · Decisão D-05';
    } else if (lower.includes('problema') || lower.includes('inconsist')) {
      answer =
        'O documento DOC-03 ("Relatório operacional — pós-venda") está marcado com inconsistências entre a página 2 (meta 3 dias) e a página 6 (prazo médio de troca de 9 dias), exigindo validação antes de fechar o plano logístico D-04.';
      source = 'DOC-03 · Decisão D-04';
    } else if (lower.includes('tribut') || lower.includes('icms') || lower.includes('ibs')) {
      answer =
        'Existem dois registros: (1) Orientações vigentes da Receita Federal sobre transição IBS/CBS (S-14, impacto alto em sistemas fiscais); (2) Proposta de alteração do ICMS interestadual no CONFAZ (S-08), ainda sem norma aprovada — mantida em Informações a verificar.';
      source = 'S-14 (Receita Federal) · S-08 (CONFAZ)';
    } else if (lower.includes('verifica') || lower.includes('pend')) {
      answer =
        'Três sinais aguardam confirmação antes de embasar decisão: S-08 (ICMS CONFAZ em discussão), S-09 (relato não confirmado de -8% na Brisa Concept) e S-15 (Projeto de Lei sobre prazos de troca).';
      source = 'Fila Informações a verificar (S-08, S-09, S-15)';
    } else if (lower.includes('concorren') || lower.includes('extern')) {
      answer =
        'Principais movimentos externos confirmados: Brisa Concept lançou frete grátis acima de R$ 199 (S-01), Vitrine Sul inaugura loja a 1,2 km no Shopping Beira-Mar (S-04), fornecedores anunciam +12% no algodão (S-03) e dólar em alta pressiona 20% do mix importado (S-13).';
      source = 'S-01 · S-03 · S-04 · S-13';
    }

    setAiMessages((prev) => [
      ...prev,
      { role: 'user', text: q },
      { role: 'assistant', text: answer, source },
    ]);
    setAiInput('');
    logSession(`Pergunta enviada ao Assistente demonstrativo: "${q}"`);
  };

  const simProjection = useMemo(() => {
    const baseMonthly = Math.max(1000, simProducedUnits * simUnitPrice);
    const avgTicket = Math.max(1, simUnitPrice);
    const scenarioMultiplier =
      simScenario === 'otimista' ? 1.12 : simScenario === 'pessimista' ? 0.88 : 1.0;
    const demandFactor = 1 + simCrescimento / 100;
    const productionFactor = 1 + simProductionDelta / 100;
    const effectiveGrowth = Math.min(demandFactor, productionFactor);
    const inflationCostDrag = 1 - Math.max(0, simInflacao - 4) * 0.015;
    const cambioDrag = 1 - Math.max(0, simCambio - 5.2) * 0.025;
    const icmsDrag = 1 - Math.max(0, simIcms - 12) * 0.008;
    const months = simHorizon / 30;
    const sales = Math.round(baseMonthly * months * scenarioMultiplier * effectiveGrowth);
    const marginPct = Number(
      Math.max(8, 52.0 * inflationCostDrag * cambioDrag * icmsDrag - (simSelic - 11.5) * 0.25).toFixed(1)
    );
    const netUnitRevenue = avgTicket * (1 - simIcms / 100);
    const marginalGainPerUnit = Number((netUnitRevenue - simMarginalCost).toFixed(2));
    const extraProductionGain =
      Math.max(0, simProductionDelta / 100) * simMarginalUnits * Math.max(0, marginalGainPerUnit);
    const totalFixedMonthly = simFixedCosts + simExtraEmployees * simEmployeeCost;
    const extraFixedOverHorizon = simExtraEmployees * simEmployeeCost * months;
    const profit = Math.round(sales * (marginPct / 100) + extraProductionGain - extraFixedOverHorizon);
    const worthIncreasingProduction = marginalGainPerUnit > 0 && simCrescimento >= -5;
    const ratio = simTargetProfit > 0 ? profit / simTargetProfit : 1;
    const successChancePct = Math.min(
      96,
      Math.max(10, Math.round(ratio * 72 - Math.max(0, simSelic - 11.5) * 1.6))
    );

    const contributionMarginPerUnit = Number((netUnitRevenue - simVariableCost).toFixed(2));
    const breakEvenUnitsMonth =
      contributionMarginPerUnit > 0 ? Math.ceil(totalFixedMonthly / contributionMarginPerUnit) : 0;
    const unmetDemand = Math.max(0, simDemandUnits - simProducedUnits);
    const worthHiring =
      simExtraEmployees <= 0
        ? unmetDemand >= 30 && contributionMarginPerUnit > 0
        : unmetDemand * contributionMarginPerUnit > simExtraEmployees * simEmployeeCost;

    const buildScenarioRow = (
      key: 'atual' | 'pessimista' | 'realista' | 'otimista',
      label: string,
      demandMult: number,
      prodMult: number,
      costMult: number
    ) => {
      const units = Math.round(
        Math.min(simDemandUnits * demandMult, simProducedUnits * prodMult) * months
      );
      const rev = Math.round(units * avgTicket);
      const netRev = rev * (1 - simIcms / 100);
      const varTotal = units * simVariableCost * costMult;
      const fixTotal = totalFixedMonthly * months;
      const netProfit = Math.round(netRev - varTotal - fixTotal);
      const mPct = rev > 0 ? Number(((netProfit / rev) * 100).toFixed(1)) : 0;
      return {
        key,
        label,
        units,
        revenue: rev,
        netProfit,
        marginPct: mPct,
        viable: netProfit > 0,
      };
    };

    const fourScenarios = [
      buildScenarioRow('atual', 'Cenário atual', 1.0, 1.0, 1.0),
      buildScenarioRow('pessimista', 'Cenário pessimista', 0.85, 1.0, 1.07),
      buildScenarioRow(
        'realista',
        'Cenário realista',
        Math.max(0.6, demandFactor),
        Math.max(0.8, productionFactor),
        1 + Math.max(0, simInflacao - 4.6) * 0.015
      ),
      buildScenarioRow(
        'otimista',
        'Cenário otimista',
        Math.max(1.15, demandFactor * 1.1),
        Math.max(1.15, productionFactor * 1.05),
        0.96
      ),
    ];

    return {
      sales,
      marginPct,
      profit,
      marginalGainPerUnit,
      worthIncreasingProduction,
      successChancePct,
      contributionMarginPerUnit,
      totalFixedMonthly,
      breakEvenUnitsMonth,
      worthHiring,
      fourScenarios,
    };
  }, [
    simScenario,
    simHorizon,
    simInflacao,
    simSelic,
    simCambio,
    simIcms,
    simCrescimento,
    simProductionDelta,
    simMarginalCost,
    simMarginalUnits,
    simTargetProfit,
    simProducedUnits,
    simDemandUnits,
    simUnitPrice,
    simFixedCosts,
    simVariableCost,
    simExtraEmployees,
    simEmployeeCost,
  ]);

  const buildDemoReportPayload = (): ExecutiveReportPayload => ({
    companyName: ATLANTICA_BRAND.name,
    environmentLabel: 'DADOS DEMONSTRATIVOS — ATLÂNTICA MODA',
    generatedAt: 'Semana 46 · nov/2026',
    companyDiagnosis: [
      `${ATLANTICA_BRAND.legalName} (${ATLANTICA_BRAND.segment} · ${ATLANTICA_BRAND.city}/${ATLANTICA_BRAND.state}).`,
      `Base ativa: ${ATLANTICA_PRODUCTS.length} SKUs principais monitorados (2 em estoque crítico: Blazer Areia e Bolsa Palha).`,
      `Faturamento semanal R$ 318 mil (+4,2%), Ticket médio R$ 236, Conversão online 1,9% (meta 2,4%), Margem bruta 52%, NPS 41.`,
      `${documents.length} documentos internos na sessão (${interpretedDocsCount} interpretados, ${docsNeedingReviewCount} aguardando validação/inconsistências).`,
    ],
    marketSummary: [
      `Total de ${ATLANTICA_SIGNALS.length} movimentações no Radar (${ATLANTICA_SIGNALS.filter((s) => s.kind === 'oportunidade').length} oportunidades, ${ATLANTICA_SIGNALS.filter((s) => s.kind === 'ameaca').length} ameaças, ${verificationQueue.length} pendentes de confirmação).`,
      `Demanda regional por "vestido de linho" cresceu +38% e vendas de moda via Instagram atingem 18% do segmento.`,
      `Pressão externa de custos: +12% no algodão anunciado por fornecedores, dólar a R$ 5,42 e Selic a 13,75% a.a.`,
    ],
    competitorAnalyses: ATLANTICA_COMPETITORS.map((c) => ({
      name: `${c.name} (${c.locationDistance})`,
      threatLevel: c.threatLevel,
      summary: `${c.lastMovement}. Preço ${c.priceVsUs} (${c.priceRange}). Positivo: ${c.positivesNote} | Atenção: ${c.complaints}`,
    })),
    indicators: ATLANTICA_MACRO.map((m) => ({
      label: m.label,
      value: m.value,
      source: m.source,
      date: m.date,
    })),
    analyses: ATLANTICA_ANALYSES.map((a) => ({
      title: `${a.code} · ${a.title}`,
      summary: `${a.summary} | Recomendação: ${a.strategicRecommendation}`,
    })),
    threatsAndOpportunities: ATLANTICA_ANALYSES.map((a) => ({
      kind: a.classification === 'oportunidade' ? 'Oportunidade' : a.classification === 'ameaca' ? 'Ameaça' : 'Atenção',
      title: `${a.code} · ${a.title}`,
      summary: `${a.evidenceSummary} → ${a.potentialImpact}`,
    })),
    recommendations: decisions.map((d) => ({
      title: `${d.code} · ${d.title}`,
      impact: d.expectedOutcome,
      priority: d.priority,
    })),
    approvedDecisions: decisions
      .filter((d) => d.status === 'aprovada')
      .map((d) => ({
        title: `${d.code} · ${d.title}`,
        outcome: d.expectedOutcome,
        dueDate: d.due,
      })),
    actionPlansSummary: actions.map((a) => ({
      title: `${a.code} · ${a.title} (${a.completionPct}%)`,
      status: a.status === 'concluida' ? 'Concluída' : a.status === 'em_andamento' ? 'Em andamento' : 'A fazer',
      owner: a.owner,
      dueDate: a.due,
    })),
    kpiSummary: [
      { group: 'Inteligência Interna', label: 'Documentos analisados', value: String(documents.length) },
      { group: 'Inteligência Interna', label: 'Relatórios interpretados', value: String(interpretedDocsCount) },
      { group: 'Inteligência Interna', label: 'Descobertas relevantes', value: String(ATLANTICA_ANALYSES.length) },
      { group: 'Ambiente Externo', label: 'Notícias verificadas', value: String(ATLANTICA_SIGNALS.filter((s) => !s.needsVerification).length) },
      { group: 'Ambiente Externo', label: 'Ameaças identificadas', value: String(ATLANTICA_SIGNALS.filter((s) => s.kind === 'ameaca').length) },
      { group: 'Gestão Estratégica', label: 'Decisões aprovadas', value: String(decisions.filter((d) => d.status === 'aprovada').length) },
      { group: 'Gestão Estratégica', label: 'Ações em andamento', value: String(actions.filter((a) => a.status === 'em_andamento').length) },
    ],
    sources: [
      'DOC-02 Comercial',
      'DOC-03 Pós-Venda',
      'DOC-05 Marketing',
      'Banco Central / IBGE / SEFAZ-SC (Referência Demo)',
    ],
    limitations: [
      'Estudo de caso demonstrativo — Atlântica Moda. Valores, nomes e concorrentes são ilustrativos.',
      'Preços anunciados de concorrentes não representam necessariamente preços efetivamente praticados.',
    ],
  });

  const handleExportPdf = () => {
    exportExecutiveReportPDF(buildDemoReportPayload());
    logSession('Relatório executivo PDF completo (8 seções) exportado na sessão.');
  };

  const handleExportExcel = () => {
    exportExecutiveReportExcel(buildDemoReportPayload());
    logSession('Planilha executiva Excel (.xlsx) exportada na sessão.');
  };

  // Preserved Demo Login & Cadastro screens
  if (section === 'login' || section === 'cadastro') {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <img
              src={ATLANTICA_BRAND.logoUrl}
              alt="Atlântica Moda"
              className="h-12 w-12 rounded-lg object-cover border border-[#20C5D5]/30"
            />
            <span className="rounded-md border border-[#20C5D5]/40 bg-[#20C5D5]/10 px-2.5 py-1 text-[11px] font-medium text-[#20C5D5]">
              Demonstração Atlântica Moda
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {section === 'login' ? 'Acesso Demonstrativo' : 'Cadastro Demonstrativo'}
            </h1>
            <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
              Ambiente de apresentação preservado com dados da empresa Atlântica Moda. Nenhuma conta real é gravada aqui.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                E-mail corporativo (Demonstração)
              </label>
              <input
                type="email"
                readOnly
                value="gestao@atlanticamoda.com.br"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Senha demonstrativa
              </label>
              <input
                type="password"
                readOnly
                value="••••••••••••"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => goToSection('painel')}
              className="w-full rounded-lg bg-[#20C5D5] py-2.5 text-sm font-semibold text-[#06132D] hover:bg-[#38d3e2] transition-colors cursor-pointer"
            >
              Entrar no Painel Atlântica Moda
            </button>
          </div>
          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <Link to="/" className="text-[var(--text-secondary)] hover:text-white">
              Voltar ao início
            </Link>
            <Link to="/beta/cadastro" className="font-semibold text-[#20C5D5] hover:underline">
              Criar conta real na versão Beta →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      navGroups={navGroups}
      activeId={section}
      onSelect={(id) => goToSection(id as DemoSection)}
      companyName={ATLANTICA_BRAND.name}
      companySegment={ATLANTICA_BRAND.segment}
      periodLabel="Semana 46 · nov/2026"
      environmentTag="Dados demonstrativos"
      isDemo={true}
      userInitial="A"
      notificationCount={ATLANTICA_NOTIFICATIONS.length}
      onOpenNotifications={() => goToSection('historico')}
      onOpenHelp={() => setAiOpen(true)}
      sidebarPlanBox={
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[#102B50]/70 p-3 text-xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            SEU PLANO
          </div>
          <div className="font-bold text-white">Acesso demonstrativo</div>
          <button
            type="button"
            onClick={() => goToSection('plano')}
            className="text-[11px] font-medium text-[#20C5D5] hover:underline cursor-pointer"
          >
            Escolher um plano
          </button>
        </div>
      }
      sidebarFooter={
        <div className="space-y-1.5">
          <Link
            to="/beta/cadastro"
            className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-[#20C5D5] px-3 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] transition-colors"
          >
            <span>Acessar versão Beta</span>
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Portal Inicial</span>
          </Link>
        </div>
      }
      mobileBottomItems={[
        { id: 'painel', label: 'Visão geral', icon: LayoutDashboard },
        { id: 'radar', label: 'Radar', icon: Radar },
        { id: 'decisoes', label: 'Decisões', icon: CheckCircle2 },
        { id: 'produtos', label: 'Produtos', icon: Package },
      ]}
    >
      {/* ================================================================ */}
      {/* VISÃO GERAL (PDF 2 pages 3-4)                                    */}
      {/* ================================================================ */}
      {section === 'painel' && (
        <div className="space-y-6">
          <PageHeader
            kicker="PAINEL DO GESTOR"
            title="Boa tarde, Gestor Atlântica Moda."
            description="Resumo da semana: mercado, concorrência e decisões que dependem de você."
            actions={
              <button
                type="button"
                onClick={() => goToSection('login')}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer"
              >
                Login demo
              </button>
            }
          />

          {/* Top 5 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <KpiStatCard
              title="Decisões pendentes"
              value={pendingDecisionsCount}
              subtitle="Aguardando aprovação"
              tone="amber"
              icon={CheckCircle2}
              onClick={() => goToSection('decisoes')}
            />
            <KpiStatCard
              title="Oportunidades"
              value={ATLANTICA_SIGNALS.filter((s) => s.kind === 'oportunidade').length}
              subtitle="Merecem avaliação"
              tone="green"
              icon={Lightbulb}
              onClick={() => goToSection('oportunidades')}
            />
            <KpiStatCard
              title="Ameaças"
              value={ATLANTICA_SIGNALS.filter((s) => s.kind === 'ameaca').length}
              subtitle={`${ATLANTICA_SIGNALS.filter((s) => s.kind === 'ameaca' && s.impactLabel === 'Impacto alto').length} de impacto alto`}
              tone="red"
              icon={AlertTriangle}
              onClick={() => goToSection('radar')}
            />
            <KpiStatCard
              title="A verificar"
              value={verificationQueue.length}
              subtitle="Sem confirmação"
              tone="default"
              icon={Search}
              onClick={() => goToSection('verificar')}
            />
            <KpiStatCard
              title="Ações abertas"
              value={actions.filter((a) => a.status === 'em_andamento').length}
              subtitle="Em execução"
              tone="cyan"
              icon={Briefcase}
              onClick={() => goToSection('planos-acao')}
            />
          </div>

          {/* Recomendações Prioritárias */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Recomendações prioritárias</h2>
                <p className="text-xs text-[var(--text-secondary)]">Decisões que merecem sua atenção agora.</p>
              </div>
              <button
                type="button"
                onClick={() => goToSection('decisoes')}
                className="text-xs font-medium text-[#20C5D5] hover:underline cursor-pointer"
              >
                Central de decisões →
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {decisions.slice(0, 2).map((d) => (
                <div
                  key={d.code}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--text-secondary)]">{d.code}</span>
                      <StatusBadge
                        kind={
                          d.status === 'pendente'
                            ? 'pendente'
                            : d.status === 'aprovada'
                            ? 'aprovada'
                            : d.status === 'descartada'
                            ? 'recusada'
                            : 'alerta'
                        }
                        customLabel={
                          d.status === 'adiada'
                            ? 'Adiada'
                            : d.status === 'descartada'
                            ? 'Descartada'
                            : undefined
                        }
                      />
                      <span className="rounded bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px] text-[#EF6464]">
                        {d.priority}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)]">{d.due}</span>
                  </div>

                  <h3 className="text-base font-bold">{d.title}</h3>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">PROBLEMA</div>
                      <div className="mt-0.5 text-[var(--text-primary)]">{d.problem}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">EVIDÊNCIA</div>
                      <div className="mt-0.5 text-[var(--text-secondary)]">{d.evidence}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">AÇÃO SUGERIDA</div>
                      <div className="mt-0.5 text-[var(--text-primary)]">{d.suggestedAction}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/60 px-3 py-2 text-xs text-[#20B981]">
                    Resultado esperado: <strong className="text-[var(--text-primary)]">{d.expectedOutcome}</strong>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                    <TraceabilityBar steps={mapTraceSteps(d.trace)} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDecisionAction(d.code, 'adiada')}
                        className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer"
                      >
                        Adiar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecisionAction(d.code, 'aprovada')}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#F2B84B] px-3 py-1.5 text-xs font-semibold text-[#06132D] hover:bg-[#f7c86d] cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{d.status === 'aprovada' ? 'Aprovada' : 'Aprovar'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3-Column Overview Strip matching PDF 2 p.4 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">O que mudou no ambiente externo?</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">Movimentações recentes</p>
                </div>
                <button type="button" onClick={() => goToSection('radar')} className="text-xs text-[#20C5D5] hover:underline cursor-pointer">
                  Ver tudo →
                </button>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {ATLANTICA_SIGNALS.slice(0, 4).map((s) => (
                  <div key={s.code} className="py-2.5 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge kind={s.kind} />
                      <span className="text-[10px] text-[var(--text-secondary)]">{s.lastChecked.split(' · ')[0]}</span>
                    </div>
                    <div className="font-semibold text-[var(--text-primary)]">{s.title}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">O que os concorrentes estão fazendo?</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">Últimos movimentos</p>
                </div>
                <button type="button" onClick={() => goToSection('concorrentes')} className="text-xs text-[#20C5D5] hover:underline cursor-pointer">
                  Ver tudo →
                </button>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {ATLANTICA_COMPETITORS.slice(0, 4).map((c) => (
                  <div key={c.name} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">{c.name}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{c.lastMovement}</div>
                    </div>
                    <StatusBadge
                      kind={c.threatTone === 'red' ? 'ameaca' : c.threatTone === 'amber' ? 'alerta' : 'oportunidade'}
                      customLabel={c.threatLevel}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Descobertas dos relatórios internos</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">Interpretação demonstrativa</p>
                </div>
                <button type="button" onClick={() => goToSection('documentos')} className="text-xs text-[#20C5D5] hover:underline cursor-pointer">
                  Ver tudo →
                </button>
              </div>
              <div className="divide-y divide-[var(--border-subtle)] text-xs">
                <div className="py-2.5">
                  <div className="text-[10px] text-[var(--text-secondary)]">Marketing · Aguardando avaliação</div>
                  <div className="font-semibold mt-0.5">Redução do alcance das campanhas</div>
                </div>
                <div className="py-2.5">
                  <div className="text-[10px] text-[var(--text-secondary)]">Marketing · F-02</div>
                  <div className="font-semibold mt-0.5">Engajamento no Instagram em alta</div>
                </div>
                <div className="py-2.5">
                  <div className="text-[10px] text-[var(--text-secondary)]">Comercial · F-03</div>
                  <div className="font-semibold mt-0.5">Abandono de carrinho subiu 6 p.p.</div>
                </div>
                <div className="py-2.5">
                  <div className="text-[10px] text-[var(--text-secondary)]">Comercial · Aguardando avaliação</div>
                  <div className="font-semibold mt-0.5">Pressão por descontos nas lojas</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom 3-Column Strip + Banner matching PDF 2 p.4 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Oportunidades identificadas</span>
                <button type="button" onClick={() => goToSection('oportunidades')} className="text-[#20C5D5] hover:underline cursor-pointer">Ver tudo →</button>
              </div>
              {ATLANTICA_BRIEFING.opportunities.map((o) => (
                <div key={o} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-2.5">
                  <span className="text-[#20B981] font-semibold">● </span>{o}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Ameaças e pontos de atenção</span>
                <button type="button" onClick={() => goToSection('radar')} className="text-[#20C5D5] hover:underline cursor-pointer">Ver tudo →</button>
              </div>
              {ATLANTICA_BRIEFING.risks.map((r) => (
                <div key={r} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-2.5">
                  <span className="text-[#EF6464] font-semibold">● </span>{r}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Ações a executar</span>
                <button type="button" onClick={() => goToSection('planos-acao')} className="text-[#20C5D5] hover:underline cursor-pointer">Ver tudo →</button>
              </div>
              {actions.slice(0, 2).map((a) => (
                <div key={a.code} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">{a.owner} · {a.due}</div>
                  </div>
                  <StatusBadge
                    kind={a.status === 'a_fazer' ? 'pendente' : a.status}
                    customLabel={a.status === 'a_fazer' ? 'A fazer' : undefined}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom verification strip */}
          {verificationQueue.length > 0 && (
            <div className="rounded-xl border border-[#F2B84B]/30 bg-[var(--bg-card)] px-4 py-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[#F2B84B]">Informações a verificar:</span>
              {verificationQueue.map((v) => (
                <button
                  key={v.code}
                  type="button"
                  onClick={() => goToSection('verificar')}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-2.5 py-1 text-[11px] hover:border-[#20C5D5] cursor-pointer"
                >
                  {v.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* DOCUMENTOS E RELATÓRIOS (PDF 2 p.5)                              */}
      {/* ================================================================ */}
      {section === 'documentos' && (
        <div className="space-y-5">
          <PageHeader
            kicker="INTELIGÊNCIA INTERNA"
            title="Documentos e relatórios"
            description="Envie relatórios da empresa. O Gêmeo Digital identifica fatos, hipóteses e recomendações."
          />

          <div className="rounded-xl border border-[#20C5D5]/30 bg-[var(--bg-card)] p-4 text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
            <Info className="h-4 w-4 text-[#20C5D5] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[var(--text-primary)]">Documentos internos e confidenciais:</strong> nesta versão demonstrativa o arquivo fica apenas nesta aba do navegador: não é enviado a servidores e não altera o banco da versão Beta. Para importação persistente com OCR/Excel real, utilize a{' '}
              <Link to="/beta/cadastro" className="text-[#20C5D5] underline">versão Beta</Link>.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleUploadDemoDocument}
              className="lg:col-span-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs self-start"
            >
              <div className="font-bold text-sm">Novo documento</div>
              <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-sidebar)] p-4 text-center space-y-1">
                <Upload className="h-5 w-5 text-[#20C5D5] mx-auto" />
                <div className="text-[11px]">Simule o anexo nesta sessão</div>
                <div className="text-[10px] text-[var(--text-secondary)]">PDF · DOCX · XLSX · CSV · PPTX</div>
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Nome do documento *</label>
                <input
                  type="text"
                  required
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="Ex.: Fechamento novembro"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1">Departamento</label>
                  <select value={newDocDept} onChange={(e) => setNewDocDept(e.target.value)} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2 text-xs">
                    <option>Marketing</option>
                    <option>Comercial</option>
                    <option>Operações</option>
                    <option>Recursos Humanos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1">Categoria</label>
                  <select value={newDocCat} onChange={(e) => setNewDocCat(e.target.value)} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2 text-xs">
                    <option>Relatório de marketing</option>
                    <option>Vendas / ERP</option>
                    <option>Pós-venda</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Período de referência</label>
                <input
                  type="text"
                  value={newDocPeriod}
                  onChange={(e) => setNewDocPeriod(e.target.value)}
                  placeholder="ex.: nov/2026"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Observações (opcional)</label>
                <textarea
                  rows={2}
                  value={newDocNotes}
                  onChange={(e) => setNewDocNotes(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-[#F4F8FF] py-2 text-xs font-semibold text-[#06132D] hover:bg-white cursor-pointer"
              >
                Enviar documento (sessão)
              </button>
            </form>

            <div className="lg:col-span-8 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {['Todos', 'Em processamento', 'Aguardando interpretação', 'Com inconsistências', 'Interpretado', 'Arquivado'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setDocFilter(st)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                      docFilter === st
                        ? 'bg-[#20C5D5] text-[#06132D] font-semibold'
                        : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {documents
                .filter((d) => docFilter === 'Todos' || d.status === docFilter)
                .map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[var(--bg-card-secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[#20C5D5]">
                          {d.format}
                        </span>
                        <StatusBadge
                          kind={
                            d.status === 'Interpretado'
                              ? 'aprovada'
                              : d.status === 'Com inconsistências'
                              ? 'ameaca'
                              : d.status === 'Aguardando interpretação'
                              ? 'pendente'
                              : 'movimento'
                          }
                          customLabel={d.status}
                        />
                      </div>
                      <div className="text-sm font-bold">{d.title}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{d.meta}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setOpenDoc(d)}
                        className="rounded-lg border border-[#20C5D5]/40 bg-[#20C5D5]/10 px-3 py-1.5 text-xs font-medium text-[#20C5D5] hover:bg-[#20C5D5]/20 cursor-pointer"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocuments((prev) => prev.filter((x) => x.id !== d.id))}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[#EF6464] cursor-pointer"
                        aria-label="Remover da sessão"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {openDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-[#20C5D5]">{openDoc.id} · {openDoc.format}</div>
                    <h3 className="text-lg font-bold">{openDoc.title}</h3>
                  </div>
                  <button type="button" onClick={() => setOpenDoc(null)} className="text-[var(--text-secondary)] hover:text-white cursor-pointer">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="text-xs text-[var(--text-secondary)]">{openDoc.meta}</div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/60 p-4 text-xs leading-relaxed">
                  {openDoc.summary}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpenDoc(null)}
                    className="rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* DADOS DA EMPRESA E INTEGRAÇÕES (PDF 2 p.21-22)                   */}
      {/* ================================================================ */}
      {section === 'dados-empresa' && (
        <div className="space-y-6">
          <PageHeader
            kicker="INTELIGÊNCIA INTERNA"
            title="Dados da empresa e integrações"
            description="Estrutura de conexão oficial, site próprio e importação manual demonstrada na Atlântica Moda."
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs">
              <h3 className="text-base font-bold">Integração automática</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                iFood, Mercado Livre e OLX (OAuth oficial). Estrutura pronta para Shopee, Amazon e Shopify.
              </p>
              {['iFood', 'Mercado Livre', 'OLX', 'Shopee', 'Amazon', 'Shopify'].map((p) => (
                <div key={p} className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <div>
                    <span className="font-semibold text-sm">{p}</span>
                    <span className="ml-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                      desconectado
                    </span>
                  </div>
                  <Link
                    to="/beta/cadastro"
                    className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs hover:border-[#20C5D5]"
                  >
                    Conectar na Beta
                  </Link>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs">
              <h3 className="text-base font-bold">Site próprio</h3>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Outro: link do site/loja</label>
                <input
                  type="url"
                  readOnly
                  value={ATLANTICA_BRAND.website}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm"
                />
              </div>
              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-3">
                <img src={ATLANTICA_BRAND.logoUrl} alt="Atlântica Moda" className="h-12 w-12 rounded-lg object-cover" />
                <div>
                  <div className="font-bold text-sm">{ATLANTICA_BRAND.legalName}</div>
                  <div className="text-[var(--text-secondary)]">CNPJ {ATLANTICA_BRAND.cnpj}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
              <h3 className="text-base font-bold">Manual</h3>
              <p className="text-[var(--text-secondary)]">Foto (OCR), Excel/CSV ou PDF.</p>
              <div className="space-y-2 text-[var(--text-secondary)] leading-relaxed">
                <p><strong className="text-[var(--text-primary)]">Custo dos materiais:</strong> permite calcular o impacto da inflação na sua margem.</p>
                <p><strong className="text-[var(--text-primary)]">Total de vendas:</strong> base para sazonalidade e simulação.</p>
                <p><strong className="text-[var(--text-primary)]">Perdas:</strong> mostram o quanto proteger a lucratividade.</p>
                <p><strong className="text-[var(--text-primary)]">Estoque:</strong> liga a Selic ao capital parado.</p>
              </div>
              <button
                type="button"
                onClick={() => goToSection('documentos')}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] py-2 font-medium hover:border-[#20C5D5] cursor-pointer"
              >
                Abrir documentos e planilhas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* PRODUTOS E ESTOQUE (Importação Excel/PDF + Ranking + Atlântica) */}
      {/* ================================================================ */}
      {section === 'produtos' && (
        <div className="space-y-5">
          <PageHeader
            kicker="INTELIGÊNCIA INTERNA"
            title="Produtos e Estoque — Atlântica Moda"
            description="Importe catálogo de produtos e unidades vendidas via Excel ou PDF para visualizar o ranking de vendas, preservando todos os produtos da demonstração."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {demoProducts !== ATLANTICA_PRODUCTS && (
                  <button
                    type="button"
                    onClick={() => {
                      setDemoProducts(ATLANTICA_PRODUCTS);
                      setSelectedProduct(null);
                      setDemoProductNotice('Catálogo demonstrativo restaurado para os 4 produtos originais da Atlântica Moda.');
                    }}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium hover:border-[#20C5D5] cursor-pointer"
                  >
                    Restaurar catálogo original
                  </button>
                )}
                <div className="relative w-64">
                  <Search className="h-3.5 w-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar produto ou código..."
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] pl-8 pr-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            }
          />

          {demoProductNotice && (
            <div className="rounded-lg border border-[#20C5D5]/40 bg-[#20C5D5]/10 px-4 py-2.5 text-xs text-[#20C5D5] flex items-center justify-between gap-2">
              <span>{demoProductNotice}</span>
              <button type="button" onClick={() => setDemoProductNotice('')} className="hover:text-white cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Duas seções de importação (Excel ou PDF) em sessão demonstrativa */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* 1. Catálogo de Produtos e Estoque */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">
                    1. Catálogo de Produtos e Estoque
                  </span>
                  <h2 className="text-base font-bold mt-0.5">
                    Importar Catálogo (Excel ou PDF)
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Envie arquivo com <strong>código</strong>, <strong>nome do produto</strong>,{' '}
                    <strong>preço unitário</strong> e estoque para testar na sessão.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCatalogTemplateExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-3 py-1.5 text-xs font-medium hover:border-[#20C5D5] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#20C5D5]" />
                  <span>Modelo Excel</span>
                </button>
              </div>

              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 px-4 py-5 text-center cursor-pointer hover:border-[#20C5D5] transition-colors">
                {demoCatalogLoading ? (
                  <div className="flex items-center gap-2 text-xs text-[#20C5D5]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processando catálogo...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#20C5D5]">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Selecionar Excel (.xlsx, .xls, .csv) ou PDF (.pdf)</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)] mt-1">
                      Simulação em sessão — não altera a base original permanentemente
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  disabled={demoCatalogLoading}
                  onChange={(e) => handleDemoProductFileUpload('catalog', e)}
                  className="hidden"
                />
              </label>

              {demoCatalogPreview && (
                <div className="rounded-lg border border-[#20C5D5]/40 bg-[var(--bg-card-secondary)]/60 p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#20C5D5]">
                        Prévia: {demoCatalogPreview.fileName} ({demoCatalogPreview.items.length} itens)
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{demoCatalogPreview.note}</div>
                    </div>
                    <button type="button" onClick={() => setDemoCatalogPreview(null)} className="text-[var(--text-secondary)] hover:text-white cursor-pointer">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded border border-[var(--border-subtle)]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[var(--bg-sidebar)] text-[var(--text-secondary)] sticky top-0">
                        <tr>
                          <th className="px-2.5 py-1.5">Código</th>
                          <th className="px-2.5 py-1.5">Produto</th>
                          <th className="px-2.5 py-1.5 text-right">Preço Un.</th>
                          <th className="px-2.5 py-1.5 text-right">Estoque</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {demoCatalogPreview.items.map((item, idx) => (
                          <tr key={`${item.sku}-${item.name}-${idx}`}>
                            <td className="px-2.5 py-1.5 font-mono text-[var(--text-secondary)]">{item.sku || '—'}</td>
                            <td className="px-2.5 py-1.5 font-medium">{item.name}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono">R$ {item.priceReais.toFixed(2)}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono">{item.stockQty} un.</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setDemoCatalogPreview(null)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 cursor-pointer">
                      Cancelar
                    </button>
                    <button type="button" onClick={() => confirmDemoProductImport('catalog')} className="rounded-lg bg-[#20C5D5] px-4 py-1.5 font-semibold text-[#06132D] cursor-pointer">
                      Aplicar ao Catálogo Demo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Unidades Vendidas por Produto */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#20B981]">
                    2. Unidades Vendidas por Produto
                  </span>
                  <h2 className="text-base font-bold mt-0.5">
                    Importar Unidades Vendidas (Excel ou PDF)
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Envie as unidades vendidas de cada item para atualizar na hora o{' '}
                    <strong>ranking e gráfico comparativo de vendas</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadSalesUnitsTemplateExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-3 py-1.5 text-xs font-medium hover:border-[#20B981] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#20B981]" />
                  <span>Modelo Excel</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-[var(--text-secondary)]">Ao importar:</span>
                <select
                  value={demoSalesStrategy}
                  onChange={(e) => setDemoSalesStrategy(e.target.value as 'replace' | 'add')}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1 text-xs"
                >
                  <option value="replace">Substituir vendas do período</option>
                  <option value="add">Somar às unidades atuais</option>
                </select>
              </div>

              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 px-4 py-5 text-center cursor-pointer hover:border-[#20B981] transition-colors">
                {demoSalesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-[#20B981]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Lendo unidades vendidas...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#20B981]">
                      <Upload className="h-4 w-4" />
                      <span>Selecionar Excel (.xlsx, .xls, .csv) ou PDF (.pdf)</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)] mt-1">
                      Cruza por código/SKU ou nome e recalcula o ranking automaticamente
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  disabled={demoSalesLoading}
                  onChange={(e) => handleDemoProductFileUpload('sales', e)}
                  className="hidden"
                />
              </label>

              {demoSalesPreview && (
                <div className="rounded-lg border border-[#20B981]/40 bg-[var(--bg-card-secondary)]/60 p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#20B981]">
                        Prévia: {demoSalesPreview.fileName} ({demoSalesPreview.items.length} itens)
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{demoSalesPreview.note}</div>
                    </div>
                    <button type="button" onClick={() => setDemoSalesPreview(null)} className="text-[var(--text-secondary)] hover:text-white cursor-pointer">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded border border-[var(--border-subtle)]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[var(--bg-sidebar)] text-[var(--text-secondary)] sticky top-0">
                        <tr>
                          <th className="px-2.5 py-1.5">Código</th>
                          <th className="px-2.5 py-1.5">Produto</th>
                          <th className="px-2.5 py-1.5 text-right">Unidades Vendidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {demoSalesPreview.items.map((item, idx) => (
                          <tr key={`${item.sku}-${item.name}-${idx}`}>
                            <td className="px-2.5 py-1.5 font-mono text-[var(--text-secondary)]">{item.sku || '—'}</td>
                            <td className="px-2.5 py-1.5 font-medium">{item.name}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono font-bold text-[#20B981]">{item.soldUnits} un.</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setDemoSalesPreview(null)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 cursor-pointer">
                      Cancelar
                    </button>
                    <button type="button" onClick={() => confirmDemoProductImport('sales')} className="rounded-lg bg-[#20B981] px-4 py-1.5 font-semibold text-[#06132D] cursor-pointer">
                      Atualizar Ranking Demo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ranking, Destaque e Gráfico Comparativo de Vendas por Produto */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#20C5D5]/15 text-[#20C5D5]">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">
                    Ranking e Desempenho de Vendas por Produto
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Comparativo imediato de unidades vendidas e cobertura de estoque do portfólio Atlântica Moda.
                  </p>
                </div>
              </div>
              <StatusBadge kind="oportunidade" customLabel="Ranking em tempo real" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiStatCard
                title="Produto Líder (1º Lugar)"
                value={demoSalesStats.topProduct ? demoSalesStats.topProduct.name : 'Sem vendas'}
                subtitle={
                  demoSalesStats.topProduct
                    ? `${demoSalesStats.topProduct.sales30d} un. vendidas`
                    : 'Sem registros'
                }
                tone="cyan"
              />
              <KpiStatCard
                title="Total de Unidades Vendidas"
                value={`${demoSalesStats.totalSoldUnits.toLocaleString('pt-BR')} un.`}
                subtitle={`Em ${demoProducts.length} SKU(s) ativos`}
                tone="green"
              />
              <KpiStatCard
                title="Receita Estimada do Mix"
                value={`R$ ${demoSalesStats.totalEstimatedRevenue.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                subtitle="Unidades vendidas × preço unitário"
                tone="default"
              />
              <KpiStatCard
                title="Alerta de Reposição nos Líderes"
                value={`${demoSalesStats.criticalTopSellersCount} SKU(s)`}
                subtitle={
                  demoSalesStats.criticalTopSellersCount > 0
                    ? 'Atenção para ruptura de estoque'
                    : 'Cobertura saudável'
                }
                tone={demoSalesStats.criticalTopSellersCount > 0 ? 'amber' : 'green'}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#20C5D5]" />
                    <span>Unidades Vendidas vs. Estoque Atual</span>
                  </h3>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Top {demoSalesStats.chartData.length} produtos
                  </span>
                </div>
                <SimpleBarChart
                  data={demoSalesStats.chartData}
                  primaryLabel="Unidades vendidas"
                  secondaryLabel="Estoque atual"
                  unitSuffix=""
                  height={220}
                />
              </div>

              <div className="lg:col-span-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#20B981]" />
                    <span>Ranking de Produtos Mais Vendidos</span>
                  </h3>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Participação no volume total
                  </span>
                </div>
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {demoSalesStats.ranked.map((p, index) => {
                    const sold = p.sales30d || 0;
                    const sharePct =
                      demoSalesStats.totalSoldUnits > 0
                        ? Math.round((sold / demoSalesStats.totalSoldUnits) * 1000) / 10
                        : 0;
                    const estRev = sold * p.price;
                    const needsRestock =
                      sold > 0 && p.stock <= Math.max(11, Math.round(sold * 0.18));
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]/80 p-3 cursor-pointer hover:border-[#20C5D5] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono font-bold text-[11px] ${
                                index === 0
                                  ? 'bg-[#20C5D5] text-[#06132D]'
                                  : index === 1
                                  ? 'bg-[#20B981]/25 text-[#20B981]'
                                  : index === 2
                                  ? 'bg-[#F2B84B]/25 text-[#F2B84B]'
                                  : 'bg-[var(--bg-card-secondary)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {index + 1}º
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{p.name}</div>
                              <div className="text-[11px] text-[var(--text-secondary)]">
                                SKU {p.sku} · Estoque: {p.stock} un.
                                {needsRestock && (
                                  <span className="ml-2 text-[#F2B84B] font-semibold">
                                    · Estoque crítico
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-[#20C5D5]">
                              {sold} un. ({sharePct}%)
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)] font-mono">
                              R$ {estRev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--bg-card-secondary)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              index === 0 ? 'bg-[#20C5D5]' : 'bg-[#20B981]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(sold > 0 ? 4 : 0, sharePct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {selectedProduct ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#20C5D5] hover:underline cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Voltar para lista de produtos</span>
              </button>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="w-full aspect-[4/3] object-cover rounded-lg border border-[var(--border-subtle)]"
                />
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span>{selectedProduct.category} · SKU {selectedProduct.sku}</span>
                    <StatusBadge kind={selectedProduct.status === 'Estoque crítico' ? 'alerta' : 'aprovada'} customLabel={selectedProduct.status} />
                  </div>
                  <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
                  <p className="text-sm text-[var(--text-secondary)]">{selectedProduct.description}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3">
                      <div className="text-[11px] text-[var(--text-secondary)]">Preço de Venda</div>
                      <div className="font-mono font-bold tabular-nums">R$ {selectedProduct.price.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3">
                      <div className="text-[11px] text-[var(--text-secondary)]">Custo Aquisição</div>
                      <div className="font-mono font-bold tabular-nums">R$ {selectedProduct.cost.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3">
                      <div className="text-[11px] text-[var(--text-secondary)]">Margem Bruta</div>
                      <div className="font-mono font-bold tabular-nums text-[#20B981]">{selectedProduct.marginPct}%</div>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3">
                      <div className="text-[11px] text-[var(--text-secondary)]">Estoque / Vendidas</div>
                      <div className="font-mono font-bold tabular-nums">{selectedProduct.stock} un. / {selectedProduct.sales30d} un.</div>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] pt-2">
                    Tendência: <strong className="text-[#20C5D5]">{selectedProduct.trend}</strong>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {demoProducts.filter(
                (p) =>
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.sku.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden cursor-pointer hover:border-[#20C5D5] transition-colors flex flex-col"
                >
                  <img src={p.imageUrl} alt={p.name} className="w-full aspect-[4/3] object-cover" />
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--text-secondary)]">{p.category} · {p.sku}</span>
                      </div>
                      <h3 className="text-sm font-bold mt-1">{p.name}</h3>
                    </div>
                    <div className="pt-2 space-y-1 text-xs border-t border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold tabular-nums text-[#20C5D5]">
                          R$ {p.price.toFixed(2)}
                        </span>
                        <span className={p.stock < 12 ? 'text-[#F2B84B] font-semibold' : 'text-[var(--text-secondary)]'}>
                          Estoque: {p.stock} un.
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-secondary)]">Vendidas:</span>
                        <span className="font-mono font-semibold text-[#20B981]">{p.sales30d} un.</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* CONSUMIDORES E VOZ DO CLIENTE (PDF 1 p.1)                        */}
      {/* ================================================================ */}
      {section === 'consumidores' && (
        <div className="space-y-6">
          <PageHeader
            kicker="INTELIGÊNCIA DE MERCADO"
            title="Consumidores"
            description="Tendências de busca e percepção dos clientes."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold">Tendências de busca</h2>
                <p className="text-xs text-[var(--text-secondary)]">Termos relacionados ao setor na região</p>
              </div>
              <div className="space-y-3 text-xs">
                {ATLANTICA_SEARCH_TRENDS.map((t) => (
                  <div key={t.label} className="space-y-1">
                    <div className="flex justify-between">
                      <span>{t.label}</span>
                      <span className={`font-mono font-semibold ${t.negative ? 'text-[#EF6464]' : 'text-[#20C5D5]'}`}>
                        {t.delta > 0 ? `+${t.delta}%` : `${t.delta}%`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-card-secondary)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${t.negative ? 'bg-[#EF6464]' : 'bg-[#20C5D5]'}`}
                        style={{ width: `${Math.min(100, Math.abs(t.delta) * 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold">Voz do cliente</h2>
                <p className="text-xs text-[var(--text-secondary)]">Percepção positiva agrupada por tema</p>
              </div>
              <HorizontalProgressList items={ATLANTICA_CONSUMER_VOICE} />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold">Sinais sobre o consumidor</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {ATLANTICA_SIGNALS.filter((s) => s.radarGroup === 'consumidor').map((s) => (
                <SignalCard
                  key={s.code}
                  code={s.code}
                  kind={s.kind}
                  impactLabel={s.impactLabel}
                  category={s.category}
                  metaRight={s.metaRight}
                  title={s.title}
                  summary={s.summary}
                  sourceName={s.sourceName}
                  sourceVerified={s.sourceVerified}
                  lastChecked={s.lastChecked}
                  relevance={s.relevance}
                  potentialImpact={s.potentialImpact}
                  recommendation={s.recommendation}
                  traceSteps={mapTraceSteps(s.trace)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* RADAR DE MERCADO (PDF 2 p.6-7 — Monitoramento setorial unificado)*/}
      {/* ================================================================ */}
      {section === 'radar' && (
        <div className="space-y-5">
          <PageHeader
            kicker="INTELIGÊNCIA EXTERNA"
            title="Radar de mercado"
            description="Notícias, movimentações setoriais, oportunidades e riscos externos cruzados com dados internos."
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-9 space-y-4">
              <div className="flex flex-wrap gap-1.5 text-xs">
                {['Todos', 'Oportunidades', 'Ameaças', 'A verificar', 'Movimentações'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRadarTypeFilter(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      radarTypeFilter === t
                        ? 'bg-[#F4F8FF] text-[#06132D] font-semibold'
                        : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {ATLANTICA_SIGNALS.filter((s) => {
                const matchType =
                  radarTypeFilter === 'Todos' ||
                  (radarTypeFilter === 'Oportunidades' && s.kind === 'oportunidade') ||
                  (radarTypeFilter === 'Ameaças' && s.kind === 'ameaca') ||
                  (radarTypeFilter === 'A verificar' && s.kind === 'pendente') ||
                  (radarTypeFilter === 'Movimentações' && s.kind === 'movimento');
                const matchCat = radarCatFilter === 'Todas' || s.category === radarCatFilter;
                return matchType && matchCat;
              }).map((s) => {
                const derivedPublished =
                  s.publishedDate ||
                  (s.metaRight.includes('Publicado em ')
                    ? s.metaRight.split('Publicado em ')[1]
                    : s.lastChecked.split(' · ')[0]);
                return (
                  <SignalCard
                    key={s.code}
                    code={s.code}
                    kind={s.kind}
                    impactLabel={s.impactLabel}
                    category={s.category}
                    metaRight={s.metaRight}
                    title={s.title}
                    summary={s.summary}
                    sourceName={s.sourceName}
                    sourceVerified={s.sourceVerified}
                    publishedDate={derivedPublished}
                    lastChecked={s.lastChecked}
                    relevance={s.relevance}
                    potentialImpact={s.potentialImpact}
                    recommendation={s.recommendation}
                    traceSteps={mapTraceSteps(s.trace)}
                  />
                );
              })}
            </div>
            <aside className="lg:col-span-3 space-y-3 self-start">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-xs space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  POR CATEGORIA
                </div>
                {['Todas', 'Concorrência', 'Setor', 'Custos', 'Canais', 'Eventos', 'Tributação', 'Macroeconomia', 'Legislação', 'Consumidor'].map((cat) => {
                  const count =
                    cat === 'Todas'
                      ? ATLANTICA_SIGNALS.length
                      : ATLANTICA_SIGNALS.filter((s) => s.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setRadarCatFilter(cat)}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 cursor-pointer ${
                        radarCatFilter === cat
                          ? 'bg-[#15365F] text-white font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-white'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className="font-mono text-[11px]">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-xs space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  SEPARAÇÃO DE FONTES
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  O Radar concentra notícias, concorrentes e eventos de mercado. Indicadores econômicos oficiais ficam em{' '}
                  <button type="button" onClick={() => goToSection('macro')} className="text-[#20C5D5] hover:underline cursor-pointer">
                    Ambiente macroeconômico
                  </button>.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-xs space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  COMO AS INFORMAÇÕES AVANÇAM
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Informação não confirmada fica em{' '}
                  <button type="button" onClick={() => goToSection('verificar')} className="text-[#20C5D5] hover:underline cursor-pointer">
                    Informações a verificar
                  </button>{' '}
                  e só vira recomendação após validação.
                </p>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* AMBIENTE MACROECONÔMICO (PDF 2 p.8)                              */}
      {/* ================================================================ */}
      {section === 'macro' && (
        <div className="space-y-6">
          <PageHeader
            kicker="INTELIGÊNCIA EXTERNA"
            title="Ambiente macroeconômico"
            description="Economia, inflação (12m e acumulada), câmbio, ICMS estadual e tradução prática para a Atlântica Moda."
            actions={
              <button
                type="button"
                onClick={() => setShowMacroTranslator((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#20C5D5]/40 bg-[#20C5D5]/10 px-3 py-1.5 text-xs font-medium text-[#20C5D5] hover:bg-[#20C5D5]/20 cursor-pointer"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span>{showMacroTranslator ? 'Ocultar tradutor prático' : 'Mostrar tradutor prático'}</span>
              </button>
            }
          />

          <div className="rounded-xl border border-[#F2B84B]/30 bg-[#F2B84B]/10 px-4 py-2.5 text-xs text-[#F2B84B]">
            Valores ilustrativos (Demonstração). Antes de decidir, confira o dado atualizado no portal oficial indicado em cada cartão ou acesse a versão Beta com leitura direta do BCB, IBGE e SEFAZ por UF.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {ATLANTICA_MACRO.map((m) => (
              <div key={m.code} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">{m.label}</span>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">{m.date}</span>
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums">{m.value}</div>
                  <div className="text-[11px] text-[#20C5D5]">{m.delta}</div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed pt-1">{m.impact}</p>
                </div>
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[10px] text-[var(--text-secondary)]">
                  <span className="truncate">{m.source}</span>
                  {m.sourceUrl && (
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#20C5D5] hover:underline shrink-0"
                    >
                      <span>Portal</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold">Inflação geral × vestuário</h3>
                <p className="text-[11px] text-[var(--text-secondary)]">% em 12 meses · ilustrativo</p>
              </div>
              <TrendLineChart
                labels={ATLANTICA_MACRO_SERIES.labels}
                series={ATLANTICA_MACRO_SERIES.series}
                unitSuffix="%"
              />
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold">Evolução Taxa Selic</h3>
                <p className="text-[11px] text-[var(--text-secondary)]">% ao ano · último semestre</p>
              </div>
              <TrendLineChart
                labels={ATLANTICA_SELIC_SERIES.labels}
                series={ATLANTICA_SELIC_SERIES.series}
                unitSuffix="%"
              />
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold">Evolução Dólar PTAX</h3>
                <p className="text-[11px] text-[var(--text-secondary)]">R$ por USD · último semestre</p>
              </div>
              <TrendLineChart
                labels={ATLANTICA_CAMBIO_SERIES.labels}
                series={ATLANTICA_CAMBIO_SERIES.series}
                unitSuffix=""
              />
            </div>
          </div>

          {showMacroTranslator && (
            <div className="rounded-xl border border-[#20C5D5]/30 bg-[var(--bg-card)] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">
                    TRADUTOR PRÁTICO PARA A ATLÂNTICA MODA
                  </div>
                  <h3 className="text-base font-bold">O que cada indicador significa no caixa, no preço e no estoque</h3>
                </div>
                <span className="text-[11px] text-[var(--text-secondary)]">Linguagem simples para decisão diária</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                {ATLANTICA_MACRO.slice(0, 6).map((m) => (
                  <div key={m.code} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[var(--text-primary)]">{m.label}</span>
                      <span className="font-mono text-[#20C5D5] font-semibold">{m.value}</span>
                    </div>
                    <p className="text-[var(--text-secondary)]"><strong className="text-white">O que é:</strong> {m.plainExplanation}</p>
                    <p className="text-[var(--text-secondary)]"><strong className="text-[#F2B84B]">Efeito no negócio:</strong> {m.businessEffect}</p>
                    <p className="text-[#20B981]"><strong>Ação recomendada:</strong> {m.practicalTip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">ECONOMIA</div>
            {ATLANTICA_SIGNALS.filter((s) => s.category === 'Macroeconomia').map((s) => (
              <SignalCard
                key={s.code}
                code={s.code}
                kind={s.kind}
                impactLabel={s.impactLabel}
                category={s.category}
                metaRight={s.metaRight}
                title={s.title}
                summary={s.summary}
                sourceName={s.sourceName}
                sourceVerified={s.sourceVerified}
                publishedDate={s.lastChecked.split(' · ')[0]}
                lastChecked={s.lastChecked}
                relevance={s.relevance}
                potentialImpact={s.potentialImpact}
                recommendation={s.recommendation}
                traceSteps={mapTraceSteps(s.trace)}
              />
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">TRIBUTAÇÃO E LEGISLAÇÃO</div>
              <span className="text-[11px] text-[var(--text-secondary)]">Propostas e projetos não são obrigações vigentes</span>
            </div>
            {ATLANTICA_SIGNALS.filter((s) => s.category === 'Tributação' || s.category === 'Legislação').map((s) => (
              <SignalCard
                key={s.code}
                code={s.code}
                kind={s.kind}
                impactLabel={s.impactLabel}
                category={s.category}
                metaRight={s.metaRight}
                title={s.title}
                summary={s.summary}
                sourceName={s.sourceName}
                sourceVerified={s.sourceVerified}
                publishedDate={s.lastChecked.split(' · ')[0]}
                lastChecked={s.lastChecked}
                relevance={s.relevance}
                potentialImpact={s.potentialImpact}
                recommendation={s.recommendation}
                traceSteps={mapTraceSteps(s.trace)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* INFORMAÇÕES A VERIFICAR (PDF 2 p.9)                              */}
      {/* ================================================================ */}
      {section === 'verificar' && (
        <div className="space-y-5">
          <PageHeader
            kicker="DIAGNÓSTICO"
            title="Informações a verificar"
            description="Dados com confiabilidade parcial ou em discussão que exigem confirmação antes de virar decisão."
          />

          {verificationQueue.length === 0 ? (
            <div className="rounded-xl border border-[#20B981]/30 bg-[var(--bg-card)] p-6 text-center text-xs text-[#20B981]">
              Todas as informações pendentes foram auditadas nesta sessão.
            </div>
          ) : (
            verificationQueue.map((s) => (
              <SignalCard
                key={s.code}
                code={s.code}
                kind="pendente"
                impactLabel={`Situação: ${s.confidenceLabel ? `Pendente de confirmação (${s.confidenceLabel})` : 'Pendente de confirmação'}`}
                category={s.category}
                metaRight={s.metaRight}
                title={s.title}
                summary={s.summary}
                sourceName={s.sourceName}
                sourceVerified={s.sourceVerified}
                publishedDate={s.lastChecked.split(' · ')[0]}
                lastChecked={s.lastChecked}
                relevance={s.relevance}
                potentialImpact={s.potentialImpact}
                recommendation={s.recommendation}
                traceSteps={[
                  { label: 'Situação', code: 'Pendente de confirmação' },
                  { label: `Grau de confiança`, code: s.confidenceLabel || 'em verificação' },
                ]}
                footerActions={
                  <>
                    <button
                      type="button"
                      onClick={() => handleVerifySignal(s.code, 'discarded')}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[#EF6464] cursor-pointer"
                    >
                      × Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifySignal(s.code, 'confirmed')}
                      className="rounded-lg bg-[#20C5D5] px-3 py-1.5 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer"
                    >
                      ✓ Confirmar
                    </button>
                  </>
                }
              />
            ))
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* CONCORRENTES (PDF 2 p.10 + Dossiês Competitivos)                */}
      {/* ================================================================ */}
      {section === 'concorrentes' && (
        <div className="space-y-6">
          <PageHeader
            kicker="INTELIGÊNCIA DE MERCADO"
            title="Concorrentes"
            description="Quem disputa seus clientes, distância/atuação, pontos positivos e negativos, produtos e ameaças mapeadas."
          />

          <div className="rounded-xl border border-[#F2B84B]/30 bg-[#F2B84B]/10 px-4 py-2.5 text-xs text-[#F2B84B]">
            Aviso metodológico: preço anunciado publicamente não significa preço efetivamente praticado, e avaliações públicas representam amostra parcial do mercado.
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <KpiStatCard title="Monitorados" value={ATLANTICA_COMPETITORS.length} subtitle="Empresas acompanhadas" />
            <KpiStatCard
              title="Ameaça alta"
              value={ATLANTICA_COMPETITORS.filter((c) => c.threatLevel === 'Impacto alto').length}
              subtitle="Exige resposta rápida"
              tone="red"
            />
            <KpiStatCard
              title="Preço abaixo do nosso"
              value={ATLANTICA_COMPETITORS.filter((c) => c.priceVsUs === 'Abaixo').length}
              subtitle="Pressão em faixa média"
              tone="amber"
            />
            <KpiStatCard
              title="Movimentos no mês"
              value={ATLANTICA_SIGNALS.filter((s) => s.category === 'Concorrência').length}
              subtitle="Confirmados no Radar"
              tone="amber"
            />
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              MAPA COMPETITIVO
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)] bg-[var(--bg-card-secondary)]/40">
                  <tr>
                    <th className="px-5 py-3">Concorrente</th>
                    <th className="px-4 py-3">Preço vs. nós</th>
                    <th className="px-4 py-3">Canais</th>
                    <th className="px-4 py-3">Último movimento</th>
                    <th className="px-5 py-3 text-right">Nível de ameaça</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {ATLANTICA_COMPETITORS.map((c) => (
                    <tr key={c.name} className="hover:bg-[var(--bg-card-secondary)]/30">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[var(--text-primary)]">{c.name}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">{c.segment}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px]">
                          {c.priceVsUs}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-secondary)]">{c.channels}</td>
                      <td className="px-4 py-3.5">{c.lastMovement}</td>
                      <td className="px-5 py-3.5 text-right">
                        <StatusBadge
                          kind={c.threatTone === 'red' ? 'ameaca' : c.threatTone === 'amber' ? 'alerta' : 'oportunidade'}
                          customLabel={c.threatLevel}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                DOSSIÊS COMPETITIVOS DETALHADOS
              </div>
              <span className="text-[11px] text-[var(--text-secondary)]">Comparativo completo vs. Atlântica Moda</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {ATLANTICA_COMPETITORS.map((c) => (
                <div key={c.name} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">{c.name}</h3>
                        <span className="inline-flex items-center gap-1 rounded bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px] text-[#F2B84B]">
                          <Star className="h-3 w-3 fill-[#F2B84B] text-[#F2B84B]" />
                          {c.rating}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{c.locationDistance}</div>
                    </div>
                    <StatusBadge
                      kind={c.threatTone === 'red' ? 'ameaca' : c.threatTone === 'amber' ? 'alerta' : 'oportunidade'}
                      customLabel={c.threatLevel}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-lg border border-[#20B981]/30 bg-[#20B981]/10 p-3 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#20B981]">PONTOS POSITIVOS</div>
                      <p className="text-[var(--text-primary)]">{c.positivesNote}</p>
                    </div>
                    <div className="rounded-lg border border-[#EF6464]/30 bg-[#EF6464]/10 p-3 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#EF6464]">PONTOS NEGATIVOS / QUEIXAS</div>
                      <p className="text-[var(--text-primary)]">{c.complaints}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[var(--text-secondary)]">
                    <p><strong className="text-[var(--text-primary)]">Produtos e promoções:</strong> {c.productsPromotions}</p>
                    <p><strong className="text-[var(--text-primary)]">Diferenciais:</strong> {c.differentials}</p>
                    <p><strong className="text-[#20C5D5]">Ameaças e oportunidades vs. nós:</strong> {c.threatsOpportunities}</p>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span>Canais: {c.channels} · Consultado em {c.consultedAt}</span>
                    {c.sourceUrl && (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#20C5D5] hover:underline"
                      >
                        <span>Ver referência pública</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">MOVIMENTOS RECENTES</div>
              <span className="text-[11px] text-[var(--text-secondary)]">Do Radar de mercado</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {ATLANTICA_SIGNALS.filter((s) => s.category === 'Concorrência').map((s) => (
                <SignalCard
                  key={s.code}
                  code={s.code}
                  kind={s.kind}
                  impactLabel={s.impactLabel}
                  category={s.category}
                  metaRight={s.metaRight}
                  title={s.title}
                  summary={s.summary}
                  sourceName={s.sourceName}
                  sourceVerified={s.sourceVerified}
                  publishedDate={s.lastChecked.split(' · ')[0]}
                  lastChecked={s.lastChecked}
                  relevance={s.relevance}
                  potentialImpact={s.potentialImpact}
                  recommendation={s.recommendation}
                  traceSteps={mapTraceSteps(s.trace)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ANÁLISES ESTRATÉGICAS (PDF 2 p.1 + PESTEL/Porter/TOWS/Evidências)*/}
      {/* ================================================================ */}
      {section === 'analises' && (
        <div className="space-y-6">
          <PageHeader
            kicker="ESTRATÉGIA E EXECUÇÃO"
            title="Análises estratégicas"
            description="Leituras consolidadas a partir dos sinais do Radar."
            actions={
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { id: 'swot', label: 'SWOT / FOFA' },
                  { id: 'pestel', label: 'PESTEL' },
                  { id: 'porter', label: '5 Forças Porter' },
                  { id: 'tows', label: 'Matriz TOWS' },
                  { id: 'evidencias', label: 'Fichas de Evidência' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAnalysisFrameworkTab(tab.id as typeof analysisFrameworkTab)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      analysisFrameworkTab === tab.id
                        ? 'bg-[#20C5D5] text-[#06132D] font-semibold'
                        : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            }
          />

          {/* Top 4-box SWOT matching PDF 2 p.1 */}
          {analysisFrameworkTab === 'swot' && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">VISÃO SWOT</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                <div className="rounded-xl border-t-2 border-[#20C5D5] border-x border-b border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2">
                  <div className="font-bold text-sm">Forças</div>
                  <ul className="space-y-1 text-[var(--text-secondary)]">
                    {ATLANTICA_STRATEGIC.swot.strengths.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border-t-2 border-[#F2B84B] border-x border-b border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2">
                  <div className="font-bold text-sm">Fraquezas</div>
                  <ul className="space-y-1 text-[var(--text-secondary)]">
                    {ATLANTICA_STRATEGIC.swot.weaknesses.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border-t-2 border-[#20B981] border-x border-b border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2">
                  <div className="font-bold text-sm">Oportunidades</div>
                  <ul className="space-y-1 text-[var(--text-secondary)]">
                    {ATLANTICA_STRATEGIC.swot.opportunities.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border-t-2 border-[#EF6464] border-x border-b border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2">
                  <div className="font-bold text-sm">Ameaças</div>
                  <ul className="space-y-1 text-[var(--text-secondary)]">
                    {ATLANTICA_STRATEGIC.swot.threats.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {analysisFrameworkTab === 'pestel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {ATLANTICA_STRATEGIC.pestel.map((item) => (
                <div key={item.factor} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2">
                  <div className="text-[#20C5D5] font-semibold">Impacto: {item.impact}</div>
                  <h3 className="text-sm font-bold">{item.factor}</h3>
                  <p className="text-[var(--text-secondary)]">{item.summary}</p>
                </div>
              ))}
            </div>
          )}

          {analysisFrameworkTab === 'porter' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {ATLANTICA_STRATEGIC.porter.map((item) => (
                <div key={item.force} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">{item.force}</h3>
                    <span className="font-semibold text-[#20C5D5]">{item.level}</span>
                  </div>
                  <p className="text-[var(--text-secondary)]">{item.note}</p>
                </div>
              ))}
            </div>
          )}

          {analysisFrameworkTab === 'tows' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {ATLANTICA_STRATEGIC.tows.map((t) => (
                <div key={t.quadrant} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2">
                  <h3 className="text-sm font-bold text-[#20C5D5]">{t.quadrant}</h3>
                  <p className="text-[var(--text-secondary)]">{t.action}</p>
                </div>
              ))}
            </div>
          )}

          {analysisFrameworkTab === 'evidencias' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {ATLANTICA_EVIDENCE_CARDS.map((ev) => (
                <div key={ev.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2">
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>{ev.module} · {ev.date}</span>
                    <span className="font-mono font-bold text-[#20C5D5]">Qualidade: {ev.quality}/100</span>
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{ev.title}</h3>
                  <p className="text-[var(--text-secondary)]"><strong className="text-white">Achado externo:</strong> {ev.externalFinding}</p>
                  <p className="text-[var(--text-secondary)]"><strong className="text-white">Dado interno:</strong> {ev.internalDataUsed}</p>
                  <p className="text-[var(--text-secondary)]"><strong className="text-white">Fonte / Método:</strong> {ev.source} · {ev.method}</p>
                  <p className="text-[var(--text-secondary)]"><strong className="text-[#F2B84B]">Limitações:</strong> {ev.limitations}</p>
                </div>
              ))}
            </div>
          )}

          {/* Análises em curso matching PDF 2 p.1 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[var(--text-secondary)]">ANÁLISES EM CURSO</span>
              <span className="text-[var(--text-secondary)]">{ATLANTICA_ANALYSES.length} análises cruzadas</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {ATLANTICA_ANALYSES.map((a) => (
                <div key={a.code} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[var(--text-secondary)]">{a.code}</span>
                      <StatusBadge
                        kind={
                          a.classification === 'oportunidade'
                            ? 'oportunidade'
                            : a.classification === 'ameaca'
                            ? 'ameaca'
                            : 'alerta'
                        }
                        customLabel={
                          a.classification === 'oportunidade'
                            ? 'Oportunidade'
                            : a.classification === 'ameaca'
                            ? 'Ameaça'
                            : 'Atenção'
                        }
                      />
                      <span className="rounded bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px] text-[#20C5D5]">{a.tag}</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)]">{a.updatedAt}</span>
                  </div>
                  <h3 className="text-base font-bold">{a.title}</h3>
                  <p className="text-[var(--text-secondary)] border-l-2 border-[#20C5D5]/50 pl-3">{a.summary}</p>

                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-3 space-y-1.5">
                    <div><strong className="text-white">Problema / Desafio:</strong> <span className="text-[var(--text-secondary)]">{a.problem}</span></div>
                    <div><strong className="text-white">Evidências cruzadas:</strong> <span className="text-[var(--text-secondary)]">{a.evidenceSummary}</span></div>
                    <div><strong className="text-white">Fontes de dados:</strong> <span className="font-mono text-[11px] text-[#20C5D5]">{a.dataSourcesUsed}</span></div>
                    <div><strong className="text-white">Impacto potencial:</strong> <span className="text-[var(--text-primary)]">{a.potentialImpact}</span></div>
                    <div><strong className="text-[#20B981]">Recomendação estratégica:</strong> <span className="text-[var(--text-primary)]">{a.strategicRecommendation}</span></div>
                    <div><strong className="text-[var(--text-secondary)]">Justificativa:</strong> <span className="text-[var(--text-secondary)]">{a.justification}</span></div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">SINAIS DE ORIGEM</div>
                    {a.originSignals.map((os) => (
                      <div key={os.text} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 px-3 py-2 flex items-center gap-2">
                        <StatusBadge kind={os.kind} />
                        <span className="truncate">{os.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    <TraceabilityBar steps={mapTraceSteps(a.trace)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* CENTRAL DE DECISÕES (PDF 2 p.11)                                 */}
      {/* ================================================================ */}
      {section === 'decisoes' && (
        <div className="space-y-5">
          <PageHeader
            kicker="ESTRATÉGIA E EXECUÇÃO"
            title="Central de decisões"
            description="Aprove para gerar tarefas nos Planos de ação, adie para reavaliar ou descarte caso não faça sentido agora."
          />

          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: 'pendente', label: `Pendentes (${decisions.filter((d) => d.status === 'pendente').length})` },
              { id: 'aprovada', label: `Aprovadas (${decisions.filter((d) => d.status === 'aprovada').length})` },
              { id: 'adiada', label: `Adiadas (${decisions.filter((d) => d.status === 'adiada').length})` },
              { id: 'descartada', label: `Descartadas (${decisions.filter((d) => d.status === 'descartada').length})` },
              { id: 'todas', label: `Todas (${decisions.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDecisionFilter(tab.id as typeof decisionFilter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  decisionFilter === tab.id
                    ? 'bg-[#20C5D5] text-[#06132D] font-semibold'
                    : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {decisions
              .filter((d) => decisionFilter === 'todas' || d.status === decisionFilter)
              .map((d) => (
                <div key={d.code} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[var(--text-secondary)]">{d.code}</span>
                      <StatusBadge
                        kind={
                          d.status === 'pendente'
                            ? 'pendente'
                            : d.status === 'aprovada'
                            ? 'aprovada'
                            : d.status === 'descartada'
                            ? 'recusada'
                            : 'alerta'
                        }
                        customLabel={
                          d.status === 'adiada'
                            ? 'Adiada'
                            : d.status === 'descartada'
                            ? 'Descartada'
                            : undefined
                        }
                      />
                      <span className="rounded bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px] text-[#EF6464]">{d.priority}</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)]">{d.due}</span>
                  </div>

                  <h3 className="text-base font-bold">{d.title}</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">PROBLEMA</div>
                      <div className="mt-1">{d.problem}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">EVIDÊNCIA</div>
                      <div className="mt-1 text-[var(--text-secondary)]">{d.evidence}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">AÇÃO SUGERIDA</div>
                      <div className="mt-1">{d.suggestedAction}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">JUSTIFICATIVA: </span>
                      <span className="text-[var(--text-primary)]">{d.justification}</span>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">INDICADORES PARA ACOMPANHAR: </span>
                      <span className="text-[#20C5D5]">{d.kpisToTrack}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/60 px-3 py-2 text-[#20B981]">
                    Resultado esperado: <strong className="text-[var(--text-primary)]">{d.expectedOutcome}</strong>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                    <TraceabilityBar steps={mapTraceSteps(d.trace)} />
                    <div className="flex flex-wrap items-center gap-2">
                      {d.status !== 'descartada' && (
                        <button
                          type="button"
                          onClick={() => handleDecisionAction(d.code, 'descartada')}
                          className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[#EF6464] hover:border-[#EF6464]/40 cursor-pointer"
                        >
                          Descartar
                        </button>
                      )}
                      {d.status !== 'adiada' && (
                        <button
                          type="button"
                          onClick={() => handleDecisionAction(d.code, 'adiada')}
                          className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer"
                        >
                          Adiar
                        </button>
                      )}
                      {d.status !== 'aprovada' && (
                        <button
                          type="button"
                          onClick={() => handleDecisionAction(d.code, 'aprovada')}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#F2B84B] px-3 py-1.5 text-xs font-semibold text-[#06132D] hover:bg-[#f7c86d] cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Aprovar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* PLANOS DE AÇÃO (PDF 2 p.12 + 4 estados + % conclusão + Resumo)   */}
      {/* ================================================================ */}
      {section === 'planos-acao' && (
        <div className="space-y-6">
          <PageHeader
            kicker="ESTRATÉGIA E EXECUÇÃO"
            title="Planos de ação"
            description="Tarefas estruturadas a partir das decisões aprovadas com responsáveis, prazos, recursos, KPIs e progresso."
            actions={
              <button
                type="button"
                onClick={() => setShowPlanReview((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#20C5D5]/40 bg-[#20C5D5]/10 px-3 py-1.5 text-xs font-medium text-[#20C5D5] hover:bg-[#20C5D5]/20 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Acompanhar Progresso (Resumo IA Demo)</span>
              </button>
            }
          />

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <KpiStatCard title="Total de ações" value={actions.length} subtitle="Vinculadas a decisões" />
            <KpiStatCard title="A fazer" value={actions.filter((a) => a.status === 'a_fazer').length} subtitle="Prontas para iniciar" />
            <KpiStatCard title="Em andamento" value={actions.filter((a) => a.status === 'em_andamento').length} subtitle="Em execução" tone="amber" />
            <KpiStatCard title="Concluídas" value={actions.filter((a) => a.status === 'concluida').length} subtitle="Entregues" tone="green" />
            <KpiStatCard
              title="Aguardando decisão"
              value={pendingDecisionsCount}
              subtitle="Abrir central →"
              tone="cyan"
              onClick={() => setPlanFilter('aguardando_decisao')}
            />
          </div>

          {showPlanReview && (
            <div className="rounded-xl border border-[#20C5D5]/40 bg-[var(--bg-card)] p-5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#20C5D5]">Acompanhamento de Execução — Atlântica Moda (Demo)</span>
                <button type="button" onClick={() => setShowPlanReview(false)} className="text-[var(--text-secondary)] hover:text-white cursor-pointer">Fechar</button>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                O plano da decisão <strong className="text-white">D-05 (Ativar vendas pelo Instagram)</strong> apresenta{' '}
                <strong className="text-[#20C5D5]">
                  {Math.round(actions.reduce((acc, item) => acc + item.completionPct, 0) / Math.max(1, actions.length))}%
                </strong>{' '}
                de progresso médio consolidado ({actions.filter((a) => a.status === 'concluida').length} concluída,{' '}
                {actions.filter((a) => a.status === 'em_andamento').length} em andamento e{' '}
                {actions.filter((a) => a.status === 'a_fazer').length} a fazer). Existem{' '}
                <strong className="text-[#F2B84B]">{pendingDecisionsCount} decisões pendentes</strong> prontas para gerar novos planos ao aprovar.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: 'todos', label: `Todos (${actions.length})` },
              { id: 'a_fazer', label: `A fazer (${actions.filter((a) => a.status === 'a_fazer').length})` },
              { id: 'em_andamento', label: `Em andamento (${actions.filter((a) => a.status === 'em_andamento').length})` },
              { id: 'concluida', label: `Concluídas (${actions.filter((a) => a.status === 'concluida').length})` },
              { id: 'aguardando_decisao', label: `Aguardando decisão (${pendingDecisionsCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPlanFilter(tab.id as typeof planFilter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  planFilter === tab.id
                    ? 'bg-[#20C5D5] text-[#06132D] font-semibold'
                    : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {planFilter === 'aguardando_decisao' ? (
            <div className="space-y-3">
              {decisions
                .filter((d) => d.status === 'pendente')
                .map((d) => (
                  <div key={d.code} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#20C5D5]">{d.code}</span>
                        <StatusBadge kind="pendente" customLabel="Aguardando decisão" />
                        <span className="text-[var(--text-secondary)]">{d.due}</span>
                      </div>
                      <h3 className="text-sm font-bold">{d.title}</h3>
                      <p className="text-[var(--text-secondary)]">Ação sugerida: {d.suggestedAction}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleDecisionAction(d.code, 'aprovada');
                        setPlanFilter('todos');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Aprovar e gerar tarefas →</span>
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            Array.from(new Set(actions.map((a) => a.decisionCode))).map((decCode) => {
              const allForDecision = actions.filter((a) => a.decisionCode === decCode);
              const group = allForDecision.filter((a) => planFilter === 'todos' || a.status === planFilter);
              if (group.length === 0) return null;
              const avgPct = Math.round(
                allForDecision.reduce((sum, item) => sum + item.completionPct, 0) / allForDecision.length
              );
              return (
                <div key={decCode} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-mono text-[var(--text-secondary)]">{decCode}</div>
                      <h3 className="text-base font-bold">{allForDecision[0].decisionTitle}</h3>
                    </div>
                    <div className="flex items-center gap-3 w-48">
                      <div className="flex-1 h-2 rounded-full bg-[var(--bg-card-secondary)] overflow-hidden">
                        <div className="h-full bg-[#20C5D5] transition-all" style={{ width: `${avgPct}%` }} />
                      </div>
                      <span className="font-mono text-xs font-semibold">{avgPct}%</span>
                    </div>
                  </div>
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {group.map((act) => (
                      <div key={act.code} className="py-3.5 space-y-2.5 text-xs">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <CheckCircle2
                              className={`h-4 w-4 shrink-0 mt-0.5 ${
                                act.status === 'concluida'
                                  ? 'text-[#20B981]'
                                  : act.status === 'em_andamento'
                                  ? 'text-[#20C5D5]'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-[var(--text-primary)]">{act.title}</span>
                                <span className="rounded bg-[var(--bg-card-secondary)] px-1.5 py-0.5 text-[10px] text-[#F2B84B]">
                                  Prioridade {act.priority}
                                </span>
                              </div>
                              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                {act.code} · {act.owner} · {act.due}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] p-0.5">
                              {([
                                { id: 'a_fazer', label: 'A fazer', pct: 0 },
                                { id: 'em_andamento', label: 'Em andamento', pct: 50 },
                                { id: 'concluida', label: 'Concluído', pct: 100 },
                              ] as const).map((st) => (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => {
                                    setActions((prev) =>
                                      prev.map((x) =>
                                        x.code === act.code
                                          ? {
                                              ...x,
                                              status: st.id,
                                              completionPct: st.id === 'concluida' ? 100 : st.id === 'a_fazer' ? 0 : Math.max(25, x.completionPct === 100 ? 50 : x.completionPct),
                                            }
                                          : x
                                      )
                                    );
                                    logSession(`Ação ${act.code} alterada para ${st.label}.`);
                                  }}
                                  className={`px-2 py-1 rounded text-[11px] cursor-pointer ${
                                    act.status === st.id
                                      ? 'bg-[#20C5D5] text-[#06132D] font-semibold'
                                      : 'text-[var(--text-secondary)] hover:text-white'
                                  }`}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>
                            <StatusBadge
                              kind={act.status === 'a_fazer' ? 'pendente' : act.status}
                              customLabel={act.status === 'a_fazer' ? 'A fazer' : undefined}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-6 text-[11px]">
                          <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 px-2.5 py-1.5">
                            <strong className="text-[var(--text-secondary)]">Recursos necessários: </strong>
                            <span className="text-[var(--text-primary)]">{act.resources}</span>
                          </div>
                          <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 px-2.5 py-1.5">
                            <strong className="text-[var(--text-secondary)]">Indicador de desempenho: </strong>
                            <span className="text-[#20C5D5]">{act.kpi}</span>
                          </div>
                        </div>

                        <div className="pl-6 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-[var(--text-secondary)]">Conclusão:</span>
                            {[0, 25, 50, 75, 100].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => {
                                  const nextStatus: DemoActionItem['status'] =
                                    val === 100 ? 'concluida' : val === 0 ? 'a_fazer' : 'em_andamento';
                                  setActions((prev) =>
                                    prev.map((x) =>
                                      x.code === act.code ? { ...x, completionPct: val, status: nextStatus } : x
                                    )
                                  );
                                  logSession(`Progresso da ação ${act.code} atualizado para ${val}%.`);
                                }}
                                className={`px-1.5 py-0.5 rounded font-mono cursor-pointer ${
                                  act.completionPct === val
                                    ? 'bg-[#15365F] text-[#20C5D5] border border-[#20C5D5]/40 font-bold'
                                    : 'bg-[var(--bg-card-secondary)] text-[var(--text-secondary)] hover:text-white'
                                }`}
                              >
                                {val}%
                              </button>
                            ))}
                          </div>
                          <TraceabilityBar steps={mapTraceSteps(act.trace)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* OPORTUNIDADES (PDF 1 p.3)                                        */}
      {/* ================================================================ */}
      {section === 'oportunidades' && (
        <div className="space-y-5">
          <PageHeader
            kicker="ESTRATÉGIA E DECISÃO"
            title="Oportunidades identificadas"
            description="Sinais de mercado com potencial positivo mapeado para a Atlântica Moda."
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <KpiStatCard title="Oportunidades ativas" value={ATLANTICA_SIGNALS.filter((s) => s.kind === 'oportunidade').length} subtitle="Mapeadas no Radar" tone="green" />
            <KpiStatCard
              title="Impacto alto"
              value={ATLANTICA_SIGNALS.filter((s) => s.kind === 'oportunidade' && s.impactLabel === 'Impacto alto').length}
              subtitle="Prioridade imediata"
              tone="cyan"
            />
            <KpiStatCard title="Potencial estimado" value="R$ 60 mil+" subtitle="Em receita adicional sazonal" tone="green" />
          </div>
          {ATLANTICA_SIGNALS.filter((s) => s.kind === 'oportunidade').map((s) => (
            <SignalCard
              key={s.code}
              code={s.code}
              kind={s.kind}
              impactLabel={s.impactLabel}
              category={s.category}
              metaRight={s.metaRight}
              title={s.title}
              summary={s.summary}
              sourceName={s.sourceName}
              sourceVerified={s.sourceVerified}
              lastChecked={s.lastChecked}
              relevance={s.relevance}
              potentialImpact={s.potentialImpact}
              recommendation={s.recommendation}
              traceSteps={mapTraceSteps(s.trace)}
            />
          ))}
        </div>
      )}

      {/* ================================================================ */}
      {/* SIMULADOR DE CENÁRIOS                                            */}
      {/* ================================================================ */}
      {section === 'simulador' && (
        <div className="space-y-6">
          <PageHeader
            kicker="ESTRATÉGIA E DECISÃO"
            title="Simulador de cenários"
            description="Compare 4 cenários (Atual, Pessimista, Realista, Otimista), ponto de equilíbrio, margem de contribuição e decisões operacionais."
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs">
              <div className="flex flex-wrap gap-2">
                {(['pessimista', 'realista', 'otimista'] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setSimScenario(sc)}
                    className={`px-3 py-1.5 rounded-lg capitalize font-semibold cursor-pointer ${
                      simScenario === sc ? 'bg-[#20C5D5] text-[#06132D]' : 'bg-[var(--bg-card-secondary)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {sc}
                  </button>
                ))}
                <div className="ml-auto flex gap-1">
                  {([30, 90, 180] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setSimHorizon(h)}
                      className={`px-2.5 py-1.5 rounded-lg font-mono cursor-pointer ${
                        simHorizon === h ? 'bg-[#F4F8FF] text-[#06132D] font-bold' : 'bg-[var(--bg-card-secondary)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {h}d
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="flex justify-between mb-1"><span>Inflação (IPCA):</span><span className="font-mono text-[#20C5D5]">{simInflacao}%</span></div>
                  <input type="range" min={2} max={12} step={0.5} value={simInflacao} onChange={(e) => setSimInflacao(Number(e.target.value))} className="w-full accent-[#20C5D5]" />
                </label>
                <label className="block">
                  <div className="flex justify-between mb-1"><span>Taxa Selic:</span><span className="font-mono text-[#20C5D5]">{simSelic}%</span></div>
                  <input type="range" min={8} max={16} step={0.25} value={simSelic} onChange={(e) => setSimSelic(Number(e.target.value))} className="w-full accent-[#20C5D5]" />
                </label>
                <label className="block">
                  <div className="flex justify-between mb-1"><span>Câmbio USD/BRL:</span><span className="font-mono text-[#20C5D5]">R$ {simCambio.toFixed(2)}</span></div>
                  <input type="range" min={4.5} max={7.0} step={0.05} value={simCambio} onChange={(e) => setSimCambio(Number(e.target.value))} className="w-full accent-[#20C5D5]" />
                </label>
                <label className="block">
                  <div className="flex justify-between mb-1"><span>ICMS estadual (SC):</span><span className="font-mono text-[#20C5D5]">{simIcms}%</span></div>
                  <input type="range" min={7} max={25} step={0.5} value={simIcms} onChange={(e) => setSimIcms(Number(e.target.value))} className="w-full accent-[#20C5D5]" />
                </label>
              </div>

              <label className="block">
                <div className="flex justify-between mb-1"><span>Variação média de vendas esperada:</span><span className="font-mono text-[#20C5D5]">{simCrescimento > 0 ? `+${simCrescimento}%` : `${simCrescimento}%`}</span></div>
                <input type="range" min={-25} max={35} step={1} value={simCrescimento} onChange={(e) => setSimCrescimento(Number(e.target.value))} className="w-full accent-[#20C5D5]" />
              </label>
              <label className="block">
                <div className="flex justify-between mb-1"><span>Aumento de produção/compras planejado:</span><span className="font-mono text-[#20C5D5]">+{simProductionDelta}%</span></div>
                <input type="range" min={0} max={50} step={1} value={simProductionDelta} onChange={(e) => setSimProductionDelta(Number(e.target.value))} className="w-full accent-[#20C5D5]" />
              </label>

              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  PARÂMETROS OPERACIONAIS E DE CUSTO
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <label className="block">
                    <span className="block text-[var(--text-secondary)] mb-1">Qtd. produzida/mês</span>
                    <input type="number" min={1} value={simProducedUnits} onChange={(e) => setSimProducedUnits(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-secondary)] mb-1">Demanda est./mês</span>
                    <input type="number" min={1} value={simDemandUnits} onChange={(e) => setSimDemandUnits(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-secondary)] mb-1">Preço médio venda (R$)</span>
                    <input type="number" min={1} value={simUnitPrice} onChange={(e) => setSimUnitPrice(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-secondary)] mb-1">Custos fixos/mês (R$)</span>
                    <input type="number" min={0} step={500} value={simFixedCosts} onChange={(e) => setSimFixedCosts(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-secondary)] mb-1">Custo variável/un. (R$)</span>
                    <input type="number" min={0} value={simVariableCost} onChange={(e) => setSimVariableCost(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-secondary)] mb-1">Funcionários extras</span>
                    <input type="number" min={0} max={20} value={simExtraEmployees} onChange={(e) => setSimExtraEmployees(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-secondary)] mb-1">Custo/funcionário (R$)</span>
                    <input type="number" min={0} step={100} value={simEmployeeCost} onChange={(e) => setSimEmployeeCost(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-secondary)] mb-1">Custo marginal/un. (R$)</span>
                    <input type="number" min={1} value={simMarginalCost} onChange={(e) => setSimMarginalCost(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-secondary)] mb-1">Un. extras / Meta lucro</span>
                    <div className="grid grid-cols-2 gap-1">
                      <input type="number" min={1} value={simMarginalUnits} onChange={(e) => setSimMarginalUnits(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2 py-1.5 font-mono" title="Produto marginal (un. extras)" />
                      <input type="number" min={1000} step={5000} value={simTargetProfit} onChange={(e) => setSimTargetProfit(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2 py-1.5 font-mono" title="Meta de lucro (R$)" />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold">Resultado em Linguagem Simples ({simHorizon}d · {simScenario})</h3>
                <span className={`rounded-md px-2.5 py-1 font-bold ${
                  simProjection.successChancePct >= 65
                    ? 'bg-[#20B981]/20 text-[#20B981]'
                    : simProjection.successChancePct >= 40
                    ? 'bg-[#F2B84B]/20 text-[#F2B84B]'
                    : 'bg-[#EF6464]/20 text-[#EF6464]'
                }`}>
                  Chance de êxito: {simProjection.successChancePct}%
                </span>
              </div>

              <div className={`rounded-lg border p-3.5 ${
                simProjection.worthIncreasingProduction
                  ? 'border-[#20B981]/40 bg-[#20B981]/10'
                  : 'border-[#EF6464]/40 bg-[#EF6464]/10'
              }`}>
                <div className="font-bold text-sm">
                  Vale a pena aumentar a produção?{' '}
                  {simProjection.worthIncreasingProduction ? 'SIM — COMPENSA EXPANDIR' : 'CAUTELA — NÃO COMPENSA AGORA'}
                </div>
                <p className="text-[var(--text-secondary)] mt-1">
                  Cada peça extra vendida pelo ticket médio (R$ {simUnitPrice}) deixa{' '}
                  <strong className="text-white">R$ {simProjection.marginalGainPerUnit.toFixed(2)}</strong> de ganho líquido após o ICMS ({simIcms}%) e o custo marginal (R$ {simMarginalCost}).
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <KpiStatCard title="Vendas Projetadas" value={`R$ ${simProjection.sales.toLocaleString('pt-BR')}`} subtitle="Receita estimada" />
                <KpiStatCard title="Margem Estimada" value={`${simProjection.marginPct}%`} subtitle="Após efeitos macro/ICMS" tone="cyan" />
                <KpiStatCard title="Lucro Bruto Est." value={`R$ ${simProjection.profit.toLocaleString('pt-BR')}`} subtitle={`Meta: R$ ${simTargetProfit.toLocaleString('pt-BR')}`} tone="green" />
                <KpiStatCard title="Margem Contrib. / un." value={`R$ ${simProjection.contributionMarginPerUnit.toFixed(2)}`} subtitle={`Preço R$ ${simUnitPrice} - ICMS - var.`} tone="cyan" />
                <KpiStatCard title="Ponto de Equilíbrio" value={`${simProjection.breakEvenUnitsMonth} un./mês`} subtitle={`Fixo R$ ${simProjection.totalFixedMonthly.toLocaleString('pt-BR')}`} tone="amber" />
                <KpiStatCard title="Contratação" value={simProjection.worthHiring ? 'Viável' : 'Aguardar'} subtitle={`${simExtraEmployees} extra(s)`} tone={simProjection.worthHiring ? 'green' : 'amber'} />
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3 space-y-1.5">
                <div className="font-semibold text-[#20C5D5]">Sugestões práticas para atingir sua meta:</div>
                <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                  <li>Foque o aumento de {simProductionDelta}% nos itens de maior margem (linho e camisaria) antes de comprar itens com custo pressionado pelo dólar.</li>
                  <li>Com Selic em {simSelic}%, incentive pagamento à vista/Pix para evitar que juros de antecipação corroam a margem extra.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-[#F2B84B]/30 bg-[#F2B84B]/10 p-3 text-[#F2B84B]">
                Faixa de incerteza: ±15% a ±25%. Base demonstrativa Atlântica Moda.
              </div>
            </div>
          </div>

          {/* 4-Scenario Comparison Table + Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden text-xs">
              <div className="px-5 py-3 border-b border-[var(--border-subtle)] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                COMPARAÇÃO DOS 4 CENÁRIOS ({simHorizon} DIAS)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-4 py-2.5">Cenário</th>
                      <th className="px-3 py-2.5 text-right">Volume</th>
                      <th className="px-3 py-2.5 text-right">Receita</th>
                      <th className="px-3 py-2.5 text-right">Lucro est.</th>
                      <th className="px-4 py-2.5 text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {simProjection.fourScenarios.map((row) => (
                      <tr key={row.key} className="hover:bg-[var(--bg-card-secondary)]/30">
                        <td className="px-4 py-3 font-semibold">{row.label}</td>
                        <td className="px-3 py-3 text-right font-mono">{row.units} un.</td>
                        <td className="px-3 py-3 text-right font-mono">R$ {row.revenue.toLocaleString('pt-BR')}</td>
                        <td className={`px-3 py-3 text-right font-mono font-bold ${row.viable ? 'text-[#20B981]' : 'text-[#EF6464]'}`}>
                          R$ {row.netProfit.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{row.marginPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                RECEITA × LUCRO POR CENÁRIO (R$ MIL)
              </div>
              <SimpleBarChart
                data={simProjection.fourScenarios.map((s) => ({
                  label: s.label.replace('Cenário ', ''),
                  value: Math.round(s.revenue / 1000),
                  secondaryValue: Math.max(0, Math.round(s.netProfit / 1000)),
                }))}
                primaryLabel="Receita (R$ mil)"
                secondaryLabel="Lucro est. (R$ mil)"
                unitSuffix="k"
                height={180}
              />
            </div>
          </div>

          {/* 6 Plain-Portuguese Entrepreneur Questions */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#20C5D5]">
              6 PERGUNTAS RESPONDIDAS EM LINGUAGEM SIMPLES
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-3.5 space-y-1">
                <div className="font-bold">1. Quanto a Atlântica Moda precisa vender para não ter prejuízo?</div>
                <p className="text-[var(--text-secondary)]">
                  Pelo menos <strong className="text-white">{simProjection.breakEvenUnitsMonth} peças/mês</strong> (cerca de R$ {(simProjection.breakEvenUnitsMonth * simUnitPrice).toLocaleString('pt-BR')}/mês) para cobrir custos fixos de R$ {simProjection.totalFixedMonthly.toLocaleString('pt-BR')}.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-3.5 space-y-1">
                <div className="font-bold">2. Quanto sobra de cada peça vendida?</div>
                <p className="text-[var(--text-secondary)]">
                  Cada venda de R$ {simUnitPrice} paga impostos ({simIcms}%) e custo variável (R$ {simVariableCost}), deixando <strong className="text-[#20C5D5]">R$ {simProjection.contributionMarginPerUnit.toFixed(2)}</strong> de margem de contribuição.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-3.5 space-y-1">
                <div className="font-bold">3. Vale a pena aumentar a produção agora?</div>
                <p className="text-[var(--text-secondary)]">
                  {simProjection.worthIncreasingProduction
                    ? `Sim: com ganho líquido de R$ ${simProjection.marginalGainPerUnit.toFixed(2)}/peça e demanda estimada de ${simDemandUnits} un./mês, expandir em +${simProductionDelta}% amplia o lucro.`
                    : 'Momento pede cautela: revise o custo marginal ou reduza o preço de compra antes de elevar volume.'}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-3.5 space-y-1">
                <div className="font-bold">4. Compensa contratar mais gente?</div>
                <p className="text-[var(--text-secondary)]">
                  {simProjection.worthHiring
                    ? 'A demanda supera a capacidade atual em volume suficiente para pagar o custo adicional da equipe.'
                    : 'Ainda não compensa: o volume de demanda extra não cobre o custo mensal adicional de contratação.'}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-3.5 space-y-1">
                <div className="font-bold">5. Se os custos subirem, o lucro aguenta?</div>
                <p className="text-[var(--text-secondary)]">
                  No cenário pessimista (queda de 15% na demanda e +7% nos custos), o lucro projetado é de{' '}
                  <strong className={simProjection.fourScenarios[1].viable ? 'text-[#20B981]' : 'text-[#EF6464]'}>
                    R$ {simProjection.fourScenarios[1].netProfit.toLocaleString('pt-BR')}
                  </strong>.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-3.5 space-y-1">
                <div className="font-bold">6. Qual a principal recomendação prática?</div>
                <p className="text-[var(--text-secondary)]">
                  Priorize peças em linho (margem &gt;57%), reduza o frete grátis para R$ 249 (D-01) e acelere o giro à vista via Pix enquanto a Selic segue em {simSelic}%.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ASSISTENTE DE INTELIGÊNCIA FULL-PAGE (PDF 2 p.13)                */}
      {/* ================================================================ */}
      {section === 'assistente' && (
        <div className="space-y-5">
          <PageHeader
            kicker="ESTRATÉGIA E DECISÃO"
            title="Assistente de inteligência"
            description="Pergunte sobre documentos e ambiente externo."
          />

          <div className="rounded-xl border border-[#F2B84B]/30 bg-[#F2B84B]/10 px-4 py-2.5 text-xs text-[#F2B84B]">
            Respostas montadas a partir dos dados demonstrativos da Atlântica Moda, sempre com fonte citada. Para consultas livres com Gemini AI sobre os dados reais da sua empresa, utilize a versão Beta.
          </div>

          <div className="flex flex-wrap gap-2">
            {ATLANTICA_ASSISTANT_SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askDemoAssistant(q)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:border-[#20C5D5] transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              askDemoAssistant(aiInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Faça uma pergunta"
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4F8FF] px-5 py-3 text-xs font-semibold text-[#06132D] hover:bg-white cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Perguntar</span>
            </button>
          </form>

          {aiMessages.length > 0 && (
            <div className="space-y-3">
              {aiMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'border-[#20C5D5]/40 bg-[#15365F]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
                  }`}
                >
                  <div className="font-semibold text-[11px] uppercase tracking-wider text-[#20C5D5] mb-1">
                    {m.role === 'user' ? 'Você' : 'Gêmeo Digital (Demonstração)'}
                  </div>
                  <p>{m.text}</p>
                  {m.source && (
                    <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                      Fontes: <span className="font-mono text-[#20C5D5]">{m.source}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* RELATÓRIOS (PDF 2 p.14 + 8 seções consolidadas + PDF/Excel)      */}
      {/* ================================================================ */}
      {section === 'relatorios' && (
        <div className="space-y-6">
          <PageHeader
            kicker="DESEMPENHO"
            title="Relatórios"
            description="Relatório executivo completo em 8 seções prontas para reunião, impressão em PDF ou exportação Excel."
            actions={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs hover:border-[#20C5D5] cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-[#20C5D5]" />
                  <span>Imprimir resumo (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-3 py-1.5 text-xs font-semibold text-[#06132D] cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Exportar Excel</span>
                </button>
              </div>
            }
          />

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#20C5D5]">RESUMO EXECUTIVO CONSOLIDADO (8 SEÇÕES)</div>
                <h2 className="text-xl font-bold mt-0.5">{ATLANTICA_BRAND.name}</h2>
                <div className="text-xs text-[var(--text-secondary)]">Semana 46 · nov/2026 · {ATLANTICA_BRAND.city}/{ATLANTICA_BRAND.state}</div>
              </div>
              <StatusBadge kind="alerta" customLabel="Dados demonstrativos" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-3 border-t border-[var(--border-subtle)]">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">1. DIAGNÓSTICO DA EMPRESA</div>
                <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                  <li>{ATLANTICA_BRAND.legalName} ({ATLANTICA_BRAND.segment}).</li>
                  <li>Faturamento semanal R$ 318 mil (+4,2%), ticket médio R$ 236, margem bruta 52% e NPS 41.</li>
                  <li>{documents.length} documentos internos ({interpretedDocsCount} interpretados) e {ATLANTICA_PRODUCTS.filter((p) => p.status === 'Estoque crítico').length} SKUs em estoque crítico.</li>
                </ul>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">2. SITUAÇÃO DO MERCADO</div>
                <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                  <li>{ATLANTICA_SIGNALS.length} sinais mapeados ({ATLANTICA_SIGNALS.filter((s) => s.kind === 'oportunidade').length} oportunidades, {ATLANTICA_SIGNALS.filter((s) => s.kind === 'ameaca').length} ameaças, {verificationQueue.length} a verificar).</li>
                  <li>Buscas regionais por "vestido de linho" subiram +38% e vendas pelo Instagram alcançam 18% do setor.</li>
                  <li>Fornecedores sinalizam +12% no algodão a partir de dezembro.</li>
                </ul>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">3. ANÁLISE DOS CONCORRENTES</div>
                <ul className="space-y-1 text-[var(--text-secondary)]">
                  {ATLANTICA_COMPETITORS.map((c) => (
                    <li key={c.name} className="flex justify-between gap-2 border-b border-[var(--border-subtle)]/50 pb-1 last:border-0">
                      <span><strong className="text-[var(--text-primary)]">{c.name}</strong> — {c.lastMovement}</span>
                      <span className="font-mono text-[11px] text-[#F2B84B] shrink-0">{c.threatLevel}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">4. INDICADORES MACROECONÔMICOS</div>
                <div className="grid grid-cols-2 gap-2">
                  {ATLANTICA_MACRO.slice(0, 6).map((m) => (
                    <div key={m.code} className="flex justify-between border-b border-[var(--border-subtle)]/50 pb-1">
                      <span className="text-[var(--text-secondary)]">{m.label}</span>
                      <strong className="font-mono text-[var(--text-primary)]">{m.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">5. PRINCIPAIS AMEAÇAS E OPORTUNIDADES</div>
                <ul className="space-y-1 text-[var(--text-secondary)]">
                  {ATLANTICA_ANALYSES.map((a) => (
                    <li key={a.code}>
                      <span className={a.classification === 'oportunidade' ? 'text-[#20B981]' : a.classification === 'ameaca' ? 'text-[#EF6464]' : 'text-[#F2B84B]'}>
                        ●
                      </span>{' '}
                      <strong className="text-[var(--text-primary)]">{a.code} {a.title}:</strong> {a.potentialImpact}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">6. DECISÕES APROVADAS E RECOMENDAÇÕES</div>
                <div className="text-[11px] text-[#F2B84B]">
                  {decisions.filter((d) => d.status === 'aprovada').length} aprovadas · {pendingDecisionsCount} pendentes · {decisions.filter((d) => d.status === 'adiada').length} adiadas
                </div>
                <ul className="space-y-1 text-[var(--text-secondary)]">
                  {decisions.slice(0, 6).map((d) => (
                    <li key={d.code}>
                      <span className="font-mono text-[#20C5D5]">{d.code}</span> {d.title} ({d.status})
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">7. PLANOS DE AÇÃO</div>
                <ul className="space-y-1 text-[var(--text-secondary)]">
                  {actions.map((a) => (
                    <li key={a.code} className="flex justify-between gap-2">
                      <span><strong className="font-mono text-[#20C5D5]">{a.code}</strong> {a.title} ({a.owner})</span>
                      <span className="font-mono shrink-0">{a.completionPct}%</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">8. RESULTADOS E INDICADORES DE DESEMPENHO</div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Documentos analisados</span><strong className="font-mono">{documents.length}</strong></div>
                  <div className="flex justify-between"><span>Relatórios interpretados</span><strong className="font-mono">{interpretedDocsCount}</strong></div>
                  <div className="flex justify-between"><span>Descobertas relevantes</span><strong className="font-mono">{ATLANTICA_ANALYSES.length}</strong></div>
                  <div className="flex justify-between"><span>Notícias verificadas no Radar</span><strong className="font-mono">{ATLANTICA_SIGNALS.filter((s) => !s.needsVerification).length}</strong></div>
                  <div className="flex justify-between"><span>Ações concluídas</span><strong className="font-mono">{actions.filter((a) => a.status === 'concluida').length}/{actions.length}</strong></div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">MODELOS DISPONÍVEIS</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              {[
                { title: 'Resumo executivo semanal', sub: 'Mercado, decisões e indicadores', freq: 'Semanal' },
                { title: 'Panorama competitivo', sub: 'Movimentos e posicionamento', freq: 'Mensal' },
                { title: 'Interpretação de relatórios internos', sub: 'Descobertas e recomendações', freq: 'Mensal' },
                { title: 'Ambiente macroeconômico e regulatório', sub: 'Tributação, leis e indicadores', freq: 'Mensal' },
              ].map((m) => (
                <div key={m.title} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex flex-col justify-between space-y-4">
                  <div>
                    <FileText className="h-4 w-4 text-[#20C5D5] mb-2" />
                    <div className="font-bold text-sm">{m.title}</div>
                    <div className="text-[var(--text-secondary)] mt-0.5">{m.sub}</div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]">{m.freq}</span>
                    <button type="button" onClick={handleExportPdf} className="inline-flex items-center gap-1 text-[#20C5D5] font-semibold cursor-pointer">
                      <Download className="h-3.5 w-3.5" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* INDICADORES (PDF 2 p.15 + 3 Grupos: Interna, Externa, Gestão)    */}
      {/* ================================================================ */}
      {section === 'indicadores' && (
        <div className="space-y-6">
          <PageHeader
            kicker="DESEMPENHO"
            title="Indicadores"
            description="KPIs comerciais preservados, 3 grupos de governança (Inteligência interna, Ambiente externo, Gestão estratégica) e síntese macroeconômica."
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {ATLANTICA_EXTENDED_KPIS.map((k) => (
              <KpiStatCard key={k.label} title={k.label} value={k.value} subtitle={k.note} tone={k.tone} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold">Faturamento por canal</h3>
                <p className="text-[11px] text-[var(--text-secondary)]">R$ mil/semana · últimas 6 semanas</p>
              </div>
              <TrendLineChart labels={ATLANTICA_CHANNEL_SERIES.labels} series={ATLANTICA_CHANNEL_SERIES.series} />
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold">Margem bruta e NPS</h3>
                <p className="text-[11px] text-[var(--text-secondary)]">Tendência nos últimos 6 meses</p>
              </div>
              <TrendLineChart labels={ATLANTICA_MARGIN_NPS_SERIES.labels} series={ATLANTICA_MARGIN_NPS_SERIES.series} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">1. INTELIGÊNCIA INTERNA</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <KpiStatCard title="Documentos analisados" value={documents.length} subtitle="Na base demonstrativa" />
              <KpiStatCard title="Relatórios interpretados" value={interpretedDocsCount} subtitle="Com cruzamento ativo" />
              <KpiStatCard title="Descobertas relevantes" value={ATLANTICA_ANALYSES.length} subtitle="Ligadas a decisões" />
              <KpiStatCard title="Recomendações geradas" value={decisions.length} subtitle="Priorizadas" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">2. AMBIENTE EXTERNO</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <KpiStatCard
                title="Notícias verificadas"
                value={ATLANTICA_SIGNALS.filter((s) => !s.needsVerification).length}
                subtitle="Fontes validadas no Radar"
                tone="green"
              />
              <KpiStatCard
                title="Ameaças identificadas"
                value={ATLANTICA_SIGNALS.filter((s) => s.kind === 'ameaca').length}
                subtitle="Com plano de contenção"
                tone="red"
              />
              <KpiStatCard
                title="Movimentações de mercado"
                value={ATLANTICA_SIGNALS.filter((s) => s.kind === 'movimento').length}
                subtitle="Setor, macro e tributação"
                tone="cyan"
              />
              <KpiStatCard
                title="Informações pendentes"
                value={verificationQueue.length}
                subtitle="Aguardando verificação"
                tone="amber"
                onClick={() => goToSection('verificar')}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">3. GESTÃO ESTRATÉGICA</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <KpiStatCard title="Recomendações aguardando aprovação" value={pendingDecisionsCount} subtitle="Central de decisões" tone="amber" onClick={() => goToSection('decisoes')} />
              <KpiStatCard title="Decisões aprovadas" value={decisions.filter((d) => d.status === 'aprovada').length} subtitle="Enviadas para planos" tone="green" />
              <KpiStatCard title="Ações em andamento" value={actions.filter((a) => a.status === 'em_andamento').length} subtitle="Em execução" tone="cyan" onClick={() => goToSection('planos-acao')} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">REFERÊNCIA MACROECONÔMICA</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {ATLANTICA_MACRO.map((m) => (
                <div key={m.code} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5 space-y-1 text-xs">
                  <div className="text-[11px] text-[var(--text-secondary)] truncate">{m.label}</div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#20C5D5]">{m.value}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">{m.source}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* HISTÓRICO E NOTIFICAÇÕES (PDF 2 p.2)                             */}
      {/* ================================================================ */}
      {section === 'historico' && (
        <div className="space-y-5">
          <PageHeader
            kicker="CONTA"
            title="Histórico e notificações"
            description="Tudo o que chegou e tudo o que foi decidido."
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Bell className="h-4 w-4 text-[#20C5D5]" />
                  <span>Notificações</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {['Todas', 'Documentos', 'Ambiente externo', 'Decisões'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setNotifFilter(f)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                        notifFilter === f ? 'bg-[#F4F8FF] text-[#06132D] font-semibold' : 'bg-[var(--bg-card-secondary)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-[var(--border-subtle)]">
                {ATLANTICA_NOTIFICATIONS.filter(
                  (n) => notifFilter === 'Todas' || n.category === notifFilter
                ).map((n) => (
                  <div key={n.id} className="py-3 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        kind={n.category === 'Decisões' ? 'alerta' : n.category === 'Ambiente externo' ? 'oportunidade' : 'movimento'}
                        customLabel={n.category}
                      />
                      <span className="text-[11px] text-[var(--text-secondary)] font-mono">{n.date}</span>
                    </div>
                    <div className="text-[var(--text-primary)]">{n.text}</div>
                    <button
                      type="button"
                      onClick={() => goToSection(n.target as DemoSection)}
                      className="text-[11px] font-medium text-[#20C5D5] hover:underline cursor-pointer"
                    >
                      {n.linkText}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 self-start text-xs">
              <div className="font-bold text-sm">Suas ações nesta sessão</div>
              <p className="text-[11px] text-[var(--text-secondary)]">Somem ao recarregar a página</p>
              {sessionLogs.length === 0 ? (
                <div className="py-6 text-[var(--text-secondary)]">
                  Nenhuma ação ainda. Aprovações, verificações e envios aparecerão aqui.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {sessionLogs.map((l, idx) => (
                    <div key={idx} className="py-2">
                      <span className="font-mono text-[#20C5D5]">{l.time}</span> · {l.text}
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">HISTÓRICO DEMONSTRATIVO</div>
                {ATLANTICA_AUDIT_LOG.map((a) => (
                  <div key={a.date + a.action} className="text-[11px] text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">{a.action}</strong> — {a.target} ({a.date})
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MINHA ASSINATURA & PLANOS (PDF 2 p.16-20)                        */}
      {/* ================================================================ */}
      {section === 'plano' && (
        <div className="space-y-6">
          <PageHeader
            kicker="CONTA"
            title={planStep === 'planos' ? 'Minha assinatura & Planos' : 'Contratação Demonstrativa'}
            description="Seu plano atual na demonstração e simulação do fluxo de assinatura."
          />

          {planStep === 'planos' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
                  <div className="text-xs text-[#20C5D5] font-semibold">Plano atual</div>
                  <h2 className="text-xl font-bold">Acesso demonstrativo</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Sem plano contratado, todos os módulos ficam liberados para conhecer a plataforma.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPlanStep('resumo')}
                    className="w-full rounded-lg bg-[#F4F8FF] py-2.5 text-xs font-semibold text-[#06132D] hover:bg-white cursor-pointer"
                  >
                    Simular contratação de plano
                  </button>
                </div>

                <div className="lg:col-span-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-3 text-xs">
                  <div className="font-bold text-sm">Módulos liberados na demonstração</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    {[
                      'Visão geral',
                      'Documentos e relatórios',
                      'Radar de mercado',
                      'Ambiente macroeconômico',
                      'Informações a verificar',
                      'Concorrentes',
                      'Análises estratégicas',
                      'Central de decisões',
                      'Planos de ação',
                      'Assistente de inteligência',
                      'Relatórios e Indicadores',
                    ].map((mod) => (
                      <div key={mod} className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
                        <span>{mod}</span>
                        <Check className="h-3.5 w-3.5 text-[#20B981]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-[var(--text-secondary)]">{PAYMENT_NOTICE_DEMO}</div>
                <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1 text-xs">
                  <button type="button" onClick={() => setBillingCycle('monthly')} className={`px-3 py-1 rounded-md cursor-pointer ${billingCycle === 'monthly' ? 'bg-[#20C5D5] text-[#06132D] font-semibold' : ''}`}>Mensal</button>
                  <button type="button" onClick={() => setBillingCycle('annual')} className={`px-3 py-1 rounded-md cursor-pointer ${billingCycle === 'annual' ? 'bg-[#20C5D5] text-[#06132D] font-semibold' : ''}`}>Anual ({ANNUAL_DISCOUNT_LABEL})</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {Object.values(PLANS_CONFIG).map((plan) => {
                  const price = billingCycle === 'annual' ? plan.annualMonthlyEquivalent : plan.monthlyPrice;
                  return (
                    <div
                      key={plan.code}
                      className={`rounded-xl border p-6 bg-[var(--bg-card)] flex flex-col justify-between space-y-4 ${
                        plan.recommended ? 'border-[#20C5D5] ring-1 ring-[#20C5D5]/30' : 'border-[var(--border-subtle)]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{plan.name}</span>
                          {plan.recommended && <span className="text-[11px] text-[#20C5D5] font-semibold">★ Recomendado</span>}
                        </div>
                        <div className="text-2xl font-bold font-mono tabular-nums">
                          R$ {price.toFixed(2).replace('.', ',')}
                          <span className="text-xs font-sans font-normal text-[var(--text-secondary)]">/mês</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-subtle)]">
                          {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlan(plan.code);
                          setPlanStep('resumo');
                        }}
                        className="w-full rounded-lg bg-[#F4F8FF] py-2 text-xs font-semibold text-[#06132D] hover:bg-white cursor-pointer"
                      >
                        Escolher {plan.name}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {PLAN_ADDONS.map((ad) => (
                  <div key={ad.code}>
                    <div className="font-semibold">{ad.name} — R$ {ad.monthlyPrice.toFixed(2).replace('.', ',')}</div>
                    <div className="text-[var(--text-secondary)]">{ad.description}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {planStep === 'resumo' && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 max-w-3xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-[#20C5D5] font-semibold">PLANO SELECIONADO</div>
                  <h2 className="text-2xl font-bold mt-1">{PLANS_CONFIG[selectedPlan].name}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">{PLANS_CONFIG[selectedPlan].tagline}</p>
                </div>
                <div className="text-right font-mono text-2xl font-bold">
                  R$ {PLANS_CONFIG[selectedPlan].monthlyPrice.toFixed(2).replace('.', ',')}/mês
                </div>
              </div>
              <div className="flex justify-between pt-4 border-t border-[var(--border-subtle)] text-xs">
                <button type="button" onClick={() => setPlanStep('planos')} className="text-[var(--text-secondary)] hover:text-white cursor-pointer">← Trocar de plano</button>
                <button type="button" onClick={() => setPlanStep('dados')} className="rounded-lg bg-[#20C5D5] px-5 py-2 font-semibold text-[#06132D] cursor-pointer">Continuar</button>
              </div>
            </div>
          )}

          {planStep === 'dados' && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 max-w-3xl text-xs">
              <h2 className="text-lg font-bold">Confirme seus dados</h2>
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-4">
                <div><span className="text-[var(--text-secondary)]">Empresa:</span> <div className="font-bold">{ATLANTICA_BRAND.name}</div></div>
                <div><span className="text-[var(--text-secondary)]">E-mail:</span> <div className="font-bold">{ATLANTICA_BRAND.email}</div></div>
              </div>
              <div className="text-[var(--text-secondary)]">{PAYMENT_NOTICE_DEMO}</div>
              <div className="flex justify-between">
                <button type="button" onClick={() => setPlanStep('resumo')} className="text-[var(--text-secondary)] cursor-pointer">← Voltar ao resumo</button>
                <button type="button" onClick={() => setPlanStep('confirmacao')} className="rounded-lg bg-[#F4F8FF] px-5 py-2 font-semibold text-[#06132D] cursor-pointer">Confirmar contratação</button>
              </div>
            </div>
          )}

          {planStep === 'confirmacao' && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center space-y-4 max-w-2xl">
              <CheckCircle2 className="h-10 w-10 text-[#20B981] mx-auto" />
              <h2 className="text-xl font-bold">Contratação demonstrativa confirmada</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Plano {PLANS_CONFIG[selectedPlan].name} · Protocolo GD-227916 · {PAYMENT_NOTICE_DEMO}
              </p>
              <div className="flex justify-center gap-3">
                <button type="button" onClick={() => goToSection('painel')} className="rounded-lg bg-[#20C5D5] px-5 py-2 text-xs font-semibold text-[#06132D] cursor-pointer">
                  Voltar ao painel
                </button>
                <Link to="/beta/cadastro" className="rounded-lg border border-[var(--border-subtle)] px-5 py-2 text-xs font-semibold">
                  Criar conta real na Beta
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* EMPRESA & LGPD                                                   */}
      {/* ================================================================ */}
      {section === 'configuracoes' && (
        <div className="space-y-5">
          <PageHeader
            kicker="CONTA"
            title="Empresa e Privacidade (LGPD)"
            description="Identidade preservada da Atlântica Moda no ambiente demonstrativo."
          />
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4 text-xs">
            <div className="flex items-center gap-4">
              <img src={ATLANTICA_BRAND.logoUrl} alt={ATLANTICA_BRAND.name} className="h-14 w-14 rounded-lg object-cover border border-[#20C5D5]/30" />
              <div>
                <h2 className="text-base font-bold">{ATLANTICA_BRAND.legalName}</h2>
                <div className="text-[var(--text-secondary)]">CNPJ {ATLANTICA_BRAND.cnpj} · {ATLANTICA_BRAND.cnae}</div>
                <div className="text-[var(--text-secondary)]">{ATLANTICA_BRAND.address} — {ATLANTICA_BRAND.city}/{ATLANTICA_BRAND.state}</div>
              </div>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed pt-2 border-t border-[var(--border-subtle)]">
              Neste ambiente demonstrativo, nenhum dado pessoal real é gravado no banco de dados. Para cadastrar sua própria empresa com isolamento multiempresa no PostgreSQL e exportação/exclusão LGPD, utilize a{' '}
              <Link to="/beta/cadastro" className="text-[#20C5D5] underline">versão Beta</Link>.
            </p>
          </div>
        </div>
      )}

      {/* Discrete Quick AI Floating Help Widget */}
      <div className="fixed bottom-16 lg:bottom-5 right-5 z-40">
        {aiOpen ? (
          <div className="w-80 sm:w-96 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
            <div className="bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Bot className="h-4 w-4 text-[#20C5D5]" />
                <span>Assistente IA (Demonstração)</span>
              </div>
              <button type="button" onClick={() => setAiOpen(false)} className="text-[var(--text-secondary)] hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs bg-[var(--bg-main)]/40">
              {aiMessages.length === 0 && (
                <div className="text-[var(--text-secondary)]">
                  Pergunte sobre o DOC-05 de Marketing, ruptura do Blazer Linho Areia, S-01 (Brisa Concept) ou tributação.
                </div>
              )}
              {aiMessages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-2.5 ${
                    m.role === 'user'
                      ? 'bg-[#15365F] border border-[#20C5D5]/30 text-white ml-6'
                      : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] mr-4'
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                askDemoAssistant(aiInput);
              }}
              className="p-2.5 border-t border-[var(--border-subtle)] flex gap-2"
            >
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Pergunte sobre Atlântica Moda..."
                className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 text-xs"
              />
              <button type="submit" className="rounded-lg bg-[#20C5D5] px-3 py-1.5 text-[#06132D] font-semibold cursor-pointer" aria-label="Enviar">
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#20C5D5]/40 bg-[#102B50] px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:border-[#20C5D5] transition-colors cursor-pointer"
          >
            <Bot className="h-4 w-4 text-[#20C5D5]" />
            <span>Assistente IA</span>
          </button>
        )}
      </div>
    </AppShell>
  );
};
