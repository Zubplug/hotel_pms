'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ClipboardCheck, Clock3, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ApprovalRequest = {
  id: string;
  propertyId: string;
  property?: { name?: string | null };
  type: string;
  status: string;
  amount?: number | string | null;
  currency?: string | null;
  reason: string;
  details?: Record<string, unknown> | null;
  requestedAt: string;
};

const labelFor = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

function requestTitle(request: ApprovalRequest) {
  const details = request.details || {};
  return String(details.productName || details.name || details.reference || labelFor(request.type));
}

function requestSubtitle(request: ApprovalRequest) {
  const details = request.details || {};
  if (request.type.startsWith('POS_')) return String(details.productName || details.name || 'POS catalogue request');
  if (request.type === 'REFUND') return 'Refund request';
  return labelFor(request.type);
}

function money(request: ApprovalRequest) {
  if (request.amount == null) return null;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: request.currency || 'NGN', maximumFractionDigits: 2 }).format(Number(request.amount));
}

export default function GeneralManagerApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mobile/v1/executive/approvals?propertyId=ALL_AUTHORIZED', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load approval requests');
      setRequests(body.data || []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to load approval requests', error: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (request: ApprovalRequest, action: 'approve' | 'reject') => {
    const comment = action === 'reject' ? window.prompt('Add a reason for rejecting this request:')?.trim() : '';
    if (action === 'reject' && !comment) return;
    setBusyId(request.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/manager/approvals/${request.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'reject' ? { comment } : {}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to process approval');
      setMessage({ text: action === 'approve' ? 'Request approved successfully.' : 'Request rejected successfully.' });
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to process approval', error: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><ClipboardCheck className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Manager control centre</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Approval requests</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">Review pending operational, financial, refund, discount, and POS catalogue requests across your authorised properties.</p>
          </div>
        </div>
      </section>

      {message && <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><AlertCircle className="h-4 w-4" />{message.text}</div>}

      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold tracking-tight">Pending queue</h2><p className="mt-1 text-sm text-muted-foreground">Only requests awaiting manager action are shown.</p></div>
        <Badge variant="secondary" className="px-3 py-1">{requests.length} pending</Badge>
      </div>

      {loading ? <div className="flex items-center justify-center rounded-2xl border bg-card p-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading approval queue…</div> : requests.length === 0 ? <Card><CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-500" /><div><p className="font-semibold">No pending approvals</p><p className="mt-1 text-sm text-muted-foreground">The manager approval queue is clear.</p></div></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{requests.map((request) => { const amount = money(request); const busy = busyId === request.id; return <Card key={request.id} className="border-muted/60"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{requestTitle(request)}</CardTitle><CardDescription className="mt-1">{requestSubtitle(request)} · {request.property?.name || 'Authorised property'}</CardDescription></div><Badge className="border-amber-200 bg-amber-50 text-amber-700"><Clock3 className="mr-1 h-3 w-3" />Pending</Badge></div></CardHeader><CardContent className="space-y-4"><div className="rounded-xl bg-muted/40 p-3 text-sm"><p className="font-medium text-foreground">{request.reason || 'No reason supplied'}</p><p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(request.requestedAt).toLocaleString()}</p>{amount && <p className="mt-2 text-lg font-bold text-foreground">{amount}</p>}</div><div className="flex justify-end gap-2"><button disabled={busy} onClick={() => void decide(request, 'reject')} className="inline-flex items-center rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"><X className="mr-1.5 h-4 w-4" />Reject</button><button disabled={busy} onClick={() => void decide(request, 'approve')} className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}Approve</button></div></CardContent></Card>; })}</div>}
    </div>
  );
}
