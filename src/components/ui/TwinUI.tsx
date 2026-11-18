import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Menu,
  Search,
  Sparkles,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { PWAInstallButton } from '../PWAInstallButton';

export type SemanticKind =
  | 'oportunidade'
  | 'ameaca'
  | 'alerta'
  | 'pendente'
  | 'movimento'
  | 'recomendacao'
  | 'aprovada'
  | 'recusada'
  | 'em_andamento'
  | 'concluida';

const BADGE_STYLES: Record<SemanticKind, { label: string; color: string; bg: string; dot: string }> = {
  oportunidade: {
    label: 'Oportunidade',
    color: 'text-[#20B981]',
    bg: 'bg-[#20B981]/15 border-[#20B981]/30',
    dot: 'bg-[#20B981]',
  },
  ameaca: {
    label: 'Ameaça',
    color: 'text-[#EF6464]',
    bg: 'bg-[#EF6464]/15 border-[#EF6464]/30',
    dot: 'bg-[#EF6464]',
  },
  alerta: {
    label: 'Alerta',
    color: 'text-[#F2B84B]',
    bg: 'bg-[#F2B84B]/15 border-[#F2B84B]/30',
    dot: 'bg-[#F2B84B]',
  },
  pendente: {
    label: 'Pendente',
    color: 'text-[#F2B84B]',
    bg: 'bg-[#F2B84B]/15 border-[#F2B84B]/30',
    dot: 'bg-[#F2B84B]',
  },
  movimento: {
    label: 'Movimento',
    color: 'text-[#20C5D5]',
    bg: 'bg-[#20C5D5]/15 border-[#20C5D5]/30',
    dot: 'bg-[#20C5D5]',
  },
  recomendacao: {
    label: 'Recomendação',
    color: 'text-[#20C5D5]',
    bg: 'bg-[#20C5D5]/15 border-[#20C5D5]/30',
    dot: 'bg-[#20C5D5]',
  },
  aprovada: {
    label: 'Aprovada',
    color: 'text-[#20B981]',
    bg: 'bg-[#20B981]/15 border-[#20B981]/30',
    dot: 'bg-[#20B981]',
  },
  recusada: {
    label: 'Recusada',
    color: 'text-[#EF6464]',
    bg: 'bg-[#EF6464]/15 border-[#EF6464]/30',
    dot: 'bg-[#EF6464]',
  },
  em_andamento: {
    label: 'Em andamento',
    color: 'text-[#20C5D5]',
    bg: 'bg-[#20C5D5]/15 border-[#20C5D5]/30',
    dot: 'bg-[#20C5D5]',
  },
  concluida: {
    label: 'Concluída',
    color: 'text-[#20B981]',
    bg: 'bg-[#20B981]/15 border-[#20B981]/30',
    dot: 'bg-[#20B981]',
  },
};

export const StatusBadge: React.FC<{ kind: SemanticKind; customLabel?: string }> = ({
  kind,
  customLabel,
}) => {
  const cfg = BADGE_STYLES[kind] || BADGE_STYLES.movimento;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${cfg.bg} ${cfg.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <span>{customLabel || cfg.label}</span>
    </span>
  );
};

export interface TraceStep {
  label: string;
  code: string;
  onClick?: () => void;
}

