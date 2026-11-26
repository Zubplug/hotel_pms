'use client';
import React from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
 * Night Audit — Executive Command Center Design System
 * Premium glassmorphism, neon accents, animated micro-interactions
 * ──────────────────────────────────────────────────────────────────────────── */

export type Tone = 'neutral' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'cyan' | 'neonViolet';

export const TONE_HEX: Record<Tone, string> = {
  neutral:    '#94a3b8',
  indigo:     '#818cf8',
  emerald:    '#34d399',
  amber:      '#fbbf24',
  rose:       '#fb7185',
  sky:        '#38bdf8',
  violet:     '#a78bfa',
  cyan:       '#06B6D4',
  neonViolet: '#7C3AED',
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral:    'text-slate-300',
  indigo:     'text-indigo-300',
  emerald:    'text-emerald-300',
  amber:      'text-amber-300',
  rose:       'text-rose-300',
  sky:        'text-sky-300',
  violet:     'text-violet-300',
  cyan:       'text-cyan-300',
  neonViolet: 'text-violet-400',
};

const BADGE: Record<Tone, string> = {
  neutral:    'border-white/[0.08]  bg-white/[0.04]           text-slate-300',
  indigo:     'border-indigo-400/25  bg-indigo-400/[0.09]      text-indigo-200',
  emerald:    'border-emerald-400/25 bg-emerald-400/[0.09]     text-emerald-200',
  amber:      'border-amber-400/25   bg-amber-400/[0.09]       text-amber-200',
  rose:       'border-rose-400/25    bg-rose-400/[0.09]        text-rose-200',
  sky:        'border-sky-400/25     bg-sky-400/[0.09]         text-sky-200',
  violet:     'border-violet-400/25  bg-violet-400/[0.09]      text-violet-200',
  cyan:       'border-cyan-400/25    bg-cyan-400/[0.09]        text-cyan-200',
  neonViolet: 'border-violet-500/30  bg-violet-500/[0.10]      text-violet-300',
};

/* ── Utilities ──────────────────────────────────────────────────────────────── */
export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/* ── Base surface tokens ─────────────────────────────────────────────────────── */
export const SURFACE = [
  'rounded-2xl',
  'border border-white/[0.08]',
  'shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_20px_48px_-12px_rgba(0,0,0,0.75)]',
].join(' ');

/* ── Panel ───────────────────────────────────────────────────────────────────── */
export function Panel({
  className, children, as: As = 'section', style, ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: any }) {
  return (
    <As
      className={cx(SURFACE, 'flex flex-col overflow-hidden', className)}
      style={{
        background: 'rgba(7,15,30,0.88)',
        backdropFilter: 'blur(20px)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </As>
  );
}

/* ── GlassPanel (alternative panel with optional neon glow border) ──────────── */
export function GlassPanel({
  children, className, glow = 'none', as: As = 'section', style, ...rest
}: React.HTMLAttributes<HTMLElement> & {
  glow?: 'violet' | 'cyan' | 'amber' | 'rose' | 'emerald' | 'none';
  as?: any;
}) {
  const glowColor: Record<string, string> = {
    violet: '#7C3AED',
    cyan: '#06B6D4',
    amber: '#F59E0B',
    rose: '#F43F5E',
    emerald: '#10B981',
    none: 'transparent',
  };
  const col = glowColor[glow];
  return (
    <As
      className={cx(
        'relative overflow-hidden rounded-2xl border flex flex-col',
        className,
      )}
      style={{
        background: 'rgba(7,15,30,0.88)',
        backdropFilter: 'blur(20px)',
        borderColor: glow !== 'none' ? `${col}30` : 'rgba(255,255,255,0.08)',
        boxShadow: glow !== 'none'
          ? `0 0 0 1px rgba(255,255,255,0.03) inset, 0 20px 48px -12px rgba(0,0,0,0.75), 0 0 60px -20px ${col}35`
          : '0 0 0 1px rgba(255,255,255,0.03) inset, 0 20px 48px -12px rgba(0,0,0,0.75)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </As>
  );
}

/* ── PanelHeader ─────────────────────────────────────────────────────────────── */
export function PanelHeader({
  icon: Icon, title, subtitle, actions, tone = 'neutral', count,
}: {
  icon?: React.ElementType; title: string; subtitle?: string;
  actions?: React.ReactNode; tone?: Tone; count?: number;
}) {
  const accentColor = TONE_HEX[tone];
  return (
    <header
      className="flex items-center justify-between gap-3 border-b px-4 py-3"
      style={{
        borderColor: 'rgba(255,255,255,0.05)',
        borderLeft: `3px solid ${accentColor}50`,
        background: 'rgba(255,255,255,0.01)',
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
            style={{
              borderColor: `${accentColor}25`,
              background: `${accentColor}12`,
            }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: accentColor }} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white">
            {title}
            {count !== undefined && (
              <span className="rounded-md bg-white/[0.07] px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums text-slate-400">
                {count}
              </span>
            )}
          </h2>
          {subtitle && (
            <p className="truncate text-[11px] text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      )}
    </header>
  );
}

/* ── Badge ───────────────────────────────────────────────────────────────────── */
export function Badge({
  tone = 'neutral', children, className, dot,
}: {
  tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold',
        BADGE[tone],
        className,
      )}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: TONE_HEX[tone] }}
        />
      )}
      {children}
    </span>
  );
}

/* ── PulsingBadge ────────────────────────────────────────────────────────────── */
export function PulsingBadge({
  tone, label, animate = true,
}: {
  tone: Tone; label: string; animate?: boolean;
}) {
  const color = TONE_HEX[tone];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        BADGE[tone],
      )}
    >
      <span className="relative flex h-2 w-2">
        {animate && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: color }}
          />
        )}
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ background: color }}
        />
      </span>
      {label}
    </span>
  );
}

