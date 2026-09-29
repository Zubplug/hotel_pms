'use client';

import { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { AlertTriangle, ArrowUpRight, CheckCircle2, FileText, Loader2, RefreshCcw, Scale, ShieldCheck, WalletCards } from 'lucide-react';

type Domain = 'receivables' | 'city-ledger' | 'payables' | 'taxes' | 'gl';
const config: Record<Domain, { title: string; eyebrow: string; description: string; icon: typeof Scale; primary: string; secondary: string; link: string }> = {
  receivables: { title: 'Receivables oversight', eyebrow: 'Accounting Management / Receivables', description: 'Management view of guest ledger, city ledger, collection exposure, and aging signals.', icon: WalletCards, primary: 'Accounts receivable', secondary: 'Overdue receivables', link: '/reports/receivables' },
  'city-ledger': { title: 'City Ledger oversight', eyebrow: 'Accounting Management / City Ledger', description: 'Monitor corporate and transferred guest receivables without opening collection or posting controls.', icon: ShieldCheck, primary: 'City ledger exposure', secondary: 'Overdue corporate receivables', link: '/reports/receivables' },
  payables: { title: 'Payables oversight', eyebrow: 'Accounting Management / Payables', description: 'Management view of supplier obligations, overdue invoices, and expense approval pressure.', icon: FileText, primary: 'Accounts payable', secondary: 'Overdue supplier invoices', link: '/reports' },
  taxes: { title: 'Tax position', eyebrow: 'Accounting Management / Taxes', description: 'Review tax liability and remittance control status before financial close.', icon: Scale, primary: 'Tax liability', secondary: 'Tax control exceptions', link: '/reports' },
  gl: { title: 'GL integrity', eyebrow: 'Accounting Management / General Ledger', description: 'Monitor ledger exceptions and close confidence without exposing journal posting actions.', icon: Scale, primary: 'GL exceptions', secondary: 'Last audit status', link: '/general-manager/night-audit/reconciliation' },
};

const money = (value: unknown) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function GeneralManagerAccountingDomain({ domain }: { domain: Domain }) {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const { status: sessionStatus } = useLodgeCoreSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = config[domain];
  const Icon = current.icon;

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const response = await fetch(`/api/v1/dashboard/accountant-analytics?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load accounting data');
      setData(body); setError(null);
    } catch (cause: any) { setError(cause.message || 'Unable to load accounting data'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { if (sessionStatus === 'authenticated' && !propertyLoading) void load(); }, [propertyId, propertyLoading, sessionStatus]);

  if (sessionStatus === 'loading' || propertyLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#060c18]"><Loader2 className="h-7 w-7 text-emerald-400 animate-spin" /></div>;
  if (error || !data) return <div className="min-h-[70vh] bg-[#060c18] p-8"><div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5 text-sm text-rose-300">{error || 'Accounting data is unavailable.'}</div></div>;

  const balances = data.balances || {};
  const flags = data.flags || {};
  const primaryValue = domain === 'receivables' || domain === 'city-ledger' ? money(balances.arTotal) : domain === 'payables' ? money(balances.apOutstanding) : domain === 'taxes' ? money(balances.taxLiability?.total) : String(flags.glExceptions || 0);
  const secondaryValue = domain === 'receivables' || domain === 'city-ledger' ? String(flags.overdueReceivables || 0) : domain === 'payables' ? String(flags.overdueInvoices || 0) : domain === 'taxes' ? String(flags.taxExceptions || 0) : (data.audit?.lastAuditStatus || 'PENDING');
  const issueCount = domain === 'gl' ? Number(flags.glExceptions || 0) : domain === 'taxes' ? Number(flags.taxExceptions || 0) : domain === 'payables' ? Number(flags.overdueInvoices || 0) + Number(flags.pendingExpenses || 0) : Number(flags.overdueReceivables || 0) + Number(flags.openExceptions || 0);

  return <main className="min-h-full bg-[linear-gradient(160deg,#060c18_0%,#080e1f_65%,#0a0c22_100%)] px-4 pb-16 pt-6 sm:px-6 md:px-8"><div className="mx-auto max-w-[1400px] space-y-6"><header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400"><Icon className="h-3.5 w-3.5" /> {current.eyebrow}</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{current.title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{current.description}</p></div><button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08]"><RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button></header><section className={`flex items-center gap-3 rounded-2xl border p-5 ${issueCount ? 'border-amber-400/20 bg-amber-400/[0.06]' : 'border-emerald-400/20 bg-emerald-400/[0.06]'}`}>{issueCount ? <AlertTriangle className="h-5 w-5 text-amber-300" /> : <CheckCircle2 className="h-5 w-5 text-emerald-300" />}<div><p className="text-sm font-semibold text-white">{issueCount ? `${issueCount} item${issueCount === 1 ? '' : 's'} require management review` : 'No current management exceptions'}</p><p className="mt-1 text-xs text-slate-500">Read-only management visibility · accountant actions remain protected.</p></div></section><div className="grid gap-4 md:grid-cols-2"><Metric label={current.primary} value={primaryValue} detail="Live accounting balance" icon={Icon} /><Metric label={current.secondary} value={secondaryValue} detail="Current control signal" icon={AlertTriangle} tone={issueCount ? 'amber' : 'emerald'} /></div><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">Management interpretation</h2><p className="mt-1 text-xs text-slate-500">What this control means for the property</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-3"><Signal label="Cash & bank" value={money(balances.cashTotal)} /><Signal label="Revenue today" value={money(data.revenue?.today?.totalRevenue)} /><Signal label="Last audit" value={data.audit?.lastAuditStatus || 'PENDING'} /></div><a href={current.link} className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Open supporting evidence <ArrowUpRight className="h-3.5 w-3.5" /></a></section></div></main>;
}

function Metric({ label, value, detail, icon: Icon, tone = 'indigo' }: { label: string; value: string; detail: string; icon: typeof Scale; tone?: 'indigo' | 'amber' | 'emerald' }) {
  return <div className={`rounded-2xl border p-5 ${tone === 'amber' ? 'border-amber-400/20 bg-amber-400/[0.07]' : tone === 'emerald' ? 'border-emerald-400/20 bg-emerald-400/[0.07]' : 'border-indigo-400/20 bg-indigo-400/[0.07]'}`}><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span><Icon className="h-4 w-4 text-slate-400" /></div><p className="mt-3 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div>;
}
function Signal({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold text-white">{value}</p></div>; }
