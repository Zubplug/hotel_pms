'use client';
import React from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
 * Night Audit design primitives
 * One surface, one border, one radius. Dense, calm, tabular.
 * ──────────────────────────────────────────────────────────────────────────── */

export type Tone = 'neutral' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';

export const TONE_HEX: Record<Tone, string> = {
  neutral: '#94a3b8',
  indigo: '#818cf8',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
  sky: '#38bdf8',
  violet: '#a78bfa',
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-slate-300',
  indigo: 'text-indigo-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  sky: 'text-sky-300',
  violet: 'text-violet-300',
};

const BADGE: Record<Tone, string> = {
  neutral: 'border-white/[0.08] bg-white/[0.04] text-slate-300',
  indigo: 'border-indigo-400/25 bg-indigo-400/[0.08] text-indigo-200',
  emerald: 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200',
  amber: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-200',
  rose: 'border-rose-400/25 bg-rose-400/[0.08] text-rose-200',
  sky: 'border-sky-400/25 bg-sky-400/[0.08] text-sky-200',
  violet: 'border-violet-400/25 bg-violet-400/[0.08] text-violet-200',
};

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export const SURFACE = 'rounded-xl border border-white/[0.07] bg-[#0b111e]/90 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]';

export function Panel({ className, children, as: As = 'section', ...rest }: React.HTMLAttributes<HTMLElement> & { as?: any }) {
  return <As className={cx(SURFACE, 'flex flex-col overflow-hidden', className)} {...rest}>{children}</As>;
}

export function PanelHeader({
  icon: Icon, title, subtitle, actions, tone = 'neutral', count,
}: {
  icon?: React.ElementType; title: string; subtitle?: string; actions?: React.ReactNode; tone?: Tone; count?: number;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
            <Icon className="h-3.5 w-3.5" style={{ color: TONE_HEX[tone] }} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white">
            {title}
            {count !== undefined && (
              <span className="rounded-md bg-white/[0.06] px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums text-slate-400">{count}</span>
            )}
          </h2>
          {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold', BADGE[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE_HEX[tone] }} />}
      {children}
    </span>
  );
}

export function Tabs<T extends string>({
  value, onChange, items,
}: {
  value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number; tone?: Tone }[];
}) {
  return (
    <div role="tablist" className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
              active ? 'bg-white/[0.08] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {it.label}
            {it.count !== undefined && it.count > 0 && (
              <span className="font-mono text-[10px] tabular-nums" style={{ color: TONE_HEX[it.tone || 'neutral'] }}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, tone = 'emerald' }: { icon: React.ElementType; title: string; hint?: string; tone?: Tone }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
        <Icon className="h-5 w-5" style={{ color: TONE_HEX[tone] }} />
      </span>
      <p className="text-[13px] font-semibold text-slate-200">{title}</p>
      {hint && <p className="max-w-xs text-[11px] leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

export function Sparkline({ data, color, width = 72, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data, min + 1);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - ((v - min) / (max - min)) * (height - 4) - 2]);
  const d = `M ${pts.map((p) => p.join(',')).join(' L ')}`;
  const id = `sp-${color.replace('#', '')}-${width}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${width},${height} L 0,${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
    </svg>
  );
}

export function Delta({ value, suffix = 'vs prior' }: { value?: number | null; suffix?: string }) {
  if (value === undefined || value === null || !isFinite(value)) return <span className="text-[10.5px] text-slate-600">—</span>;
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px]">
      <span className={cx('font-semibold tabular-nums', flat ? 'text-slate-400' : up ? 'text-emerald-400' : 'text-rose-400')}>
        {flat ? '0.0%' : `${up ? '▲' : '▼'} ${Math.abs(value).toFixed(1)}%`}
      </span>
      <span className="text-slate-600">{suffix}</span>
    </span>
  );
}

export const money = (n: number, code = 'NGN', compact = false) =>
  new Intl.NumberFormat('en', {
    style: 'currency', currency: code || 'NGN',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number.isFinite(n) ? n : 0);