/* ── Tabs ────────────────────────────────────────────────────────────────────── */
export function Tabs<T extends string>({
  value, onChange, items,
}: {
  value: T; onChange: (v: T) => void;
  items: { key: T; label: string; count?: number; tone?: Tone }[];
}) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-0.5 rounded-xl border p-0.5"
      style={{
        borderColor: 'rgba(255,255,255,0.07)',
        background: 'rgba(0,0,0,0.3)',
      }}
    >
      {items.map((it) => {
        const active = it.key === value;
        const accentColor = it.tone ? TONE_HEX[it.tone] : undefined;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
              active
                ? 'bg-white/[0.09] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {it.label}
            {it.count !== undefined && it.count > 0 && (
              <span
                className="font-mono text-[10px] tabular-nums"
                style={{ color: active && accentColor ? accentColor : (accentColor || TONE_HEX.neutral) }}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── EmptyState ──────────────────────────────────────────────────────────────── */
export function EmptyState({
  icon: Icon, title, hint, tone = 'emerald',
}: {
  icon: React.ElementType; title: string; hint?: string; tone?: Tone;
}) {
  const color = TONE_HEX[tone];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{
          borderColor: `${color}25`,
          background: `${color}0d`,
          boxShadow: `0 0 24px -8px ${color}50`,
        }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </span>
      <div>
        <p className="text-[13px] font-semibold text-slate-200">{title}</p>
        {hint && (
          <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-slate-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── CircularProgress ────────────────────────────────────────────────────────── */
export function CircularProgress({
  value, max, size = 120, strokeWidth = 10, color, label, sublabel,
}: {
  value: number; max: number; size?: number; strokeWidth?: number;
  color: string; label?: string; sublabel?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dash = pct * circ;
  const cx2 = size / 2;
  const cy2 = size / 2;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-label={label}>
      {/* Track */}
      <circle
        cx={cx2} cy={cy2} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      {/* Arc */}
      <circle
        cx={cx2} cy={cy2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{
          filter: `drop-shadow(0 0 10px ${color}70)`,
          transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)',
        }}
      />
      {/* Text (counter-rotated) */}
      {label && (
        <g transform={`rotate(90 ${cx2} ${cy2})`}>
          <text
            x={cx2} y={cy2 - (sublabel ? 6 : 0)}
            textAnchor="middle" dominantBaseline="middle"
            fill="white"
            fontSize={Math.round(size * 0.18)}
            fontWeight="700"
            fontFamily="ui-monospace, monospace"
          >
            {label}
          </text>
          {sublabel && (
            <text
              x={cx2} y={cy2 + Math.round(size * 0.14)}
              textAnchor="middle" dominantBaseline="middle"
              fill="#64748b"
              fontSize={Math.round(size * 0.09)}
              fontWeight="600"
              letterSpacing="0.1em"
              fontFamily="system-ui, sans-serif"
            >
              {sublabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/* ── GlowButton ──────────────────────────────────────────────────────────────── */
export function GlowButton({
  onClick, disabled, children, variant = 'primary', size = 'md', className,
}: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const styles: Record<string, { bg: string; glow: string; text: string }> = {
    primary: {
      bg: 'linear-gradient(135deg, #6366f1 0%, #7C3AED 100%)',
      glow: '#7C3AED',
      text: 'text-white',
    },
    danger: {
      bg: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
      glow: '#f43f5e',
      text: 'text-white',
    },
    success: {
      bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      glow: '#10b981',
      text: 'text-slate-950',
    },
    warning: {
      bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      glow: '#f59e0b',
      text: 'text-slate-950',
    },
  };
  const heights: Record<string, string> = { sm: 'h-7 px-3 text-[11px]', md: 'h-9 px-4 text-[13px]', lg: 'h-11 px-5 text-[14px]' };
  const s = styles[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center gap-2 rounded-xl font-semibold transition-all',
        'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'hover:brightness-110',
        heights[size],
        s.text,
        className,
      )}
      style={{
        background: s.bg,
        boxShadow: disabled ? 'none' : `0 4px 20px -4px ${s.glow}60, 0 0 0 1px ${s.glow}30 inset`,
      }}
    >
      {children}
    </button>
  );
}

/* ── SectionDivider ──────────────────────────────────────────────────────────── */
export function SectionDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="h-px flex-1 bg-white/[0.05]" />
      {label && (
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-slate-600">
          {label}
        </span>
      )}
      <div className="h-px flex-1 bg-white/[0.05]" />
    </div>
  );
}

/* ── CommandCard ─────────────────────────────────────────────────────────────── */
export function CommandCard({
  label, value, sub, trend, sparkData, icon: Icon, accentColor, glowColor,
  children,
}: {
  label: string; value: string; sub?: string; trend?: number | null;
  sparkData?: number[]; icon: React.ElementType; accentColor: string;
  glowColor?: string; children?: React.ReactNode;
}) {
  const glow = glowColor || accentColor;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 flex flex-col gap-2 transition-all hover:scale-[1.015]"
      style={{
        background: 'rgba(7,15,30,0.88)',
        backdropFilter: 'blur(20px)',
        borderColor: `${glow}25`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.03) inset, 0 20px 48px -12px rgba(0,0,0,0.65), 0 0 60px -20px ${glow}30`,
      }}
    >
      {/* Ambient radial glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: `radial-gradient(ellipse 70% 60% at 85% 15%, ${glow}18, transparent)` }}
      />
      {/* Top: label + icon */}
      <div className="relative flex items-start justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: `${accentColor}18` }}
        >
          <Icon className="h-4 w-4" style={{ color: accentColor }} />
        </span>
      </div>
      {/* Value */}
      <div className="relative">
        <p
          className="font-mono text-[26px] font-bold leading-none tabular-nums"
          style={{ color: 'white' }}
        >
          {value}
        </p>
        {sub && (
          <p className="mt-1 text-[10.5px] text-slate-500">{sub}</p>
        )}
        {trend !== undefined && trend !== null && <div className="mt-1"><Delta value={trend} /></div>}
      </div>
      {sparkData && sparkData.length > 2 && (
        <div className="relative mt-auto">
          <Sparkline data={sparkData} color={accentColor} width={120} height={28} />
        </div>
      )}
      {children}
      {/* Bottom accent line */}
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accentColor}60, transparent 70%)` }}
      />
    </div>
  );
}

/* ── Sparkline ───────────────────────────────────────────────────────────────── */
export function Sparkline({
  data, color, width = 72, height = 24,
}: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data, min + 1);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / (max - min)) * (height - 4) - 2,
  ]);
  const d = `M ${pts.map((p) => p.join(',')).join(' L ')}`;
  const id = `sp-${color.replace('#', '')}-${width}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${width},${height} L 0,${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={last[0]} cy={last[1]} r="2.5"
        fill={color}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

/* ── Delta ───────────────────────────────────────────────────────────────────── */
export function Delta({
  value, suffix = 'vs prior',
}: {
  value?: number | null; suffix?: string;
}) {
  if (value === undefined || value === null || !isFinite(value)) {
    return <span className="text-[10.5px] text-slate-600">—</span>;
  }
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px]">
      <span
        className={cx(
          'font-semibold tabular-nums',
          flat ? 'text-slate-400' : up ? 'text-emerald-400' : 'text-rose-400',
        )}
      >
        {flat ? '0.0%' : `${up ? '▲' : '▼'} ${Math.abs(value).toFixed(1)}%`}
      </span>
      <span className="text-slate-600">{suffix}</span>
    </span>
  );
}

/* ── money ───────────────────────────────────────────────────────────────────── */
export const money = (n: number, code = 'NGN', compact = false) =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code || 'NGN',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number.isFinite(n) ? n : 0);
