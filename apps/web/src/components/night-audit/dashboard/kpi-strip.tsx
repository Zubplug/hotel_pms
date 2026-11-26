'use client';
import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import {
  BedDouble, TrendingUp, CreditCard, AlertOctagon, Users, DollarSign,
} from 'lucide-react';
import { Sparkline, Delta, money, cx } from './ui';

interface Tile {
  id: string;
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  spark?: number[];
  icon: React.ElementType;
  accentColor: string;
  isAlert?: boolean;
}

export function KpiStrip({ data }: { data: NightAuditData }) {
  const cur = data.property.baseCurrency;
  const trend = data.analytics.trend || [];
  const last = trend[trend.length - 1];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;

  const revenue = last ? Number(last.totalRevenue) : data.analytics.revenue || 0;
  const prevRevenue = prev ? Number(prev.totalRevenue) : null;
  const adr = last ? Number(last.adr) : 0;
  const prevAdr = prev ? Number(prev.adr) : null;
  const revpar = last ? Number(last.revpar) : 0;
  const prevRevpar = prev ? Number(prev.revpar) : null;
  const occ = last
    ? Math.round(Number(last.occupancy))
    : data.analytics.rooms?.total
    ? Math.round((data.analytics.rooms.occupied / data.analytics.rooms.total) * 100)
    : 0;

  const delta = (a: number | null, b: number | null) =>
    a !== null && b !== null && b > 0 ? ((a - b) / b) * 100 : null;

  const sparkVals = (key: 'totalRevenue' | 'adr' | 'revpar') =>
    trend.map((t) => Number(t[key]) || 0).slice(-7);

  const occColor =
    occ >= 80 ? '#10B981' : occ >= 60 ? '#818cf8' : occ >= 40 ? '#fbbf24' : '#fb7185';
  const cashVariance = data.analytics.cashVariance;
  const varianceColor =
    cashVariance === 0 ? '#34d399' : cashVariance > 0 ? '#fbbf24' : '#fb7185';

  const tiles: Tile[] = [
    {
      id: 'occ', label: 'Occupancy', value: `${occ}%`,
      sub: `${data.analytics.rooms?.occupied ?? 0} / ${data.analytics.rooms?.total ?? 0} rms`,
      icon: BedDouble, accentColor: occColor,
    },
    {
      id: 'adr', label: 'ADR', value: money(adr, cur, true),
      delta: delta(adr, prevAdr), spark: sparkVals('adr'),
      icon: TrendingUp, accentColor: '#818cf8',
    },
    {
      id: 'revpar', label: 'RevPAR', value: money(revpar, cur, true),
      delta: delta(revpar, prevRevpar), spark: sparkVals('revpar'),
      icon: DollarSign, accentColor: '#06B6D4',
    },
    {
      id: 'rev', label: 'Net Revenue', value: money(revenue, cur, true),
      delta: delta(revenue, prevRevenue), spark: sparkVals('totalRevenue'),
      icon: TrendingUp, accentColor: '#34d399',
    },
    {
      id: 'pay', label: 'Payments', value: money(data.analytics.payments, cur, true),
      sub: 'Captured today', icon: CreditCard, accentColor: '#a78bfa',
    },
    {
      id: 'var', label: 'Cash Variance',
      value: money(Math.abs(cashVariance), cur, true),
      sub: cashVariance === 0 ? 'Balanced' : cashVariance > 0 ? 'Over' : 'Short',
      icon: AlertOctagon, accentColor: varianceColor, isAlert: cashVariance !== 0,
    },
    {
      id: 'guests', label: 'In-house', value: String(data.analytics.inHouseGuests),
      sub: 'Registered guests', icon: Users, accentColor: '#38bdf8',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {tiles.map((t) => {
        const Icon = t.icon;
        const color = t.accentColor;
        return (
          <div
            key={t.id}
            className="relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'rgba(7,15,30,0.88)',
              backdropFilter: 'blur(20px)',
              borderColor: `${color}25`,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.03) inset, 0 16px 40px -12px rgba(0,0,0,0.65), 0 0 50px -20px ${color}28`,
              minHeight: 108,
            }}
          >
            {/* Ambient radial glow */}
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background: `radial-gradient(ellipse 70% 60% at 85% 20%, ${color}18, transparent)`,
              }}
            />

            <div className="relative flex flex-col flex-1 p-3.5 gap-2">
              {/* Top row: label + icon */}
              <div className="flex items-start justify-between">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {t.label}
                </span>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-xl"
                  style={{ background: `${color}18` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </span>
              </div>

              {/* Value */}
              <div className="flex-1">
                <p
                  className={cx(
                    'font-mono font-bold leading-none tabular-nums',
                    t.id === 'guests' ? 'text-[26px]' : 'text-[22px]',
                  )}
                  style={{ color: t.isAlert ? color : 'white' }}
                >
                  {t.value}
                </p>
                {t.sub && (
                  <p className="mt-1 text-[10px] text-slate-500">{t.sub}</p>
                )}
                {t.delta !== undefined && (
                  <div className="mt-1">
                    <Delta value={t.delta} />
                  </div>
                )}
              </div>

              {/* Sparkline */}
              {t.spark && t.spark.length > 2 && (
                <div className="mt-auto">
                  <Sparkline data={t.spark} color={color} width={110} height={26} />
                </div>
              )}
            </div>

            {/* Bottom accent line */}
            <div
              className="absolute bottom-0 inset-x-0 h-[2px] rounded-b-2xl"
              style={{ background: `linear-gradient(90deg, ${color}70, ${color}20 60%, transparent)` }}
            />
          </div>
        );
      })}
    </div>
  );
}
