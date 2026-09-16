'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChefHat,
  ChevronRight,
  Clock3,
  LayoutGrid,
  List,
  Loader2,
  Receipt,
  Search,
  Timer,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';

type OrderStatus = 'SUBMITTED' | 'IN_SERVICE' | 'BILLED' | 'SETTLED' | 'CANCELLED';
type BatchStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED';
type ViewMode = 'board' | 'list';
type FilterKey = 'ALL' | 'SUBMITTED' | 'PREPARING' | 'READY' | 'SERVED';

interface ProductionBatch {
  id: string;
  status: BatchStatus;
  firedAt: string;
  events: { fromStatus: BatchStatus; toStatus: BatchStatus; createdAt: string }[];
}

interface PosOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  table?: { name: string };
  tableNumber?: string;
  serverStaff?: { firstName: string; lastName: string };
  items: { id: string; productName: string; quantity: number; unitPrice: number; status?: string; modifiers: any[] }[];
  productionBatches: ProductionBatch[];
}

const money = (value: unknown) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));

const minutesSince = (value: string) => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));

const personName = (order: PosOrder) =>
  order.serverStaff ? `${order.serverStaff.firstName} ${order.serverStaff.lastName || ''}`.trim() : 'Unassigned';

const locationName = (order: PosOrder) => order.table?.name || order.tableNumber || 'Walk-in';

const getStage = (order: PosOrder): Exclude<FilterKey, 'ALL'> => {
  const batches = order.productionBatches || [];
  if (!batches.length) return order.status === 'SUBMITTED' ? 'SUBMITTED' : 'SERVED';
  if (order.status === 'IN_SERVICE' || batches.every((batch) => batch.status === 'COMPLETED')) return 'SERVED';
  if (batches.some((batch) => batch.status === 'PREPARING')) return 'PREPARING';
  if (batches.every((batch) => batch.status === 'READY' || batch.status === 'COMPLETED')) return 'READY';
  return 'SUBMITTED';
};