export const TraceabilityBar: React.FC<{ steps: TraceStep[] }> = ({ steps }) => {
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
      {steps.map((s, idx) => (
        <React.Fragment key={`${s.label}-${s.code}-${idx}`}>
          {idx > 0 && <ArrowRight className="h-3 w-3 opacity-50 shrink-0" />}
          {s.onClick ? (
            <button
              type="button"
              onClick={s.onClick}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-[var(--bg-card-secondary)] hover:text-[#20C5D5] transition-colors cursor-pointer"
            >
              <span className="opacity-75">{s.label}</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">{s.code}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-[var(--bg-card-secondary)]">
              <span className="opacity-75">{s.label}</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">{s.code}</span>
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export const KpiStatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle: string;
  icon?: React.FC<{ className?: string }>;
  tone?: 'default' | 'green' | 'amber' | 'red' | 'cyan';
  onClick?: () => void;
}> = ({ title, value, subtitle, icon: Icon, tone = 'default', onClick }) => {
  const toneColor =
    tone === 'green'
      ? 'text-[#20B981]'
      : tone === 'amber'
      ? 'text-[#F2B84B]'
      : tone === 'red'
      ? 'text-[#EF6464]'
      : tone === 'cyan'
      ? 'text-[#20C5D5]'
      : 'text-[var(--text-primary)]';

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-colors ${
        onClick ? 'hover:border-[#20C5D5]/50 cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--text-secondary)] truncate">{title}</span>
        {Icon && <Icon className="h-4 w-4 text-[var(--text-secondary)] opacity-75 shrink-0" />}
      </div>
      <div className={`mt-2 text-2xl font-bold font-mono tabular-nums ${toneColor}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--text-secondary)] truncate">{subtitle}</div>
    </Wrapper>
  );
};

export const PageHeader: React.FC<{
  kicker: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}> = ({ kicker, title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
    <div>
      <div className="text-[11px] font-semibold tracking-wider uppercase text-[#20C5D5]">
        {kicker}
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{title}</h1>
      <p className="text-xs text-[var(--text-secondary)] mt-1">{description}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const SignalCard: React.FC<{
  code: string;
  kind: SemanticKind;
  impactLabel?: string;
  category?: string;
  metaRight?: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceVerified?: string;
  publishedDate?: string;
  lastChecked?: string;
  relevance: string;
  potentialImpact: string;
  recommendation: string;
  traceSteps?: TraceStep[];
  footerActions?: React.ReactNode;
}> = ({
  code,
  kind,
  impactLabel,
  category,
  metaRight,
  title,
  summary,
  sourceName,
  sourceVerified,
  publishedDate,
  lastChecked,
  relevance,
  potentialImpact,
  recommendation,
  traceSteps,
  footerActions,
}) => (
  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3.5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-[var(--text-secondary)]">{code}</span>
        <StatusBadge kind={kind} />
        {impactLabel && (
          <span className="rounded-md bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
            {impactLabel}
          </span>
        )}
        {category && (
          <span className="rounded-md bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px] text-[#20C5D5]">
            {category}
          </span>
        )}
      </div>
      {metaRight && (
        <span className="text-[11px] text-[var(--text-secondary)]">{metaRight}</span>
      )}
    </div>

    <div>
      <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">{summary}</p>
    </div>

    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/70 p-3 text-xs space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-[var(--text-primary)]">
        <span>
          <strong>Fonte:</strong> {sourceName}
        </span>
        {sourceVerified && (
          <span className="text-[#20C5D5]">· {sourceVerified}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[var(--text-secondary)]">
        {publishedDate && <span>Data de publicação: {publishedDate}</span>}
        {lastChecked && <span>Última verificação: {lastChecked}</span>}
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Relevância para a empresa
        </div>
        <div className="mt-1 text-[var(--text-primary)]">{relevance}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Impacto potencial
        </div>
        <div className="mt-1 text-[var(--text-primary)]">{potentialImpact}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Recomendação
        </div>
        <div className="mt-1 text-[#20C5D5]">{recommendation}</div>
      </div>
    </div>

    {(traceSteps?.length || footerActions) && (
      <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
        {traceSteps ? <TraceabilityBar steps={traceSteps} /> : <span />}
        {footerActions && <div className="flex items-center gap-2">{footerActions}</div>}
      </div>
    )}
  </div>
);

export const EmptyEvidenceBox: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/60 p-6 text-center space-y-2.5">
    <Info className="h-6 w-6 text-[#F2B84B] mx-auto" />
    <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
    <p className="text-xs text-[var(--text-secondary)] max-w-lg mx-auto">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] transition-colors cursor-pointer"
      >
        <span>{actionLabel}</span>
      </button>
    )}
  </div>
);

export interface NavGroupItem {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  badgeCount?: number;
}

export interface NavGroup {
  title: string;
  items: NavGroupItem[];
}

export const AppShell: React.FC<{
  brandSubtitle?: string;
  navGroups: NavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  companyName: string;
  companySegment: string;
  periodLabel: string;
  environmentTag: string;
  isDemo: boolean;
  userInitial: string;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  onOpenHelp?: () => void;
  sidebarFooter?: React.ReactNode;
  sidebarPlanBox?: React.ReactNode;
  topExtra?: React.ReactNode;
  mobileBottomItems: Array<{ id: string; label: string; icon: React.FC<{ className?: string }> }>;
  children: React.ReactNode;
}> = ({
  brandSubtitle = 'Inteligência ambiental e apoio à decisão',
  navGroups,
  activeId,
  onSelect,
  companyName,
  companySegment,
  periodLabel,
  environmentTag,
  isDemo,
  userInitial,
  notificationCount = 0,
  onOpenNotifications,
  onOpenHelp,
  sidebarFooter,
  sidebarPlanBox,
  topExtra,
  mobileBottomItems,
  children,
}) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const sidebarWidth = collapsed ? 'lg:w-20' : 'lg:w-64';
  const mainPad = collapsed ? 'lg:pl-20' : 'lg:pl-64';

  const renderNav = (mobile = false) => (
    <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
      {navGroups.map((group) => (
        <div key={group.title}>
          {(!collapsed || mobile) && (
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-secondary)]/70">
              {group.title}
            </div>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={collapsed && !mobile ? item.label : undefined}
                  onClick={() => {
                    onSelect(item.id);
                    if (mobile) setDrawerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#15365F] text-[#F4F8FF] border border-[#20C5D5]/30'
                      : 'text-[var(--text-secondary)] hover:bg-[#102B50]/60 hover:text-[#F4F8FF] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-[#20C5D5]' : 'text-[var(--text-secondary)]'
                      }`}
                    />
                    {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
                  </span>
                  {(!collapsed || mobile) && item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span className="rounded-full bg-[#F2B84B] px-1.5 py-0.5 text-[10px] font-bold text-[#06132D] tabular-nums shrink-0">
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 ${sidebarWidth} bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] transition-all duration-200 z-40`}
      >
        <div className="px-3.5 py-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/src/assets/images/gemeo_digital_icon_1794938598899.jpg"
              alt="Gêmeo Digital"
              className="h-8 w-8 rounded-lg object-cover shrink-0 border border-[#20C5D5]/30"
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-extrabold tracking-tight text-white leading-tight">
                  GÊMEO DIGITAL
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] leading-tight mt-0.5">
                  {brandSubtitle}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded-md text-[var(--text-secondary)] hover:text-white hover:bg-[#102B50] cursor-pointer shrink-0"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {renderNav(false)}

        {!collapsed && sidebarPlanBox && (
          <div className="px-3 pb-2">{sidebarPlanBox}</div>
        )}
        {!collapsed && sidebarFooter && (
          <div className="p-3 border-t border-[var(--border-subtle)]">{sidebarFooter}</div>
        )}
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/65" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex flex-col h-full z-10">
            <div className="px-4 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/src/assets/images/gemeo_digital_icon_1794938598899.jpg"
                  alt="Gêmeo Digital"
                  className="h-8 w-8 rounded-lg object-cover"
                />
                <span className="text-sm font-extrabold text-white">GÊMEO DIGITAL</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-[var(--text-secondary)] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNav(true)}
            {sidebarPlanBox && <div className="px-3 pb-2">{sidebarPlanBox}</div>}
            {sidebarFooter && (
              <div className="p-3 border-t border-[var(--border-subtle)]">{sidebarFooter}</div>
            )}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className={`flex-1 ${mainPad} flex flex-col min-w-0 pb-16 lg:pb-0 transition-all duration-200`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/95 backdrop-blur px-4 sm:px-6 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[#102B50]"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {companyName}
                  </span>
                  {companySegment && (
                    <>
                      <span className="hidden sm:inline text-[var(--text-secondary)]">·</span>
                      <span className="hidden sm:inline text-xs text-[var(--text-secondary)] truncate">
                        {companySegment}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {topExtra}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                <Clock className="h-3 w-3 text-[#20C5D5]" />
                <span>{periodLabel}</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                  isDemo
                    ? 'border-[#20C5D5]/40 bg-[#20C5D5]/10 text-[#20C5D5]'
                    : 'border-[#20B981]/40 bg-[#20B981]/10 text-[#20B981]'
                }`}
              >
                <span>{environmentTag}</span>
              </span>
              <PWAInstallButton />
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="relative p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-white cursor-pointer"
                  aria-label="Notificações"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 rounded-full bg-[#F2B84B] px-1 text-[9px] font-bold text-[#06132D]">
                      {notificationCount}
                    </span>
                  )}
                </button>
              )}
              {onOpenHelp && (
                <button
                  type="button"
                  onClick={onOpenHelp}
                  className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:text-white cursor-pointer"
                  title="Acesso rápido à ajuda e Assistente"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#20C5D5]" />
                  <span>Ajuda IA</span>
                </button>
              )}
              <div className="h-7 w-7 rounded-full bg-[#15365F] border border-[#20C5D5]/40 flex items-center justify-center text-xs font-bold text-[#20C5D5]">
                {userInitial}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-sidebar)] flex items-center justify-around py-1.5">
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${
                active ? 'text-[#20C5D5] font-semibold' : 'text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
