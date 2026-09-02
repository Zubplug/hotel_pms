'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type RefundRequest = {
  id: string;
  propertyId: string;
  requestedAmount: string | number;
  approvedAmount?: string | number | null;
  currency: string;
  category: string;
  reason: string;
  status: string;
  createdAt: string;
  payment?: { method: string };
  approval?: { id: string; status: string } | null;
  requestedMethod?: string;
  approvedMethod?: string | null;
};

type Options = {
  approvers: { id: string; email: string }[];
  roles: { id: string; name: string }[];
};

const statusStyles: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  FAILED: 'bg-red-100 text-red-800',
};

export default function RefundsPage() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [options, setOptions] = useState<Record<string, Options>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const propertyIds = useMemo(() => Array.from(new Set(requests.map(request => request.propertyId))), [requests]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/refund-requests');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load refund requests');
      const loaded = payload.data || [];
      setRequests(loaded);
      const entries = await Promise.all(propertyIds.concat(loaded.map((request: RefundRequest) => request.propertyId)).filter((id, index, all) => all.indexOf(id) === index).map(async propertyId => {
        if (options[propertyId]) return [propertyId, options[propertyId]] as const;
        const result = await fetch(`/api/v1/refund-requests/assignment-options?propertyId=${propertyId}`);
        const data = await result.json();
        return [propertyId, data.data] as const;
      }));
      setOptions(previous => ({ ...previous, ...Object.fromEntries(entries) }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load refund requests');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function assign(request: RefundRequest, field: 'approverId' | 'approvalRoleId', value: string) {
    setBusy(request.id);
    try {
      const response = await fetch(`/api/v1/refund-requests/${request.id}/assignment`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update assignment');
      toast.success('Approval assignment updated');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update assignment'); }
    finally { setBusy(null); }
  }

  async function act(request: RefundRequest, action: 'approve' | 'reject') {
    if (!request.approval?.id) return;
    const comment = action === 'reject' ? window.prompt('Rejection reason')?.trim() : undefined;
    if (action === 'reject' && !comment) return;
    const refundMethod = action === 'approve' ? window.prompt('Settlement method: CASH, BANK_TRANSFER, or ORIGINAL_PAYMENT', request.requestedMethod || 'ORIGINAL_PAYMENT')?.trim().toUpperCase() : undefined;
    if (action === 'approve' && !refundMethod) return;
    setBusy(request.id);
    try {
      const response = await fetch(`/api/manager/approvals/${request.approval.id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ comment }) : JSON.stringify({ refundMethod }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to ${action} refund`);
      toast.success(action === 'approve' ? 'Refund approved' : 'Refund rejected');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : `Unable to ${action} refund`); }
    finally { setBusy(null); }
  }

  async function settleCash(request: RefundRequest) {
    setBusy(request.id);
    try {
      const response = await fetch(`/api/v1/refund-requests/${request.id}/settle-cash`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to settle cash refund');
      toast.success('Cash refund settled');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to settle cash refund'); }
    finally { setBusy(null); }
  }

  async function settleBank(request: RefundRequest) {
    const reference = window.prompt('Bank transfer reference')?.trim();
    if (!reference) return;
    setBusy(request.id);
    try {
      const response = await fetch(`/api/v1/refund-requests/${request.id}/settle-bank`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to settle bank refund');
      toast.success('Bank transfer refund settled');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to settle bank refund'); }
    finally { setBusy(null); }
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight">Refund Requests</h1><p className="text-muted-foreground">Review, assign, approve, and settle refunds.</p></div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40"><tr className="text-left"><th className="px-4 py-3">Request</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Actions</th></tr></thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : requests.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No refund requests found.</td></tr> : requests.map(request => {
              const propertyOptions = options[request.propertyId];
              const isBusy = busy === request.id;
              return <tr key={request.id} className="align-top"><td className="px-4 py-4"><div className="font-medium">{request.category.replaceAll('_', ' ')}</div><div className="text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleString()}</div><div className="mt-1 font-mono text-[10px] text-muted-foreground">{request.id}</div></td><td className="px-4 py-4 font-semibold">{request.currency} {Number(request.approvedAmount || request.requestedAmount).toLocaleString()}</td><td className="max-w-xs px-4 py-4"><div>{request.reason}</div><div className="text-xs text-muted-foreground">Requested: {request.requestedMethod || 'ORIGINAL_PAYMENT'}</div></td><td className="px-4 py-4"><Badge className={statusStyles[request.status] || ''}>{request.status.replaceAll('_', ' ')}</Badge>{request.approvedMethod && <div className="mt-1 text-xs text-muted-foreground">Method: {request.approvedMethod}</div>}</td><td className="px-4 py-4"><div className="min-w-52 space-y-2">{propertyOptions ? <><Select label="Assign staff" onChange={value => assign(request, 'approverId', value)} options={[{ value: '', label: 'Select staff' }, ...propertyOptions.approvers.map(approver => ({ value: approver.id, label: approver.email }))]} disabled={request.status !== 'PENDING_APPROVAL' || isBusy} /><Select label="Assign role" onChange={value => assign(request, 'approvalRoleId', value)} options={[{ value: '', label: 'Select role' }, ...propertyOptions.roles.map(role => ({ value: role.id, label: role.name }))]} disabled={request.status !== 'PENDING_APPROVAL' || isBusy} /></> : <span className="text-xs text-muted-foreground">Loading options…</span>}</div></td><td className="px-4 py-4"><div className="flex gap-2">{request.status === 'PENDING_APPROVAL' && request.approval?.status === 'PENDING' && <><Button size="sm" onClick={() => act(request, 'approve')} disabled={isBusy}><Check className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => act(request, 'reject')} disabled={isBusy}><X className="mr-1 h-4 w-4" />Reject</Button></>}{request.status === 'APPROVED' && request.approvedMethod === 'CASH' && <Button size="sm" onClick={() => settleCash(request)} disabled={isBusy}>Settle cash</Button>}{request.status === 'APPROVED' && request.approvedMethod === 'BANK_TRANSFER' && <Button size="sm" onClick={() => settleBank(request)} disabled={isBusy}>Settle bank</Button>}{isBusy && <Loader2 className="h-4 w-4 animate-spin" />}</div></td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select({ label, onChange, options, disabled }: { label: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return <div className="relative"><select aria-label={label} defaultValue="" onChange={event => onChange(event.target.value)} disabled={disabled} className="h-9 w-full appearance-none rounded-md border bg-background px-3 pr-8 text-xs">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" /></div>;
}
