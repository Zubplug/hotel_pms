'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const colors: Record<string, string> = { PENDING_APPROVAL: 'bg-amber-100 text-amber-800', APPROVED: 'bg-blue-100 text-blue-800', PROCESSING: 'bg-indigo-100 text-indigo-800', COMPLETED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800', FAILED: 'bg-red-100 text-red-800' };

export default function FrontDeskRefundStatusPage() {
  const { propertyId } = useProperty();
  const { provider, isOnline } = useLodgeCoreProvider();
  const query = useQuery({ queryKey: ['refund-status', propertyId], queryFn: () => provider.refunds.list(propertyId), enabled: !!propertyId, refetchInterval: isOnline ? 15000 : false });
  const requests = (query.data?.data || query.data || []).filter((request: any) => request.category === 'FOLIO_CREDIT_BALANCE');

  return <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 p-4 md:p-8"><div className="mx-auto max-w-6xl space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Guest Credit Refunds</h1><p className="mt-2 text-muted-foreground">{isOnline ? 'Cloud status is synchronized automatically.' : 'Offline view — showing the last synchronized status.'}</p></div><Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />Refresh</Button></div><div className="overflow-x-auto rounded-xl border bg-white shadow-sm"><table className="w-full min-w-[1050px] text-sm"><thead className="border-b bg-slate-50"><tr className="text-left"><th className="px-4 py-3">Guest credit</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Bank</th><th className="px-4 py-3">Account name</th><th className="px-4 py-3">Account number</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last updated</th></tr></thead><tbody className="divide-y">{requests.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No guest-credit refund requests found.</td></tr> : requests.map((request: any) => <tr key={request.id}><td className="px-4 py-4"><div className="font-medium">Guest credit refund</div><div className="font-mono text-[10px] text-muted-foreground">{request.id}</div></td><td className="px-4 py-4 font-semibold">{request.currency} {Number(request.approvedAmount || request.requestedAmount).toLocaleString()}</td><td className="px-4 py-4">{request.requestedMethod === 'BANK_TRANSFER' ? (request.bankName || 'Bank transfer') : (request.requestedMethod || 'CASH')}</td><td className="px-4 py-4">{request.requestedMethod === 'BANK_TRANSFER' ? (request.bankAccountName || '—') : '—'}</td><td className="px-4 py-4">{request.requestedMethod === 'BANK_TRANSFER' ? (request.bankAccountNumber || '—') : '—'}</td><td className="px-4 py-4"><Badge className={colors[request.status] || ''}>{String(request.status || '').replaceAll('_', ' ')}</Badge>{request.approval?.details?.stage && <div className="mt-1 text-xs text-amber-700">{String(request.approval.details.stage).replaceAll('_', ' ')}</div>}</td><td className="px-4 py-4 text-muted-foreground">{request.updatedAt ? new Date(request.updatedAt).toLocaleString() : '—'}</td></tr>)}</tbody></table></div></div></div>;
}
