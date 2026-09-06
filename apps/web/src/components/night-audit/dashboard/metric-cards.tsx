import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Banknote, Users, ArrowUpRight, ArrowDownRight, Minus, BedDouble } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

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

  const chartData = (data.analytics.trend || []).map((t) => {
    let dateStr = 'N/A';
    try {
      const d = new Date(t.businessDate);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }
    } catch (e) {
      // ignore
    }
    
    // Default to putting all revenue in "Rooms" if financialSnapshot is missing (legacy audits)
    const roomRevenue = t.financialSnapshot ? Number(t.financialSnapshot.roomRevenue) : Number(t.totalRevenue);
    const fnbRevenue = t.financialSnapshot ? Number(t.financialSnapshot.fnbRevenue) : 0;
    const otherRevenue = t.financialSnapshot ? Number(t.financialSnapshot.otherRevenue) : 0;
    
    return {
      date: dateStr,
      revenue: Number(t.totalRevenue) || 0,
      roomRevenue,
      fnbRevenue,
      otherRevenue,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-white/20 bg-white/95 p-4 shadow-xl backdrop-blur-md">
          <p className="mb-3 font-semibold text-slate-800">{label}</p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm font-medium text-slate-600">{entry.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {currency(entry.value, baseCurrency)}
                </span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between gap-6 border-t border-slate-100 pt-2">
              <span className="text-sm font-semibold text-slate-800">Total</span>
              <span className="text-sm font-bold text-indigo-600">
                {currency(payload.reduce((sum: number, entry: any) => sum + entry.value, 0), baseCurrency)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border border-slate-200/70 bg-white/80 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Gross Revenue Breakdown</p>
              <h2 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                {currency(revenue, baseCurrency)}
              </h2>
              {revTrend !== undefined && (
                <div className="mt-3 flex items-center gap-2 text-sm font-medium">
                  {revTrend > 0 ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                        <ArrowUpRight className="h-4 w-4" />
                        {revTrend.toFixed(1)}%
                      </span>
                      <span className="text-slate-400">vs yesterday</span>
                    </>
                  ) : revTrend < 0 ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-700">
                        <ArrowDownRight className="h-4 w-4" />
                        {Math.abs(revTrend).toFixed(1)}%
                      </span>
                      <span className="text-slate-400">vs yesterday</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                        <Minus className="h-4 w-4" />
                        0.0%
                      </span>
                      <span className="text-slate-400">no change</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  dy={10} 
                />
                <YAxis 
                  hide 
                  domain={[0, 'dataMax + (dataMax * 0.1)']} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                <Bar dataKey="roomRevenue" name="Rooms" stackId="a" fill="#4f46e5" radius={[0, 0, 4, 4]} />
                <Bar dataKey="fnbRevenue" name="F&B" stackId="a" fill="#f59e0b" />
                <Bar dataKey="otherRevenue" name="Other" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
    </div>
  );
}
