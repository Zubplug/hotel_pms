'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

type QueueEvent = {
  id: string;
  source: 'POS' | 'FRONT_DESK';
  status: string;
  error: string;
  type: string;
  aggregate: string;
  attempts: number;
  createdAt: string | null;
};

type RawEvent = Record<string, unknown>;

const value = (event: RawEvent, ...keys: string[]): unknown => keys.map(key => event[key]).find(item => item !== undefined && item !== null && item !== '');

const normalizeEvent = (event: RawEvent, source: QueueEvent['source']): QueueEvent => ({
  id: String(value(event, 'id', 'Id', 'operationId', 'OperationId') || 'unknown'),
  source,
  status: String(value(event, 'status', 'Status') || 'UNKNOWN').toUpperCase(),
  error: String(value(event, 'lastError', 'LastError', 'errorMessage', 'ErrorMessage') || ''),
  type: String(value(event, 'eventType', 'EventType', 'operationType', 'OperationType') || 'UNKNOWN').replaceAll('_', ' '),
  aggregate: `${value(event, 'aggregateType', 'AggregateType', 'entityType', 'EntityType') || 'EVENT'}: ${value(event, 'aggregateId', 'AggregateId', 'entityId', 'EntityId') || 'unknown'}`,
  attempts: Number(value(event, 'attemptCount', 'AttemptCount') || 0),
  createdAt: value(event, 'createdAt', 'CreatedAt', 'occurredAt', 'OccurredAt') ? String(value(event, 'createdAt', 'CreatedAt', 'occurredAt', 'OccurredAt')) : null,
});

