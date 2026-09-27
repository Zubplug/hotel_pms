'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Building2, HandCoins, TrendingUp } from 'lucide-react';

type Scope = { propertyId: string; propertyName: string; currency: string; auditPeriodStart: string; auditPeriodEnd: string };
type Dashboard = { scope: Scope; kpis: { totalRevenue: number; cashCollected: number; averageOccupancy: number; adr: number; reconciliationStatus: string }; exceptions: Array<{ key: string; label: string; count: number; risk: string }> };
const money = (value: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

export default function ExternalAuditorDashboard() {
  const [scopes, setScopes] = useState<Scope[]>([]); const [data, setData] = useState<Dashboard | null>(null); const [error, setError] = useState('');
  useEffect(() => { void fetch('/api/v1/external-auditor/context').then(r => r.json()).then(v => { if (!v.scopes?.length) throw new Error(v.error || 'No active engagement'); setScopes(v.scopes); return fetch(`/api/v1/external-auditor/dashboard?propertyId=${v.scopes[0].propertyId}`); }).then(r => r.json()).then(setData).catch(e => setError(e.message)); }, []);
  const select = (propertyId: string) => { const scope = scopes.find(item => item.propertyId === propertyId); if (!scope) return; void fetch(`/api/v1/external-auditor/dashboard?propertyId=${propertyId}`).then(r => r.json()).then(setData); };
  if (error) return <div className="rounded-xl border border-red-900 bg-red-950/40 p-6 text-red-200">{error}</div>;
  if (!data) return <div className="p-8 text-slate-400">Loading verified audit data…</div>;
  const { kpis, scope } = data;
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">Audit Command Center</h2><p className="text-slate-400">Live, read-only data for the authorized audit period.</p></div>{scopes.length > 1 && <select value={scope.propertyId} onChange={e => select(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm">{scopes.map(item => <option key={item.propertyId} value={item.propertyId}>{item.propertyName}</option>)}</select>}</div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[["Total Revenue", money(kpis.totalRevenue, scope.currency), TrendingUp], ["Average Occupancy", `${kpis.averageOccupancy.toFixed(2)}%`, Building2], ["Cash Collected", money(kpis.cashCollected, scope.currency), HandCoins], ["Close Status", kpis.reconciliationStatus, AlertTriangle]].map(([label, value, Icon]: any) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="flex justify-between text-sm text-slate-400"><span>{label}</span><Icon className="h-4 w-4 text-emerald-400" /></div><div className="mt-3 text-2xl font-bold">{value}</div></div>)}</div>
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Audit exceptions</h3><Link href={`/external-auditor/evidence?propertyId=${scope.propertyId}`} className="text-sm text-blue-400">Open evidence</Link></div><div className="grid gap-3 md:grid-cols-2">{data.exceptions.map(item => <Link key={item.key} href={`/external-auditor/evidence?propertyId=${scope.propertyId}&q=${item.label}`} className="flex items-center justify-between rounded-lg border border-slate-800 p-3 hover:bg-slate-800"><span>{item.label}</span><span className={item.count ? 'text-amber-400' : 'text-emerald-400'}>{item.count}</span></Link>)}</div></div></div>;
}
