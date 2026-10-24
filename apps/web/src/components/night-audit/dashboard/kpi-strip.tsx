'use client';
import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import {
  BedDouble, TrendingUp, CreditCard, AlertOctagon, Users, DollarSign,
  ArrowUpRight, ArrowDownRight,
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
  color: string;
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
  const occ = last ? Math.round(Number(last.occupancy)) : (data.analytics.rooms?.total ? Math.round((data.analytics.rooms.occupied / data.analytics.rooms.total) * 100) : 0);

  const delta = (a: number | null, b: number | null) =>
    a !== null && b !== null && b > 0 ? ((a - b) / b) * 100 : null;

  const sparkVals = (key: 'totalRevenue' | 'adr' | 'revpar') =>
    trend.map((t) => Number(t[key]) || 0).slice(-7);

  const tiles: Tile[] = [
    {
      id: 'occ', label: 'Occupancy', value: `${occ}%`,
      sub: `${data.analytics.rooms?.occupied ?? 0} / ${data.analytics.rooms?.total ?? 0} rms`,
      icon: BedDouble, color: occ >= 80 ? '#34d399' : occ >= 60 ? '#818cf8' : '#fbbf24',
    },
    {
      id: 'adr', label: 'ADR', value: money(adr, cur, true),
      delta: delta(adr, prevAdr),
      spark: sparkVals('adr'),
      icon: TrendingUp, color: '#818cf8',
    },
    {
      id: 'revpar', label: 'RevPAR', value: money(revpar, cur, true),
      delta: delta(revpar, prevRevpar),
      spark: sparkVals('revpar'),
      icon: DollarSign, color: '#38bdf8',
    },
    {
      id: 'rev', label: 'Net Revenue', value: money(revenue, cur, true),
      delta: delta(revenue, prevRevenue),
      spark: sparkVals('totalRevenue'),
      icon: TrendingUp, color: '#34d399',
    },
    {
      id: 'pay', label: 'Payments', value: money(data.analytics.payments, cur, true),
      sub: 'Captured today',
      icon: CreditCard, color: '#a78bfa',
    },
    {
      id: 'var', label: 'Cash Variance', value: money(Math.abs(data.analytics.cashVariance), cur, true),
      sub: data.analytics.cashVariance === 0 ? 'Balanced' : data.analytics.cashVariance > 0 ? 'Over' : 'Short',
      icon: AlertOctagon,
      color: data.analytics.cashVariance === 0 ? '#34d399' : data.analytics.cashVariance > 0 ? '#fbbf24' : '#fb7185',
    },
    {
      id: 'guests', label: 'In-house', value: String(data.analytics.inHouseGuests),
      sub: 'Registered guests',
      icon: Users, color: '#38bdf8',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {tiles.map((t) => {
        const Icon = t.icon;
        const isVariance = t.id === 'var';
        const varianceNeutral = isVariance && data.analytics.cashVariance === 0;
        return (
          <div
            key={t.id}
            className="flex flex-col justify-between rounded-xl border border-white/[0.07] bg-[#0b111e]/90 px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-colors hover:border-white/[0.12]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-slate-500">{t.label}</span>
              <Icon className="h-3.5 w-3.5" style={{ color: t.color }} />
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="font-mono text-[17px] font-bold tabular-nums leading-none"
                  style={{ color: isVariance && !varianceNeutral ? t.color : 'white' }}
                >
                  {t.value}
                </p>
                {t.sub && <p className="mt-0.5 text-[10.5px] text-slate-500">{t.sub}</p>}
                {t.delta !== undefined && <Delta value={t.delta} />}
              </div>
              {t.spark && t.spark.length > 2 && (
                <Sparkline data={t.spark} color={t.color} width={52} height={22} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
