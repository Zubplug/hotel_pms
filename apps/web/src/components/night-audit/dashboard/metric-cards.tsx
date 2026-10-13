import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import {
  TrendingUp, Banknote, Users, ArrowUpRight, ArrowDownRight,
  Minus, BedDouble, CalendarDays, CreditCard, Tag, Percent
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from 'recharts';

const currency = (value: number, code = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

const REVENUE_SERIES = [
  { key: 'roomRevenue', name: 'Rooms', color: '#6366f1' },
  { key: 'fnbRevenue', name: 'F&B / POS', color: '#f59e0b' },
  { key: 'eventFoodRevenue', name: 'Event Food', color: '#fb923c' },
  { key: 'poolRevenue', name: 'Recreation / Pool', color: '#38bdf8' },
  { key: 'eventHallRevenue', name: 'Event Hall', color: '#ec4899' },
  { key: 'eventEquipmentRevenue', name: 'Event Equipment', color: '#f472b6' },
  { key: 'spaRevenue', name: 'Spa', color: '#14b8a6' },
  { key: 'laundryRevenue', name: 'Laundry', color: '#2dd4bf' },
  { key: 'transportRevenue', name: 'Transport', color: '#84cc16' },
  { key: 'telephoneRevenue', name: 'Telephone', color: '#eab308' },
  { key: 'internetRevenue', name: 'Internet', color: '#06b6d4' },
  { key: 'minibarRevenue', name: 'Minibar', color: '#f97316' },
  { key: 'cityLedgerRevenue', name: 'City Ledger', color: '#64748b' },
  { key: 'manualRevenue', name: 'Manual Revenue', color: '#94a3b8' },
  { key: 'otherRevenue', name: 'Other', color: '#10b981' },
  { key: 'serviceChargeRevenue', name: 'Service Charge', color: '#a78bfa' },
] as const;

function revenueBreakdown(audit: any) {
  const fallback = audit?.financialSnapshot || {};
  const rows = audit?.closePackage?.controlSummary?.departmentReconciliation;
  if (!Array.isArray(rows)) {
    return {
      roomRevenue: Number(fallback.roomRevenue || 0),
      fnbRevenue: Number(fallback.fnbRevenue || 0),
      eventFoodRevenue: 0,
      poolRevenue: 0,
      eventHallRevenue: 0,
      eventEquipmentRevenue: 0,
      spaRevenue: 0,
      laundryRevenue: 0,
      transportRevenue: 0,
      telephoneRevenue: 0,
      internetRevenue: 0,
      minibarRevenue: 0,
      cityLedgerRevenue: 0,
      manualRevenue: 0,
      otherRevenue: Number(fallback.otherRevenue || 0),
      serviceChargeRevenue: 0,
    };
  }

  const valueFor = (department: string) => Number(rows.find((row: any) => row.department === department)?.source || 0);
  const departmentValues: Record<string, number> = {
    Spa: valueFor('Spa'),
    Laundry: valueFor('Laundry'),
    Transport: valueFor('Transport'),
    Telephone: valueFor('Telephone'),
    Internet: valueFor('Internet'),
    Minibar: valueFor('Minibar'),
    'City Ledger': valueFor('City Ledger'),
    'Manual Revenue': valueFor('Manual Revenue'),
  };
  return {
    roomRevenue: valueFor('Rooms'),
    fnbRevenue: valueFor('F&B/POS'),
    eventFoodRevenue: valueFor('Event Food'),
    poolRevenue: valueFor('Recreation/Pool'),
    eventHallRevenue: valueFor('Event Hall'),
    eventEquipmentRevenue: valueFor('Event Equipment'),
    otherRevenue: valueFor('Other'),
    serviceChargeRevenue: valueFor('Service Charge'),
    spaRevenue: departmentValues.Spa,
    laundryRevenue: departmentValues.Laundry,
    transportRevenue: departmentValues.Transport,
    telephoneRevenue: departmentValues.Telephone,
    internetRevenue: departmentValues.Internet,
    minibarRevenue: departmentValues.Minibar,
    cityLedgerRevenue: departmentValues['City Ledger'],
    manualRevenue: departmentValues['Manual Revenue'],
  };
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: number;
  icon: React.ElementType;
  tone?: 'default' | 'rose' | 'emerald' | 'amber' | 'indigo' | 'violet' | 'sky';
}

const toneMap = {
  default: { icon: 'border-slate-600/40 bg-slate-600/15 text-slate-300', value: 'text-white' },
  rose: { icon: 'border-rose-400/30 bg-rose-400/10 text-rose-400', value: 'text-white' },
  emerald: { icon: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400', value: 'text-white' },
  amber: { icon: 'border-amber-400/30 bg-amber-400/10 text-amber-400', value: 'text-white' },
  indigo: { icon: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-400', value: 'text-white' },
  violet: { icon: 'border-violet-400/30 bg-violet-400/10 text-violet-400', value: 'text-white' },
  sky: { icon: 'border-sky-400/30 bg-sky-400/10 text-sky-400', value: 'text-white' },
};

function Metric({ label, value, subtext, trend, icon: Icon, tone = 'default' }: MetricCardProps) {
  const tc = toneMap[tone];
  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-slate-200/[0.06] bg-white/[0.03] p-4 backdrop-blur-md transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.1]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <h3 className={`mt-2.5 text-xl font-bold tracking-tight ${tc.value}`}>{value}</h3>
          {subtext && <p className="mt-1 text-[11px] text-slate-500">{subtext}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tc.icon}`}>
          <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
          {trend > 0 ? (
            <>
              <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
                <ArrowUpRight className="h-3 w-3" />{trend.toFixed(1)}%
              </span>
              <span className="text-slate-600">vs prior</span>
            </>
          ) : trend < 0 ? (
            <>
              <span className="inline-flex items-center gap-0.5 rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 text-rose-300">
                <ArrowDownRight className="h-3 w-3" />{Math.abs(trend).toFixed(1)}%
              </span>
              <span className="text-slate-600">vs prior</span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-0.5 rounded-full border border-slate-600/30 bg-slate-600/10 px-2 py-0.5 text-slate-400">
                <Minus className="h-3 w-3" />0.0%
              </span>
              <span className="text-slate-600">no change</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const DarkTooltip = ({ active, payload, label, baseCurrency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-xl" style={{ background: 'rgba(10,14,26,0.95)' }}>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="text-xs font-medium text-slate-300">{entry.name}</span>
              </div>
              <span className="text-xs font-bold text-white">{currency(entry.value, baseCurrency)}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between gap-6 border-t border-white/10 pt-2">
            <span className="text-xs font-semibold text-slate-300">Total</span>
            <span className="text-xs font-bold text-indigo-300">
              {currency(payload.reduce((s: number, e: any) => s + e.value, 0), baseCurrency)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function MetricCards({ data }: { data: NightAuditData }) {
  const baseCurrency = data.property.baseCurrency;
  const currentSnapshot = data.financialSnapshot || data.currentAudit?.financialSnapshot;
  const trendData = data.analytics.trend || [];
  const lastAudit = trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const previousAudit = trendData.length > 1 ? trendData[trendData.length - 2] : null;

  const revenue = lastAudit ? Number(lastAudit.totalRevenue) : (data.analytics.revenue || 0);
  const adr = lastAudit ? Number(lastAudit.adr) : 0;
  const revpar = lastAudit ? Number(lastAudit.revpar) : 0;
  const totalRooms = data.analytics.rooms?.total || 0;
  const occupied = lastAudit
    ? Math.round((Number(lastAudit.occupancy) / 100) * totalRooms)
    : (data.analytics.rooms?.occupied || 0);
  const payments = data.analytics.payments || 0;
  const inHouseGuests = data.analytics.inHouseGuests || 0;
  const openSessions = (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0);

  let revTrend: number | undefined;
  let adrTrend: number | undefined;
  let revparTrend: number | undefined;

  if (lastAudit && previousAudit) {
    const pRev = Number(previousAudit.totalRevenue) || 0;
    const pAdr = Number(previousAudit.adr) || 0;
    const pRevpar = Number(previousAudit.revpar) || 0;
    if (pRev > 0) revTrend = ((revenue - pRev) / pRev) * 100;
    if (pAdr > 0) adrTrend = ((adr - pAdr) / pAdr) * 100;
    if (pRevpar > 0) revparTrend = ((revpar - pRevpar) / pRevpar) * 100;
  }

  const previousAuditRevenue = previousAudit ? Number(previousAudit.totalRevenue) : 0;

  const chartData = trendData.map((t) => {
    let dateStr = 'N/A';
    try {
      const d = new Date(t.businessDate);
      if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { /* ignore */ }
    return {
      date: dateStr,
      revenue: Number(t.totalRevenue) || 0,
      ...revenueBreakdown(t),
    };
  });

  const currentRevenue = revenueBreakdown({
    financialSnapshot: currentSnapshot || lastAudit?.financialSnapshot,
    closePackage: data.currentAudit?.closePackage || lastAudit?.closePackage,
  });

  return (
    <div className="space-y-5">
      {/* Revenue Hero + Chart */}
      <div className="rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-6 backdrop-blur-md sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Gross Revenue — Last Audit</p>
            <h2 className="mt-2.5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {currency(revenue, baseCurrency)}
            </h2>
            {revTrend !== undefined && (
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
                {revTrend > 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
                      <ArrowUpRight className="h-4 w-4" />{revTrend.toFixed(1)}%
                    </span>
                    <span className="text-slate-500">vs prior audit</span>
                  </>
                ) : revTrend < 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-rose-300">
                      <ArrowDownRight className="h-4 w-4" />{Math.abs(revTrend).toFixed(1)}%
                    </span>
                    <span className="text-slate-500">vs prior audit</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/30 bg-slate-600/10 px-2.5 py-1 text-slate-400">
                    <Minus className="h-4 w-4" />No change
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
              <YAxis hide domain={[0, 'dataMax + (dataMax * 0.15)']} />
              <Tooltip content={<DarkTooltip baseCurrency={baseCurrency} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#94a3b8' }} />
              {REVENUE_SERIES.map((series, index) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.name}
                  stackId="a"
                  fill={series.color}
                  radius={index === REVENUE_SERIES.length - 1 ? [4, 4, 0, 0] : index === 0 ? [0, 0, 4, 4] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Metric
          label="Room Revenue"
          value={currency(currentRevenue.roomRevenue, baseCurrency)}
          subtext="Last completed audit"
          icon={BedDouble}
          tone="indigo"
        />
        <Metric
          label="F&B / POS"
          value={currency(currentRevenue.fnbRevenue, baseCurrency)}
          subtext="Food and beverage"
          icon={Banknote}
          tone="amber"
        />
        <Metric
          label="Other Revenue"
          value={currency(
            currentRevenue.eventFoodRevenue + currentRevenue.poolRevenue + currentRevenue.eventHallRevenue
              + currentRevenue.eventEquipmentRevenue + currentRevenue.otherRevenue + currentRevenue.serviceChargeRevenue
              + currentRevenue.spaRevenue + currentRevenue.laundryRevenue + currentRevenue.transportRevenue
              + currentRevenue.telephoneRevenue + currentRevenue.internetRevenue + currentRevenue.minibarRevenue
              + currentRevenue.cityLedgerRevenue + currentRevenue.manualRevenue,
            baseCurrency,
          )}
          subtext="Events and ancillary revenue"
          icon={TrendingUp}
          tone="emerald"
        />
        <Metric
          label="Taxes"
          value={currency(currentSnapshot?.taxes ?? (lastAudit?.financialSnapshot ? Number(lastAudit.financialSnapshot.taxes) : 0), baseCurrency)}
          subtext="Posted tax total"
          icon={Percent}
          tone="default"
        />
        <Metric
          label="Prior Audit"
          value={currency(previousAuditRevenue, baseCurrency)}
          subtext="Day before last"
          icon={CalendarDays}
          tone="default"
        />
        <Metric
          label="Payments"
          value={currency(payments, baseCurrency)}
          subtext="Captured today"
          icon={CreditCard}
          tone="indigo"
        />
        <Metric
          label="Refunds"
          value={currency(currentSnapshot?.refunds ?? (lastAudit?.financialSnapshot ? Number(lastAudit.financialSnapshot.refunds) : 0), baseCurrency)}
          subtext="Posted refunds"
          icon={ArrowDownRight}
          tone="rose"
        />
        <Metric
          label="Discounts"
          value={currency(currentSnapshot?.discounts ?? (lastAudit?.financialSnapshot ? Number(lastAudit.financialSnapshot.discounts) : 0), baseCurrency)}
          subtext="Applied discounts"
          icon={Tag}
          tone="amber"
        />
        <Metric
          label="ADR (Last)"
          value={currency(adr, baseCurrency)}
          subtext={`${occupied} occupied rooms`}
          trend={adrTrend}
          icon={TrendingUp}
          tone="violet"
        />
        <Metric
          label="RevPAR (Last)"
          value={currency(revpar, baseCurrency)}
          subtext={`${totalRooms} total rooms`}
          trend={revparTrend}
          icon={BedDouble}
          tone="sky"
        />
        <Metric
          label="In-house"
          value={inHouseGuests}
          subtext={`${openSessions} open sessions`}
          icon={Users}
          tone="indigo"
        />
      </div>
    </div>
  );
}