export function SyncCenterPanel({ onClose, allowPosStaff = false }: { onClose?: () => void; allowPosStaff?: boolean }) {
  const { data: session } = useLodgeCoreSession();
  const { provider, isOnline } = useLodgeCoreProvider();
  const [busy, setBusy] = useState(false);
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  const isAuthorized = allowPosStaff || ['ADMIN', 'MANAGER', 'SYSTEM_ADMIN', 'RECEPTIONIST', 'FRONT_DESK', 'CASHIER', 'WAITER', 'POS', 'POS_OPERATOR'].includes(role || '');

  const { data, refetch } = useQuery({
    queryKey: ['desktop', 'sync-queues'],
    queryFn: async () => {
      const [frontDesk, pos, health] = await Promise.all([
        provider.system?.getOutboxEvents?.() || { success: false, data: [] },
        provider.system?.getSyncEvents?.() || { success: false, data: [] },
        provider.system?.getSyncHealth?.() || { success: false, data: null },
      ]);
      return {
        frontDesk: (Array.isArray(frontDesk?.data) ? frontDesk.data as RawEvent[] : []).map(event => normalizeEvent(event, 'FRONT_DESK')),
        pos: (Array.isArray(pos?.data) ? pos.data as RawEvent[] : []).map(event => normalizeEvent(event, 'POS')),
        health: health?.data || null,
      };
    },
    refetchInterval: 5000,
    enabled: isAuthorized,
  });

  const events = useMemo(() => [...(data?.frontDesk || []), ...(data?.pos || [])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()), [data]);
  const pending = events.filter(event => ['PENDING', 'PROCESSING', 'FAILED'].includes(event.status));
  const conflicts = events.filter(event => event.status === 'CONFLICT');
  const deadLetters = events.filter(event => ['DEAD_LETTER', 'RETRY_EXHAUSTED'].includes(event.status));
  const synced = events.filter(event => event.status === 'SYNCED');

  const forceSync = async () => {
    setBusy(true);
    try {
      await provider.system?.forceSync?.();
      await new Promise(resolve => setTimeout(resolve, 1500));
      const result = await refetch();
      const failed = [...(result.data?.frontDesk || []), ...(result.data?.pos || [])].filter((event: QueueEvent) => ['FAILED', 'DEAD_LETTER', 'RETRY_EXHAUSTED'].includes(event.status));
      if (failed.length) toast.error(`Sync failed: ${failed[0].error || 'See event details below.'}`, { duration: 10000 });
      else toast.success('Sync completed successfully');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Sync request failed');
    } finally {
      setBusy(false);
    }
  };

  const retryDeadLetters = async () => {
    setBusy(true);
    try {
      const result = await provider.system?.retryDeadLetters?.();
      await provider.system?.forceSync?.();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await refetch();
      toast.success(`${result?.data?.requeuedCount || 0} dead-letter event(s) queued for retry`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not retry dead-letter events');
    } finally {
      setBusy(false);
    }
  };

  if (session && !isAuthorized) return <div className="p-8 text-center text-red-600">You do not have permission to view sync operations.</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            {onClose && <Button variant="outline" onClick={onClose} className="rounded-full mb-5"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>}
            <h1 className="text-3xl font-extrabold text-slate-900">Sync & Push Queue</h1>
            <p className="text-slate-500 mt-1">Monitor POS and Front Desk uploads, errors, and retries.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={retryDeadLetters} disabled={busy || !deadLetters.length}><RotateCcw className="mr-2 h-4 w-4" />Retry Dead Letters</Button>
            <Button onClick={forceSync} disabled={busy || !isOnline}><RefreshCw className={busy ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />Sync Now</Button>
          </div>
        </div>

        {data?.health && <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm"><div className="flex flex-wrap items-center gap-x-6 gap-y-2"><span className="font-bold text-slate-800">Push engine: <span className={data.health.network === 'ONLINE' ? 'text-emerald-600' : 'text-amber-600'}>{data.health.network || 'UNKNOWN'}</span></span><span className="text-slate-500">Last attempt: <strong className="text-slate-700">{data.health.lastPushAttemptAt ? new Date(data.health.lastPushAttemptAt).toLocaleString() : 'Never'}</strong></span><span className="text-slate-500">Batch: <strong className="text-slate-700">{data.health.lastPushBatchSize ?? 0}</strong></span><span className="text-slate-500">HTTP: <strong className="text-slate-700">{data.health.lastPushHttpStatus ?? '—'}</strong></span></div>{data.health.lastPushEndpoint && <p className="mt-2 truncate font-mono text-xs text-slate-400">{data.health.lastPushEndpoint}</p>}</div>}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[
          ['Pending', pending.length, 'text-amber-600'], ['Conflicts', conflicts.length, 'text-red-600'], ['Dead Letters', deadLetters.length, 'text-rose-700'], ['Synced', synced.length, 'text-emerald-600'], ['Total', events.length, 'text-slate-900'],
        ].map(([label, count, color]) => <div key={String(label)} className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className={`text-2xl font-black ${color}`}>{count}</p></div>)}</div>

        {events.length === 0 ? <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500"><CheckCircle2 className="mx-auto mb-3 text-emerald-500" /><p>No local sync events found.</p></div> : <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-5 border-b border-slate-200 flex items-center justify-between"><h2 className="font-bold text-slate-900">All Local Push Events</h2><span className="text-xs text-slate-500">Auto-refreshes every 5 seconds</span></div><div className="divide-y divide-slate-100">{events.map(event => <div key={`${event.source}-${event.id}`} className="p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 mb-1"><span className={`text-xs font-black px-2 py-1 rounded-full ${event.source === 'POS' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>{event.source}</span><span className="font-bold text-slate-800">{event.type}</span><span className="text-xs text-slate-500">{event.aggregate}</span></div><p className="text-xs font-mono text-slate-400 truncate">ID: {event.id}</p>{event.error && <p className="mt-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg px-3 py-2 break-words">{event.error}</p>}</div><div className="flex items-center gap-4 md:justify-end shrink-0"><div className="text-right text-xs text-slate-500"><p className="font-bold">{event.status}</p><p>Attempts: {event.attempts}</p>{event.createdAt && <p>{new Date(event.createdAt).toLocaleString()}</p>}</div>{event.status === 'SYNCED' ? <CheckCircle2 className="text-emerald-500" /> : event.status === 'CONFLICT' ? <AlertTriangle className="text-red-500" /> : event.status === 'FAILED' || deadLetters.some(item => item.id === event.id) ? <XCircle className="text-rose-500" /> : <Clock className="text-amber-500" />}</div></div>)}</div></div>}
      </div>
    </div>
  );
}
