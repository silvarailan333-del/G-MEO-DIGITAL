import React from 'react';

export interface BarDatum {
  label: string;
  value: number;
  secondaryValue?: number;
  hint?: string;
}

interface SimpleBarChartProps {
  data: BarDatum[];
  primaryLabel?: string;
  secondaryLabel?: string;
  unitSuffix?: string;
  height?: number;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  primaryLabel = 'Valor principal',
  secondaryLabel,
  unitSuffix = '',
  height = 200,
}) => {
  const maxValue = Math.max(
    1,
    ...data.map((d) => Math.max(d.value, d.secondaryValue ?? 0))
  );

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
        Sem dados numéricos suficientes para exibir gráfico.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#20C5D5]" />
          {primaryLabel}
        </span>
        {secondaryLabel && (
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#F2B84B]" />
            {secondaryLabel}
          </span>
        )}
      </div>

      <div
        className="flex items-end gap-2 sm:gap-3 pt-4 border-b border-[var(--border-subtle)] pb-2"
        style={{ minHeight: `${height}px` }}
      >
        {data.map((item) => {
          const pct = Math.max(4, Math.round((item.value / maxValue) * 100));
          const secPct =
            item.secondaryValue !== undefined
              ? Math.max(4, Math.round((item.secondaryValue / maxValue) * 100))
              : null;

          return (
            <div
              key={item.label}
              className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
              title={item.hint || `${item.label}: ${item.value}${unitSuffix}`}
            >
              <div className="w-full flex items-end justify-center gap-1 h-36">
                <div className="flex flex-col items-center justify-end h-full w-full max-w-[28px]">
                  <span className="mb-1 text-[11px] font-mono tabular-nums text-[var(--text-primary)]">
                    {item.value}
                    {unitSuffix}
                  </span>
                  <div
                    className="w-full rounded-t bg-[#20C5D5] transition-all duration-300"
                    style={{ height: `${pct}%` }}
                  />
                </div>
                {secPct !== null && (
                  <div className="flex flex-col items-center justify-end h-full w-full max-w-[28px]">
                    <span className="mb-1 text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                      {item.secondaryValue}
                      {unitSuffix}
                    </span>
                    <div
                      className="w-full rounded-t bg-[#F2B84B]/80 transition-all duration-300"
                      style={{ height: `${secPct}%` }}
                    />
                  </div>
                )}
              </div>
              <span className="w-full truncate text-center text-[11px] text-[var(--text-secondary)]">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