function StagePill({ stage }: { stage: Exclude<FilterKey, 'ALL'> }) {
  const styles = {
    SUBMITTED: 'border-orange-200 bg-orange-50 text-orange-700',
    PREPARING: 'border-amber-200 bg-amber-50 text-amber-700',
    READY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    SERVED: 'border-[#eadfd8] bg-[#f7eee9] text-[#7c2d12]',
  };
  const labels = { SUBMITTED: 'Submitted', PREPARING: 'Preparing', READY: 'Ready', SERVED: 'In service' };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${styles[stage]}`}>{labels[stage]}</span>;
}

function Elapsed({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(() => minutesSince(createdAt));
  useEffect(() => {
    const interval = setInterval(() => setElapsed(minutesSince(createdAt)), 15000);
    return () => clearInterval(interval);
  }, [createdAt]);
  const tone = elapsed >= 25 ? 'text-red-600' : elapsed >= 15 ? 'text-amber-600' : 'text-[#806b60]';
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}><Clock3 className="h-3.5 w-3.5" />{elapsed}m</span>;
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Users; tone: string }) {
  return (
    <div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-[#24130d]">{value}</p><p className="mt-1 text-xs text-[#927b70]">{detail}</p></div>
        <span className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></span>
      </div>
    </div>
  );
}

function OrderDrawer({ order, businessDate, onClose, onRefresh }: { order: PosOrder; businessDate: string; onClose: () => void; onRefresh: () => void }) {
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const stage = getStage(order);

  const cancelOrder = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/fnb/orders/${order.id}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, businessDate }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to cancel order');
      setShowCancel(false); onClose(); onRefresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to cancel order');
    } finally { setSaving(false); }
  };

  return (
    <>
      {showCancel ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#24130d]/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#eadfd8] bg-white shadow-2xl">
            <div className="border-b border-[#f1e7e1] bg-[#fff7ed] p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">Destructive action</p><h3 className="mt-2 text-xl font-bold text-[#24130d]">Cancel order {order.orderNumber}?</h3><p className="mt-2 text-sm text-[#806b60]">This stops active production and creates a traceable cancellation record.</p></div>
            <div className="p-6"><label className="text-xs font-bold uppercase tracking-[0.1em] text-[#735c51]">Reason required</label><textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this order is being cancelled…" className="mt-2 min-h-24 w-full resize-none rounded-xl border border-[#ddcec5] bg-white p-3 text-sm text-[#24130d] outline-none ring-orange-500 placeholder:text-[#b19c91] focus:ring-2" /></div>
            <div className="flex justify-end gap-3 border-t border-[#f1e7e1] bg-[#fbf8f6] p-4"><button onClick={() => setShowCancel(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#735c51] hover:bg-white">Keep order</button><button disabled={saving || !reason.trim()} onClick={() => void cancelOrder()} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
          </div>
        </div>
      ) : null}
      <div className="fixed inset-0 z-40 bg-[#24130d]/45 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-[#eadfd8] bg-[#fbf8f6] shadow-2xl">
        <div className="border-b border-[#eadfd8] bg-[#24130d] px-6 py-5 text-white"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-orange-300"><Receipt className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[0.14em]">Order detail</span></div><h2 className="mt-2 text-2xl font-bold">{order.orderNumber}</h2><div className="mt-3 flex items-center gap-3"><StagePill stage={stage} /><Elapsed createdAt={order.createdAt} /></div></div><button onClick={onClose} className="rounded-xl border border-white/15 bg-white/10 p-2 text-orange-100 hover:bg-white/15"><X className="h-5 w-5" /></button></div></div>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#eadfd8] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Service point</p><p className="mt-2 text-sm font-bold text-[#24130d]">{locationName(order)}</p></div><div className="rounded-xl border border-[#eadfd8] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Server</p><p className="mt-2 text-sm font-bold text-[#24130d]">{personName(order)}</p></div></div>
          <section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-[#24130d]">Items ordered</h3><span className="text-xs font-semibold text-[#927b70]">{order.items.length} lines</span></div><div className="space-y-2">{order.items.map((item, index) => <div key={item.id || index} className="rounded-xl border border-[#eadfd8] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#4f392f]"><span className="mr-2 text-orange-600">{item.quantity}×</span>{item.productName}</p>{item.modifiers?.map((modifier: any) => <p key={modifier.id} className="mt-1 pl-6 text-xs text-[#927b70]">+ {modifier.name}</p>)}</div><span className="text-sm font-bold text-[#24130d]">{money(Number(item.unitPrice) * Number(item.quantity))}</span></div></div>)}</div></section>
          <section><h3 className="mb-3 text-sm font-bold text-[#24130d]">Production timeline</h3>{order.productionBatches.length ? <div className="space-y-2">{order.productionBatches.map((batch) => <div key={batch.id} className="flex items-center justify-between rounded-xl border border-[#eadfd8] bg-white p-4"><div className="flex items-center gap-3"><span className="rounded-lg bg-[#fff7ed] p-2 text-orange-600"><ChefHat className="h-4 w-4" /></span><div><p className="text-sm font-bold text-[#4f392f]">Production batch</p><p className="text-xs text-[#927b70]">#{batch.id.slice(0, 8)}</p></div></div><span className="rounded-full bg-[#f7eee9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#7c2d12]">{batch.status}</span></div>)}</div> : <p className="rounded-xl border border-dashed border-[#ddcec5] bg-white p-4 text-sm text-[#927b70]">No kitchen production batch has been created for this order.</p>}</section>
        </div>
        <div className="border-t border-[#eadfd8] bg-white p-6"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#927b70]">Order total</span><span className="text-2xl font-bold text-[#24130d]">{money(order.total)}</span></div>{['SUBMITTED', 'IN_SERVICE'].includes(order.status) ? <button onClick={() => setShowCancel(true)} className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100">Cancel order</button> : null}</div>
      </aside>
    </>
  );
}

export function FnbOrdersClient() {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [visible, setVisible] = useState(true);
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/v1/fnb/orders', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload?.success === false) throw new Error(payload?.error?.message || 'Unable to load live orders');
      setOrders(payload?.data?.orders || []);
      setBusinessDate(payload?.data?.businessDate || new Date().toISOString().slice(0, 10));
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load live orders'); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { void fetchOrders(); }, []);
  useEffect(() => { const onVisibility = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', onVisibility); return () => document.removeEventListener('visibilitychange', onVisibility); }, []);
  useEffect(() => { if (!visible) return; const interval = setInterval(() => void fetchOrders(true), 30000); return () => clearInterval(interval); }, [visible]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [order.orderNumber, locationName(order), personName(order)].some((value) => value.toLowerCase().includes(query));
    const matchesFilter = filter === 'ALL' || getStage(order) === filter;
    return matchesSearch && matchesFilter;
  }), [orders, search, filter]);

  const columns = useMemo(() => ({
    SUBMITTED: filteredOrders.filter((order) => getStage(order) === 'SUBMITTED'),
    PREPARING: filteredOrders.filter((order) => getStage(order) === 'PREPARING'),
    READY: filteredOrders.filter((order) => getStage(order) === 'READY'),
    SERVED: filteredOrders.filter((order) => getStage(order) === 'SERVED'),
  }), [filteredOrders]);

  const metrics = useMemo(() => {
    const atRisk = orders.filter((order) => minutesSince(order.createdAt) >= 25).length;
    const revenue = orders.reduce((total, order) => total + Number(order.total || 0), 0);
    return { atRisk, revenue, average: orders.length ? revenue / orders.length : 0, oldest: [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0] };
  }, [orders]);

  const stageStats = [
    { label: 'Submitted', count: columns.SUBMITTED.length, color: 'bg-orange-500', text: 'text-orange-700' },
    { label: 'Preparing', count: columns.PREPARING.length, color: 'bg-amber-500', text: 'text-amber-700' },
    { label: 'Ready', count: columns.READY.length, color: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: 'In service', count: columns.SERVED.length, color: 'bg-[#7c2d12]', text: 'text-[#7c2d12]' },
  ];

  const OrderCard = ({ order }: { order: PosOrder }) => {
    const stage = getStage(order);
    const atRisk = minutesSince(order.createdAt) >= 25;
    return <button onClick={() => setSelectedOrder(order)} className="group w-full rounded-2xl border border-[#eadfd8] bg-white p-4 text-left shadow-[0_5px_18px_rgba(65,32,19,0.04)] transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-[0_12px_28px_rgba(65,32,19,0.1)]"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-orange-500" /><span className="font-bold text-[#24130d]">{order.orderNumber}</span></div><p className="mt-2 text-sm font-semibold text-[#4f392f]">{locationName(order)}</p></div><Elapsed createdAt={order.createdAt} /></div><p className="mt-1 text-xs text-[#927b70]">{personName(order)}</p><div className="mt-4 flex items-center justify-between border-t border-[#f1e7e1] pt-3"><span className="text-xs font-semibold text-[#927b70]">{order.items.length} item lines</span><span className="text-sm font-bold text-[#24130d]">{money(order.total)}</span></div>{atRisk ? <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] font-bold text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> SLA attention required</div> : null}<div className="mt-3 flex items-center justify-between"><StagePill stage={stage} /><ChevronRight className="h-4 w-4 text-[#c7b4a9] transition group-hover:translate-x-0.5 group-hover:text-orange-500" /></div></button>;
  };

  if (loading && !orders.length) return <div className="flex min-h-[520px] items-center justify-center bg-[#fbf8f6]"><div className="flex items-center gap-3 text-sm font-semibold text-[#7c2d12]"><Loader2 className="h-5 w-5 animate-spin" /> Loading live service board…</div></div>;

  return <div className="min-h-full bg-[#fbf8f6] text-[#24130d]">
    <header className="border-b border-[#3d2318] bg-[#24130d] text-white"><div className="mx-auto max-w-[1700px] px-4 py-7 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-300"><UtensilsCrossed className="h-4 w-4" /> F&B operations</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Live service board</h1><p className="mt-2 max-w-2xl text-sm text-orange-100/75">Coordinate every open order from submission to service, protect guest wait times, and keep the floor aligned with the kitchen.</p></div><div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" /></span><div><p className="text-xs font-bold text-white">Live monitoring</p><p className="text-[11px] text-orange-100/60">Updates automatically every 30 seconds</p></div></div></div></div></header>
    <main className="mx-auto max-w-[1700px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {error ? <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => void fetchOrders()} className="font-bold underline">Try again</button></div> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Open orders" value={String(orders.length)} detail="Orders in the live queue" icon={Receipt} tone="bg-orange-50 text-orange-600" /><Metric label="Service value" value={money(metrics.revenue)} detail="Gross value in open queue" icon={TrendingUp} tone="bg-[#f7eee9] text-[#7c2d12]" /><Metric label="At-risk orders" value={String(metrics.atRisk)} detail="25+ minutes elapsed" icon={AlertTriangle} tone={metrics.atRisk ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} /><Metric label="Average order" value={money(metrics.average)} detail="Average open-order value" icon={Users} tone="bg-amber-50 text-amber-600" /></div>
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-bold">Service pulse</h2><p className="mt-1 text-xs text-[#927b70]">Where attention is concentrated across the live queue</p></div><Timer className="h-5 w-5 text-orange-500" /></div><div className="space-y-4">{stageStats.map((item) => { const percentage = orders.length ? Math.round((item.count / orders.length) * 100) : 0; return <div key={item.label}><div className="mb-1.5 flex justify-between text-xs"><span className={`font-bold ${item.text}`}>{item.label}</span><span className="font-semibold text-[#927b70]">{item.count} · {percentage}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[#f4ebe6]"><div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${percentage}%` }} /></div></div>; })}</div></section>
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-bold">Manager attention</h2><p className="mt-1 text-xs text-[#927b70]">The next operational decision</p></div><AlertTriangle className="h-5 w-5 text-orange-500" /></div>{metrics.atRisk ? <div className="rounded-xl border border-red-100 bg-red-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-red-700">SLA risk</p><p className="mt-2 text-sm font-bold text-red-900">{metrics.atRisk} order{metrics.atRisk === 1 ? '' : 's'} need immediate follow-up.</p><p className="mt-1 text-xs text-red-700/80">Prioritise the oldest order and confirm with the kitchen or floor team.</p></div> : <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">Service on track</p><p className="mt-2 text-sm font-bold text-emerald-900">No order has breached the 25-minute attention threshold.</p><p className="mt-1 text-xs text-emerald-700/80">Continue monitoring the queue as new orders arrive.</p></div>}<div className="mt-4 flex items-center justify-between border-t border-[#f1e7e1] pt-4 text-xs"><span className="text-[#927b70]">Oldest open order</span><span className="font-bold text-[#24130d]">{metrics.oldest ? `${metrics.oldest.orderNumber} · ${minutesSince(metrics.oldest.createdAt)}m` : 'No open orders'}</span></div></section>
      </div>
      <section className="rounded-2xl border border-[#eadfd8] bg-white p-4 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="relative flex-1 xl:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b19c91]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, table, or server…" className="h-11 w-full rounded-xl border border-[#ddcec5] bg-[#fbf8f6] pl-10 pr-3 text-sm text-[#24130d] outline-none placeholder:text-[#b19c91] focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></div><div className="flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-1 rounded-xl bg-[#fbf8f6] p-1">{(['ALL', 'SUBMITTED', 'PREPARING', 'READY', 'SERVED'] as FilterKey[]).map((key) => <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] transition ${filter === key ? 'bg-[#24130d] text-white' : 'text-[#806b60] hover:bg-white hover:text-[#24130d]'}`}>{key === 'ALL' ? 'All' : key === 'SERVED' ? 'In service' : key[0] + key.slice(1).toLowerCase()}</button>)}</div><div className="flex rounded-xl border border-[#eadfd8] p-1"><button onClick={() => setViewMode('board')} className={`rounded-lg p-2 ${viewMode === 'board' ? 'bg-[#fff7ed] text-orange-600' : 'text-[#927b70]'}`} aria-label="Board view"><LayoutGrid className="h-4 w-4" /></button><button onClick={() => setViewMode('list')} className={`rounded-lg p-2 ${viewMode === 'list' ? 'bg-[#fff7ed] text-orange-600' : 'text-[#927b70]'}`} aria-label="List view"><List className="h-4 w-4" /></button></div></div></div></section>
      {viewMode === 'board' ? <div className="grid items-start gap-5 xl:grid-cols-4">{(['SUBMITTED', 'PREPARING', 'READY', 'SERVED'] as Exclude<FilterKey, 'ALL'>[]).map((key) => <section key={key} className="min-w-0"><div className="mb-3 flex items-center justify-between border-b-2 border-[#eadfd8] pb-3"><div><h3 className="text-sm font-bold text-[#4f392f]">{key === 'SERVED' ? 'In service' : key[0] + key.slice(1).toLowerCase()}</h3><p className="mt-0.5 text-[11px] text-[#927b70]">{key === 'SUBMITTED' ? 'Awaiting kitchen action' : key === 'PREPARING' ? 'Currently in production' : key === 'READY' ? 'Awaiting pickup or service' : 'Guest-facing orders'}</p></div><span className="rounded-full bg-[#f7eee9] px-2.5 py-1 text-xs font-bold text-[#7c2d12]">{columns[key].length}</span></div><div className="space-y-3">{columns[key].map((order) => <OrderCard key={order.id} order={order} />)}{!columns[key].length ? <div className="rounded-2xl border-2 border-dashed border-[#eadfd8] bg-white/50 p-6 text-center text-xs font-semibold text-[#b19c91]">No orders in this stage</div> : null}</div></section>)}</div> : <div className="overflow-hidden rounded-2xl border border-[#eadfd8] bg-white shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#fbf8f6] text-[10px] uppercase tracking-[0.12em] text-[#927b70]"><tr><th className="px-5 py-4">Order</th><th className="py-4">Service point</th><th className="py-4">Server</th><th className="py-4">Stage</th><th className="py-4">Elapsed</th><th className="px-5 py-4 text-right">Value</th></tr></thead><tbody className="divide-y divide-[#f1e7e1]">{filteredOrders.map((order) => <tr key={order.id} onClick={() => setSelectedOrder(order)} className="cursor-pointer hover:bg-[#fffaf6]"><td className="px-5 py-4 font-bold text-[#24130d]">{order.orderNumber}</td><td className="py-4 font-semibold text-[#4f392f]">{locationName(order)}</td><td className="py-4 text-[#806b60]">{personName(order)}</td><td className="py-4"><StagePill stage={getStage(order)} /></td><td className="py-4"><Elapsed createdAt={order.createdAt} /></td><td className="px-5 py-4 text-right font-bold text-[#24130d]">{money(order.total)}</td></tr>)}{!filteredOrders.length ? <tr><td colSpan={6} className="py-14 text-center text-sm text-[#927b70]">No live orders match your filters.</td></tr> : null}</tbody></table></div></div>}
    </main>
    {selectedOrder ? <OrderDrawer order={selectedOrder} businessDate={businessDate} onClose={() => setSelectedOrder(null)} onRefresh={() => void fetchOrders(true)} /> : null}
  </div>;
}
