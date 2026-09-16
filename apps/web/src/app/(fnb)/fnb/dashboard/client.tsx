'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  DollarSign,
  Loader2,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type RangeKey = 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'THIS_MONTH';

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: 'TODAY', label: 'Today' },
  { key: 'YESTERDAY', label: 'Yesterday' },
  { key: 'LAST_7', label: 'Last 7 days' },
  { key: 'THIS_MONTH', label: 'This month' },
];

const COLORS = ['#f97316', '#ea580c', '#f59e0b', '#dc2626', '#fb7185', '#7c2d12'];

const money = (value: unknown, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const number = (value: unknown) => new Intl.NumberFormat('en-NG').format(Number(value || 0));

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'orange',
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof DollarSign;
  tone?: 'orange' | 'brown' | 'amber' | 'red';
}) {
  const tones = {
    orange: 'bg-orange-50 text-orange-600',
    brown: 'bg-[#f7eee9] text-[#7c2d12]',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#876f63]">{label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#24130d]">{value}</p>
          <p className="mt-1 text-xs text-[#947d72]">{detail}</p>
        </div>
        <div className={`rounded-xl p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#24130d]">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-[#947d72]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function FnbAnalyticsClient() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const [range, setRange] = useState<RangeKey>('TODAY');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (quiet = false) => {
    if (!propertyId) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/fnb/dashboard/analytics?propertyId=${encodeURIComponent(propertyId)}&range=${range}`,
        { cache: 'no-store' },
      );
      const payload = await response.json();
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error?.message || 'Unable to load F&B analytics');
      }

      // The analytics endpoint uses the shared { success, data } API envelope.
      // Keep the fallback so older deployments returning the raw object still work.
      setData(payload?.data ?? payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load F&B analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (session?.user && propertyId) void load();
    // load is intentionally recreated with the selected period.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, propertyId, range]);

  const summary = data?.summary || {};
  const hourlyRevenue = data?.hourlyRevenue || [];
  const categoryRevenue = data?.categoryRevenue || [];
  const outletRevenue = (data?.outletRevenue || []).map((item: any) => ({
    ...item,
    outlet: item.outlet || item.name || 'Unknown outlet',
  }));
  const paymentMethods = data?.paymentMethods || [];
  const topItems = data?.topItems || {};
  const operationalMetrics = data?.operationalMetrics || {};
  const currency = summary.currency || 'NGN';

  const totalOutletRevenue = outletRevenue.reduce(
    (total: number, item: any) => total + Number(item.revenue || 0),
    0,
  );
  const bestOutlet = outletRevenue[0];
  const peakHour = [...hourlyRevenue].sort((a: any, b: any) => Number(b.revenue || 0) - Number(a.revenue || 0))[0];
  const exceptionCount =
    Number(operationalMetrics.voidCount || 0) +
    Number(operationalMetrics.unsettledOrders || 0) +
    Number(operationalMetrics.openSessions || 0);

  const categoryChart = useMemo(
    () => categoryRevenue.map((item: any) => ({
      ...item,
      name: item.category || item.name || 'Uncategorised',
      revenue: Number(item.revenue ?? item.value ?? 0),
    })),
    [categoryRevenue],
  );

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-[#7c2d12]">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading F&B command centre…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
        <button className="ml-4 font-semibold underline" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#fbf8f6] text-[#24130d]">
      <div className="border-b border-[#3d2318] bg-[#24130d] text-white">
        <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                <UtensilsCrossed className="h-4 w-4" /> F&B operations
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">F&B command centre</h1>
              <p className="mt-2 max-w-2xl text-sm text-orange-100/75">
                A live view of service performance, outlet contribution, menu demand, and controls that need a manager’s attention.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-white/15 bg-white/10 p-1">
                {ranges.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setRange(item.key)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      range === item.key ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-100/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => void load(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Gross revenue" value={money(summary.grossRevenue, currency)} detail="Before discounts and adjustments" icon={DollarSign} />
          <MetricCard label="Net revenue" value={money(summary.netRevenue, currency)} detail={`${number(summary.orders)} orders processed`} icon={TrendingUp} tone="brown" />
          <MetricCard label="Covers served" value={number(summary.covers)} detail={`Average check ${money(summary.averageCheck, currency)}`} icon={Users} tone="amber" />
          <MetricCard label="Open controls" value={number(exceptionCount)} detail="Items requiring review" icon={AlertTriangle} tone={exceptionCount ? 'red' : 'orange'} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <Panel title="Revenue by service hour" subtitle="Trading rhythm across the selected period" action={<BarChart3 className="h-5 w-5 text-orange-500" />}>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyRevenue} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fnbRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1e7e1" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: '#947d72', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#947d72', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value: any) => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value: any) => money(value, currency)} contentStyle={{ borderRadius: 12, borderColor: '#eadfd8' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={3} fill="url(#fnbRevenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Manager readout" subtitle="Signals from the selected trading window">
            <div className="space-y-4">
              <div className="rounded-xl bg-[#fff7ed] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-orange-700"><TrendingUp className="h-4 w-4" /> Peak trading</div>
                <p className="mt-2 text-lg font-bold text-[#24130d]">{peakHour?.hour || 'No activity yet'}</p>
                <p className="mt-1 text-xs text-[#947d72]">{peakHour ? `${money(peakHour.revenue, currency)} generated in this service hour.` : 'Revenue will appear as orders are posted.'}</p>
              </div>
              <div className="rounded-xl bg-[#f7eee9] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#7c2d12]"><ShoppingBag className="h-4 w-4" /> Leading outlet</div>
                <p className="mt-2 text-lg font-bold text-[#24130d]">{bestOutlet?.outlet || bestOutlet?.name || 'No outlet activity'}</p>
                <p className="mt-1 text-xs text-[#947d72]">{bestOutlet ? `${money(bestOutlet.revenue, currency)} of outlet revenue.` : 'No outlet has posted revenue in this period.'}</p>
              </div>
              <div className="flex items-center justify-between border-t border-[#f1e7e1] pt-4 text-sm">
                <span className="text-[#735c51]">Outlet contribution</span>
                <span className="font-bold text-[#24130d]">{totalOutletRevenue ? `${Math.round((Number(bestOutlet?.revenue || 0) / totalOutletRevenue) * 100)}%` : '0%'}</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Outlet performance" subtitle="Revenue contribution by service outlet">
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outletRevenue} layout="vertical" margin={{ top: 0, right: 10, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#f1e7e1" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="outlet" width={100} tick={{ fill: '#735c51', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: any) => money(value, currency)} contentStyle={{ borderRadius: 12, borderColor: '#eadfd8' }} />
                  <Bar dataKey="revenue" fill="#ea580c" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Payment mix" subtitle="Tender composition for reconciliation readiness">
            <div className="space-y-4">
              {paymentMethods.length ? paymentMethods.map((item: any, index: number) => {
                const total = paymentMethods.reduce((sum: number, method: any) => sum + Number(method.amount || method.revenue || 0), 0);
                const amount = Number(item.amount || item.revenue || 0);
                const percentage = total ? Math.round((amount / total) * 100) : 0;
                return (
                  <div key={item.method || item.name || index}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="font-semibold text-[#4f392f]">{item.method || item.name || 'Other'}</span>
                      <span className="text-[#947d72]">{money(amount, currency)} · {percentage}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#f4ebe6]"><div className="h-full rounded-full bg-orange-500" style={{ width: `${percentage}%` }} /></div>
                  </div>
                );
              }) : <p className="py-12 text-center text-sm text-[#947d72]">No payment activity for this period.</p>}
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Panel title="F&B class revenue" subtitle="Category mix for menu and pricing decisions">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <div className="h-[190px] w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryChart} dataKey="revenue" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none">
                      {categoryChart.map((item: any, index: number) => <Cell key={item.name || index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: any) => money(value, currency)} contentStyle={{ borderRadius: 12, borderColor: '#eadfd8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-2 sm:w-1/2">
                {categoryChart.slice(0, 6).map((item: any, index: number) => <div key={item.name || index} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 text-[#735c51]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /> <span className="truncate">{item.name}</span></span><span className="font-semibold text-[#24130d]">{money(item.revenue, currency)}</span></div>)}
                {!categoryChart.length ? <p className="text-sm text-[#947d72]">No category activity yet.</p> : null}
              </div>
            </div>
          </Panel>

          <Panel title="Menu leaders" subtitle="Items driving demand and revenue">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-[#f1e7e1] text-[11px] uppercase tracking-[0.1em] text-[#947d72]"><tr><th className="pb-3 font-semibold">Menu item</th><th className="pb-3 text-right font-semibold">Qty</th><th className="pb-3 text-right font-semibold">Revenue</th></tr></thead>
                <tbody className="divide-y divide-[#f5eee9]">
                  {(topItems.byRevenue || topItems.revenue || []).slice(0, 6).map((item: any, index: number) => <tr key={item.name || item.itemName || index}><td className="py-3 font-semibold text-[#4f392f]">{item.name || item.itemName || 'Menu item'}</td><td className="py-3 text-right text-[#735c51]">{number(item.quantity || item.qty)}</td><td className="py-3 text-right font-semibold text-[#24130d]">{money(item.revenue, currency)}</td></tr>)}
                  {!(topItems.byRevenue || topItems.revenue || []).length ? <tr><td colSpan={3} className="py-10 text-center text-sm text-[#947d72]">No menu activity yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <Panel title="Operational controls" subtitle="Keep the service day clean before closeout">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex items-center gap-3 rounded-xl border border-[#f1e7e1] p-4"><AlertTriangle className="h-5 w-5 text-red-500" /><div><p className="text-xs text-[#947d72]">Voided orders</p><p className="mt-1 font-bold text-[#24130d]">{number(operationalMetrics.voidCount)}</p></div></div>
            <div className="flex items-center gap-3 rounded-xl border border-[#f1e7e1] p-4"><WalletCards className="h-5 w-5 text-orange-500" /><div><p className="text-xs text-[#947d72]">Discounts</p><p className="mt-1 font-bold text-[#24130d]">{money(operationalMetrics.discounts, currency)}</p></div></div>
            <div className="flex items-center gap-3 rounded-xl border border-[#f1e7e1] p-4"><Clock3 className="h-5 w-5 text-amber-500" /><div><p className="text-xs text-[#947d72]">Unsettled orders</p><p className="mt-1 font-bold text-[#24130d]">{number(operationalMetrics.unsettledOrders)}</p></div></div>
            <div className="flex items-center gap-3 rounded-xl border border-[#f1e7e1] p-4"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><div><p className="text-xs text-[#947d72]">Open sessions</p><p className="mt-1 font-bold text-[#24130d]">{number(operationalMetrics.openSessions)}</p></div></div>
          </div>
        </Panel>
      </main>
    </div>
  );
}
