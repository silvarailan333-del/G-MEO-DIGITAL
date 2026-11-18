import React from 'react';

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

export const TrendLineChart: React.FC<{
  labels: string[];
  series: LineSeries[];
  unitSuffix?: string;
  height?: number;
}> = ({ labels, series, unitSuffix = '', height = 180 }) => {
  if (labels.length === 0 || series.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
        Sem série histórica suficiente para exibir gráfico.
      </div>
    );
  }

  const allVals = series.flatMap((s) => s.values);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const span = Math.max(0.01, maxVal - minVal);

  const w = 640;
  const h = height;
  const padX = 28;
  const padY = 20;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.name}</span>
          </span>
        ))}
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full min-w-[420px] h-auto">
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padY + (h - padY * 2) * (1 - frac);
            const val = (minVal + span * frac).toFixed(1);
            return (
              <g key={frac}>
                <line
                  x1={padX}
                  x2={w - 12}
                  y1={y}
                  y2={y}
                  stroke="rgba(168,186,208,0.14)"
                  strokeDasharray="3 3"
                />
                <text
                  x={4}
                  y={y + 3}
                  fill="#A8BAD0"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {val}
                  {unitSuffix}
                </text>
              </g>
            );
          })}

          {series.map((s) => {
            const pts = s.values
              .map((v, idx) => {
                const x =
                  padX +
                  (idx / Math.max(1, labels.length - 1)) * (w - padX - 20);
                const y =
                  padY + (h - padY * 2) * (1 - (v - minVal) / span);
                return `${x},${y}`;
              })
              .join(' ');
            return (
              <g key={s.name}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pts}
                />
                {s.values.map((v, idx) => {
                  const x =
                    padX +
                    (idx / Math.max(1, labels.length - 1)) * (w - padX - 20);
                  const y =
                    padY + (h - padY * 2) * (1 - (v - minVal) / span);
                  return (
                    <circle key={idx} cx={x} cy={y} r="3.5" fill={s.color}>
                      <title>{`${s.name} (${labels[idx]}): ${v}${unitSuffix}`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}

          {labels.map((lbl, idx) => {
            const x =
              padX +
              (idx / Math.max(1, labels.length - 1)) * (w - padX - 20);
            return (
              <text
                key={lbl + idx}
                x={x}
                y={h + 14}
                textAnchor="middle"
                fill="#A8BAD0"
                fontSize="10"
              >
                {lbl}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const HorizontalProgressList: React.FC<{
  items: Array<{
    label: string;
    pct: number;
    rightNote?: string;
    tone?: 'cyan' | 'green' | 'amber' | 'red';
  }>;
}> = ({ items }) => (
  <div className="space-y-3">
    {items.map((item) => {
      const barColor =
        item.tone === 'green'
          ? 'bg-[#20B981]'
          : item.tone === 'amber'
          ? 'bg-[#F2B84B]'
          : item.tone === 'red'
          ? 'bg-[#EF6464]'
          : 'bg-[#20C5D5]';
      return (
        <div key={item.label} className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-primary)] truncate">{item.label}</span>
            <span className="font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
              {item.pct}% {item.rightNote ? `· ${item.rightNote}` : ''}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--bg-card-secondary)] overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.min(100, Math.max(2, Math.abs(item.pct)))}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
);
