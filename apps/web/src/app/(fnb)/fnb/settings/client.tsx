'use client';

import { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { CheckCircle2, Clock3, Loader2, Save, ShieldCheck, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

type Mode = 'SALE_ONLY' | 'DEDUCT';

const modeCopy: Record<Mode, { title: string; description: string; detail: string }> = {
  SALE_ONLY: {
    title: 'Sale only',
    description: 'Complete POS sales without checking inventory or deducting stock.',
    detail: 'Use this mode when inventory is managed outside the POS sale workflow.',
  },
  DEDUCT: {
    title: 'Check and deduct stock',
    description: 'Run the full inventory check, then deduct recipe ingredients and modifiers atomically.',
    detail: 'This is the recommended mode for controlled F&B operations.',
  },
};

export default function FnbSettingsClient() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const [mode, setMode] = useState<Mode>('DEDUCT');
  const [pending, setPending] = useState<any>(null);
  const [capabilities, setCapabilities] = useState({ canSubmit: false, canApprove: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!propertyId || !session?.user) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/fnb/inventory-control?propertyId=${encodeURIComponent(propertyId)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load inventory control');
      setMode(body.data.currentMode);
      setPending(body.data.pendingRequest);
      setCapabilities({ canSubmit: body.data.canSubmit, canApprove: body.data.canApprove });
    } catch (error: any) {
      toast.error(error.message || 'Unable to load inventory control');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [propertyId, session?.user]);

  const submit = async () => {
    if (!propertyId) return;
    setBusy(true);
    try {
      const response = await fetch('/api/v1/fnb/inventory-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, mode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to submit request');
      toast.success('Inventory control request sent to the General Manager');
      await load();
    } catch (error: any) {
      toast.error(error.message || 'Unable to submit request');
    } finally {
      setBusy(false);
    }
  };

  const review = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!pending?.id) return;
    setBusy(true);
    try {
      const response = await fetch('/api/v1/fnb/inventory-control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: pending.id, decision }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to process request');
      toast.success(decision === 'APPROVED' ? 'Inventory control is now active' : 'Request rejected');
      await load();
    } catch (error: any) {
      toast.error(error.message || 'Unable to process request');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-orange-600" /></div>;

  return (
    <div className="min-h-full bg-[#fbf8f6] p-4 text-[#24130d] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700"><Utensils className="h-3.5 w-3.5" /> F&B control policy</div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Inventory deduction</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Define how every POS sale validates inventory. Changes are proposed by F&B and require General Manager approval before terminals receive the policy.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Current policy</p><p className="mt-1 font-bold text-slate-900">{modeCopy[mode].title}</p></div>
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-white">
            <CardTitle>POS inventory behaviour</CardTitle>
            <CardDescription>Choose the approved control standard for {propertyId ? 'this property' : 'the selected property'}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            {(Object.keys(modeCopy) as Mode[]).map((candidate) => {
              const selected = mode === candidate;
              return <button type="button" key={candidate} onClick={() => setMode(candidate)} className={`rounded-2xl border p-5 text-left transition ${selected ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-100' : 'border-slate-200 bg-white hover:border-orange-300'}`}>
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{modeCopy[candidate].title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{modeCopy[candidate].description}</p></div><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300'}`}>{selected && <CheckCircle2 className="h-4 w-4" />}</span></div>
                <p className="mt-4 border-t border-slate-200/80 pt-3 text-xs font-medium text-slate-500">{modeCopy[candidate].detail}</p>
              </button>;
            })}
          </CardContent>
          {capabilities.canSubmit && <div className="flex flex-col justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center"><div className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /><span>Submitting creates a controlled request. The selected mode will not change until the GM approves it.</span></div><Button onClick={submit} disabled={busy || !!pending} className="shrink-0 bg-orange-600 font-bold hover:bg-orange-700"><Save className="mr-2 h-4 w-4" />{busy ? 'Submitting…' : pending ? 'Approval pending' : 'Submit for GM approval'}</Button></div>}
        </Card>

        {pending && <Card className="border-amber-200 bg-amber-50/60 shadow-sm"><CardContent className="flex flex-col justify-between gap-5 p-5 lg:flex-row lg:items-center"><div className="flex gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-bold text-amber-950">Awaiting General Manager approval</p><p className="mt-1 text-sm text-amber-900/70">Requested mode: <strong>{modeCopy[String(pending.payload?.mode || 'DEDUCT').toUpperCase() as Mode]?.title || pending.payload?.mode}</strong>. Terminals continue using the current approved policy.</p><p className="mt-2 text-xs text-amber-900/60">Submitted {pending.requestedBy?.firstName || pending.requestedBy?.email || 'F&B Manager'}</p></div></div>{capabilities.canApprove && <div className="flex gap-2"><Button variant="outline" onClick={() => review('REJECTED')} disabled={busy} className="border-rose-200 text-rose-700 hover:bg-rose-50">Reject</Button><Button onClick={() => review('APPROVED')} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">Approve policy</Button></div>}</CardContent></Card>}

        <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Validation</p><p className="mt-2 text-sm font-semibold text-slate-800">Recipes, modifiers, units, mappings, and warehouse availability</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Offline ready</p><p className="mt-2 text-sm font-semibold text-slate-800">Approved policy is synced to each registered terminal</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Audit trail</p><p className="mt-2 text-sm font-semibold text-slate-800">Every deduction remains in the stock transaction ledger</p></div></div>
      </div>
    </div>
  );
}
