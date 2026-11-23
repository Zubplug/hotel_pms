'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';

type Fulfilment = {
  id: string;
  amenityName: string;
  unit: string;
  requiredQuantity: number | string;
  issuedQuantity: number | string;
  shortageQuantity: number | string;
  status: string;
  reason?: string | null;
  reservation?: { confirmationNumber?: string; primaryGuest?: { firstName?: string; lastName?: string } };
  room?: { number?: string } | null;
};

const number = (value: number | string) => Number(value || 0).toLocaleString();

export default function GuestAmenityFulfillmentView() {
  const { propertyId } = useProperty();
  const [items, setItems] = useState<Fulfilment[]>([]);
  const [businessDate, setBusinessDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/housekeeping/guest-amenities?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load fulfilment queue');
      setItems(body.data?.items || []);
      setBusinessDate(body.data?.businessDate || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load fulfilment queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [propertyId]);

  const totals = useMemo(() => items.reduce((result, item) => ({
    required: result.required + Number(item.requiredQuantity),
    issued: result.issued + Number(item.issuedQuantity),
    shortage: result.shortage + Number(item.shortageQuantity),
  }), { required: 0, issued: 0, shortage: 0 }), [items]);

  const act = async (item: Fulfilment, action: 'FULFIL' | 'WAIVE') => {
    const reason = action === 'WAIVE' ? window.prompt('Enter the waiver reason (minimum 5 characters):') : undefined;
    if (action === 'WAIVE' && (!reason || reason.trim().length < 5)) return;
    setBusyId(item.id);
    setError(null);
    try {
      const response = await fetch('/api/v1/housekeeping/guest-amenities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, fulfillmentId: item.id, action, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to update fulfilment');
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update fulfilment');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.09),transparent_32%),#07111f] px-4 py-6 text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">Housekeeping operations</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl"><PackageCheck className="h-8 w-8 text-cyan-300" />Guest amenity fulfilment</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Issue available complimentary amenities to in-house guests after Night Audit. Shortages never block financial close and stale guest requests are automatically closed.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-semibold text-slate-300 hover:bg-white/[0.08]"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Refresh queue</button>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          {[['Outstanding lines', items.length, 'text-cyan-200'], ['Required', totals.required, 'text-white'], ['Issued', totals.issued, 'text-emerald-200'], ['Shortage', totals.shortage, 'text-amber-200']].map(([label, value, tone]) => <div key={String(label)} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone}`}>{number(value as number)}</p></div>)}
        </section>

        {businessDate && <div className="flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-xs text-cyan-100"><ShieldCheck className="h-4 w-4 text-cyan-300" />Queue created by completed Night Audit for business date <strong>{businessDate}</strong>. Only currently checked-in guests are shown.</div>}
        {error && <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-200">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e1a2c]">
          <div className="border-b border-white/[0.08] px-5 py-4"><h2 className="font-semibold text-white">Open fulfilment lines</h2><p className="mt-1 text-xs text-slate-500">Replenish stock, then issue the outstanding balance without rerunning Night Audit.</p></div>
          {loading && !items.length ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-cyan-300" /></div> : !items.length ? <div className="px-5 py-16 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" /><p className="mt-3 font-semibold text-slate-200">No open fulfilments</p><p className="mt-1 text-sm text-slate-500">All current in-house amenity lines are complete or closed.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.15em] text-slate-600"><tr><th className="px-5 py-3">Guest / room</th><th className="px-3 py-3">Amenity</th><th className="px-3 py-3">Required</th><th className="px-3 py-3">Issued</th><th className="px-3 py-3">Outstanding</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{items.map((item) => { const guest = `${item.reservation?.primaryGuest?.firstName || ''} ${item.reservation?.primaryGuest?.lastName || ''}`.trim() || item.reservation?.confirmationNumber || 'Guest'; const busy = busyId === item.id; return <tr key={item.id}><td className="px-5 py-4"><p className="font-semibold text-slate-200">{guest}</p><p className="mt-1 text-[10px] text-slate-600">Room {item.room?.number || '—'} · {item.reservation?.confirmationNumber || '—'}</p></td><td className="px-3 py-4 font-medium text-slate-300">{item.amenityName}</td><td className="px-3 py-4 text-slate-400">{number(item.requiredQuantity)} {item.unit}</td><td className="px-3 py-4 text-emerald-300">{number(item.issuedQuantity)} {item.unit}</td><td className="px-3 py-4 text-amber-200">{number(item.shortageQuantity)} {item.unit}</td><td className="px-3 py-4"><span className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2 py-1 text-[10px] font-bold text-amber-200">{item.status.replaceAll('_', ' ')}</span></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button disabled={busy} onClick={() => void act(item, 'FULFIL')} className="rounded-lg bg-emerald-400/15 px-3 py-1.5 text-[10px] font-bold text-emerald-200 hover:bg-emerald-400/25 disabled:opacity-50">{busy ? 'Saving…' : 'Issue available'}</button><button disabled={busy} onClick={() => void act(item, 'WAIVE')} className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:bg-white/[0.1] disabled:opacity-50">Waive</button></div></td></tr>; })}</tbody></table></div>}
        </section>
        <p className="flex items-center gap-2 text-xs text-slate-600"><AlertTriangle className="h-3.5 w-3.5" />Issued quantities create inventory and COGS records. Unavailable quantities never create a deduction.</p>
      </div>
    </div>
  );
}
