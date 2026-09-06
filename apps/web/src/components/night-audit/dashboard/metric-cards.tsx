import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Banknote, Users, ArrowUpRight, ArrowDownRight, Minus, CircleDollarSign, BedDouble } from 'lucide-react';

const currency = (value: number, code = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: number;
  icon: React.ElementType;
  tone?: 'default' | 'rose' | 'emerald' | 'amber' | 'indigo';
}

function Metric({ label, value, subtext, trend, icon: Icon, tone = 'default' }: MetricCardProps) {
  const iconColors = {
    default: 'bg-slate-100 text-slate-700',
    rose: 'bg-rose-100 text-rose-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <Card className="relative overflow-hidden border border-slate-200/70 bg-white/80 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</h3>
            {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconColors[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {trend !== undefined && (
          <div className="mt-4 flex items-center gap-2 text-xs font-medium">
            {trend > 0 ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {trend.toFixed(1)}%
                </span>
                <span className="text-slate-400">vs yesterday</span>
              </>
            ) : trend < 0 ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-700">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  {Math.abs(trend).toFixed(1)}%
                </span>
                <span className="text-slate-400">vs yesterday</span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                  <Minus className="h-3.5 w-3.5" />
                  0.0%
                </span>
                <span className="text-slate-400">no change</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricCards({ data }: { data: NightAuditData }) {
  const baseCurrency = data.property.baseCurrency;

  const revenue = data.analytics.revenue || 0;
  const payments = data.analytics.payments || 0;
  const inHouseGuests = data.analytics.inHouseGuests || 0;
  const occupied = data.analytics.rooms?.occupied || 0;
  const totalRooms = data.analytics.rooms?.total || 0;
  const openSessions = (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0);

  const adr = occupied > 0 ? revenue / occupied : 0;
  const revpar = totalRooms > 0 ? revenue / totalRooms : 0;

  let revTrend: number | undefined;
  let adrTrend: number | undefined;
  let revparTrend: number | undefined;

  if (data.analytics.trend && data.analytics.trend.length >= 2) {
    const previous = data.analytics.trend[data.analytics.trend.length - 1];
    const yRev = Number(previous.totalRevenue) || 0;
    const yAdr = Number(previous.adr) || 0;
    const yRevpar = Number(previous.revpar) || 0;

    if (yRev > 0) revTrend = ((revenue - yRev) / yRev) * 100;
    if (yAdr > 0) adrTrend = ((adr - yAdr) / yAdr) * 100;
    if (yRevpar > 0) revparTrend = ((revpar - yRevpar) / yRevpar) * 100;
  }

  const lastAuditRevenue = data.analytics.trend && data.analytics.trend.length > 0
    ? Number(data.analytics.trend[data.analytics.trend.length - 1].totalRevenue) || 0
    : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <Metric
        label="Revenue"
        value={currency(revenue, baseCurrency)}
        subtext="Current business day"
        trend={revTrend}
        icon={CircleDollarSign}
        tone="emerald"
      />
      <Metric
        label="Last Audit"
        value={currency(lastAuditRevenue, baseCurrency)}
        subtext="Previous close"
        icon={TrendingUp}
        tone="default"
      />
      <Metric
        label="Payments"
        value={currency(payments, baseCurrency)}
        subtext="Captured today"
        icon={Banknote}
        tone="indigo"
      />
      <Metric
        label="ADR"
        value={currency(adr, baseCurrency)}
        subtext={`${occupied} occupied rooms`}
        trend={adrTrend}
        icon={TrendingUp}
        tone="amber"
      />
      <Metric
        label="RevPAR"
        value={currency(revpar, baseCurrency)}
        subtext={`${totalRooms} total rooms`}
        trend={revparTrend}
        icon={BedDouble}
        tone="default"
      />
      <Metric
        label="In-house"
        value={inHouseGuests}
        subtext={`${openSessions} open sessions`}
        icon={Users}
        tone="indigo"
      />
    </div>
  );
}
