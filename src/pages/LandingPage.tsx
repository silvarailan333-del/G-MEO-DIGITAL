import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Globe,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import {
  ANNUAL_DISCOUNT_LABEL,
  PAYMENT_NOTICE_DEMO,
  PLAN_ADDONS,
  PLANS_CONFIG,
} from '../config/plans';
import { ATLANTICA_BRAND } from '../demo/atlanticaData';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const LandingPage: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [lightMode, setLightMode] = useState(() =>
    document.documentElement.classList.contains('light-theme')
  );

  const toggleTheme = () => {
    const next = !lightMode;
    setLightMode(next);
    document.documentElement.classList.toggle('light-theme', next);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <img
              src="/src/assets/images/gemeo_digital_icon_1794938598899.jpg"
              alt="Gêmeo Digital"
              className="h-8 w-8 rounded-lg object-cover border border-[#20C5D5]/40"
            />
            <div>
              <div className="text-sm font-extrabold tracking-tight text-white leading-tight">
                GÊMEO DIGITAL
              </div>
              <div className="text-[10px] text-[#A8BAD0] leading-tight">
                Inteligência ambiental e apoio à decisão
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#A8BAD0]">
            <a href="#arquitetura" className="hover:text-[#20C5D5] whitespace-nowrap shrink-0 transition-colors">
              Arquitetura
            </a>
            <Link to="/painel" className="hover:text-[#20C5D5] whitespace-nowrap shrink-0 transition-colors">
              Demonstração
            </Link>
            <a href="#planos" className="hover:text-[#20C5D5] whitespace-nowrap shrink-0 transition-colors">
              Planos e Assinaturas
            </a>
            <Link to="/beta/login" className="hover:text-[#20C5D5] whitespace-nowrap shrink-0 transition-colors">
              Entrar na Beta
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[var(--border-subtle)] bg-[#102B50] text-[#A8BAD0] hover:text-white cursor-pointer"
              aria-label="Alternar tema"
            >
              {lightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link
              to="/beta/cadastro"
              className="rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] transition-colors whitespace-nowrap shrink-0"
            >
              Acessar versão Beta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#20C5D5]">
              Inteligência Ambiental e Apoio à Decisão · MEI, ME, EPP e PMEs
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)] text-balance leading-tight">
              Dados externos e dados internos conectados em uma leitura estratégica rastreável.
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Cruze IPCA, Selic, câmbio, renda local e movimentos de concorrentes com o catálogo, margens, estoque e voz do cliente da sua própria empresa — com cadeia completa de evidências e zero números inventados.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/beta/cadastro"
                className="inline-flex items-center gap-2 rounded-lg bg-[#20C5D5] px-5 py-3 text-sm font-semibold text-[#06132D] hover:bg-[#38d3e2] transition-colors"
              >
                <span>Acessar versão Beta</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/painel"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[#20C5D5]/60 transition-colors"
              >
                <span>Ver Demonstração (Atlântica Moda)</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 flex flex-col justify-between space-y-6 shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={ATLANTICA_BRAND.logoUrl}
                  alt="Atlântica Moda"
                  className="h-12 w-12 rounded-lg object-cover border border-[#20C5D5]/30"
                />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">
                    Dois ambientes independentes
                  </div>
                  <div className="text-base font-bold text-[var(--text-primary)]">
                    Demonstração + SaaS Beta
                  </div>
                </div>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3 text-xs text-[var(--text-secondary)]">
                <div className="flex items-start gap-2.5">
                  <BarChart3 className="h-4 w-4 text-[#20C5D5] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[var(--text-primary)]">Demonstração Atlântica Moda:</strong> preservada integralmente para apresentações e validação de fluxos, isolada do banco privado.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Lock className="h-4 w-4 text-[#20B981] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[var(--text-primary)]">Versão Beta Multiempresa:</strong> autenticação real, PostgreSQL dedicado por empresa, upload de imagens, importação e Assistente IA.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/60 p-3 flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Fontes oficiais integradas</span>
              <span className="font-mono text-[#20C5D5]">BCB · IBGE · BrasilAPI</span>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section id="arquitetura" className="border-y border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">
              ARQUITETURA ANALÍTICA
            </div>
            <h2 className="text-2xl font-bold mt-1">Rigor metodológico do sinal ao plano de ação</h2>
            <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)]">
              Cada recomendação exibe cadeia rastreável: Documento → Radar → Análise → Decisão → Ação, com fontes, limitações e Qualidade do Cruzamento.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-2.5">
              <Building2 className="h-5 w-5 text-[#20C5D5]" />
              <h3 className="text-base font-bold">Isolamento Multiempresa</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Cada usuário acessa exclusivamente suas próprias empresas, produtos, categorias, imagens, concorrentes e relatórios, validados no backend e PostgreSQL.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-2.5">
              <Globe className="h-5 w-5 text-[#20C5D5]" />
              <h3 className="text-base font-bold">Ambiente Macroeconômico Oficial</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Leitura direta de IPCA, Selic, Câmbio PTAX, Desocupação, PIB e Renda via Banco Central e IBGE/SIDRA, com indicação transparente de disponibilidade.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-2.5">
              <ShieldCheck className="h-5 w-5 text-[#20B981]" />
              <h3 className="text-base font-bold">Zero Dados Inventados</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Quando não houver base suficiente, o sistema informa explicitamente que ainda falta evidência para calcular o impacto ou simular projeções.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Plans Section matching PDF 2 page 20 */}
      <section id="planos" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">
              ASSINATURAS
            </div>
            <h2 className="text-2xl font-bold mt-1">Planos e Assinaturas</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{PAYMENT_NOTICE_DEMO}</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1 text-xs self-start">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-[#20C5D5] text-[#06132D] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                billingCycle === 'annual'
                  ? 'bg-[#20C5D5] text-[#06132D] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Anual ({ANNUAL_DISCOUNT_LABEL})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.values(PLANS_CONFIG).map((plan) => {
            const price =
              billingCycle === 'annual' ? plan.annualMonthlyEquivalent : plan.monthlyPrice;
            return (
              <div
                key={plan.code}
                className={`rounded-xl border p-6 bg-[var(--bg-card)] flex flex-col justify-between space-y-5 relative ${
                  plan.recommended
                    ? 'border-[#20C5D5] ring-1 ring-[#20C5D5]/30'
                    : 'border-[var(--border-subtle)]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      {plan.name}
                    </span>
                    {plan.recommended && (
                      <span className="rounded-md border border-[#20C5D5]/40 bg-[#20C5D5]/15 px-2 py-0.5 text-[10px] font-semibold text-[#20C5D5]">
                        ★ Recomendado
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                    R$ {price.toFixed(2).replace('.', ',')}
                    <span className="text-xs font-sans font-normal text-[var(--text-secondary)]">/mês</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{plan.tagline}</p>
                  <div className="text-xs text-[#20C5D5] font-medium">
                    Teste gratuito de {plan.trialDays} dias
                  </div>
                  <ul className="space-y-2 pt-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-[#20C5D5] shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to="/beta/cadastro"
                  className={`block text-center rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                    plan.recommended
                      ? 'bg-[#20C5D5] text-[#06132D] hover:bg-[#38d3e2]'
                      : 'bg-[#F4F8FF] text-[#06132D] hover:bg-white'
                  }`}
                >
                  Escolher {plan.name}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {PLAN_ADDONS.map((ad) => (
            <div key={ad.code}>
              <div className="font-bold text-[var(--text-primary)]">
                {ad.name} · <span className="text-[#20C5D5]">R$ {ad.monthlyPrice.toFixed(2).replace('.', ',')}</span> {ad.unitLabel}
              </div>
              <div className="text-[var(--text-secondary)] mt-0.5">{ad.description}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--border-subtle)] py-8 px-4 sm:px-6 text-xs text-[var(--text-secondary)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Gêmeo Digital — Inteligência Ambiental e Apoio à Decisão</span>
          <div className="flex items-center gap-4">
            <Link to="/painel" className="hover:text-[#20C5D5]">
              Demonstração Atlântica Moda
            </Link>
            <Link to="/beta/login" className="hover:text-[#20C5D5]">
              Login Beta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
