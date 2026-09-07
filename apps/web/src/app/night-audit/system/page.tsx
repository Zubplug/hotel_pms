'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, CheckCircle2, AlertCircle, Loader2, ServerCrash, ArrowRight, ShieldAlert, Server } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { getSystemHealth } from '@/lib/night-audit-actions';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PayloadDisplay = ({ payload, title, subtitle, isEdge = false }: { payload: any, title: string, subtitle: string, isEdge?: boolean }) => {
  if (!payload) return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
      <ServerCrash className="mb-2 h-6 w-6 text-slate-400" />
      <span className="text-sm italic text-slate-500">{title} not available</span>
    </div>
  );
  
  const formatKey = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  
  return (
    <div className={cn(
      "flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md",
      isEdge ? "border-indigo-100 bg-indigo-50/30 dark:border-indigo-900/30 dark:bg-indigo-900/10" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    )}>
      <div className={cn(
        "border-b p-4",
        isEdge ? "border-indigo-100 bg-indigo-50/80 dark:border-indigo-900/50 dark:bg-indigo-900/30" : "border-slate-100 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-800/50"
      )}>
        <h4 className={cn("text-sm font-bold tracking-tight", isEdge ? "text-indigo-900 dark:text-indigo-300" : "text-slate-800 dark:text-slate-200")}>{title}</h4>
        <p className={cn("mt-1 text-xs", isEdge ? "text-indigo-600/80 dark:text-indigo-400/80" : "text-slate-500")}>{subtitle}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {Object.entries(payload).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between rounded-lg p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 sm:w-1/3 pt-0.5">
                {formatKey(key)}
              </span>
              <span className={cn(
                "break-words text-sm font-medium sm:w-2/3 sm:text-right",
                isEdge ? "text-indigo-950 dark:text-indigo-100" : "text-slate-900 dark:text-slate-100"
              )}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function SystemSyncPage() {
  const { propertyId } = useProperty();
  const { isOnline, isDesktopMode } = useLodgeCoreProvider();
  const isDesktopApp = HardwareBridge.isAvailable();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchConflicts = async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/v1/sync/conflicts?propertyId=${propertyId}`);
      if (res.ok) {
        const data = await res.json();
        setConflicts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (propertyId) {
      setLoading(true);
      Promise.all([
        getSystemHealth(propertyId).then(res => setData(res)),
        fetchConflicts()
      ]).then(() => setLoading(false));
    }
  }, [propertyId]);

  const handleResolve = async (id: string, action: string) => {
    if (!confirm('Are you sure you want to apply this resolution? No silent financial adjustments are made; this will enforce the selected state as authoritative.')) return;
    
    setResolvingId(id);
    try {
      const res = await fetch(`/api/v1/sync/conflicts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resolutionComment: 'Manual resolution via Night Audit' })
      });
      
      const result = await res.json();
      if (res.ok) {
        toast.success('Conflict resolved successfully.');
        fetchConflicts();
      } else {
        toast.error(`Resolution Failed: ${result.error}`);
      }
    } catch (err) {
      toast.error('Server error during resolution.');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
      <p className="text-sm font-medium text-slate-500 animate-pulse">Loading system diagnostics...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
      {/* Header Section */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-8 text-white shadow-xl sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 shadow-inner ring-1 ring-white/20">
              <Server className="h-4 w-4 text-indigo-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">System & Sync</h1>
          </div>
          <p className="text-sm font-medium text-indigo-200/80 max-w-md leading-relaxed">
            Monitor real-time hardware bridges, resolve edge synchronization conflicts, and maintain data integrity.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200/50 dark:ring-slate-800/50 rounded-2xl">
          <div className="absolute top-0 h-1 w-full bg-gradient-to-r from-cyan-400 to-blue-500" />
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-cyan-500" />
              Interface Status
            </CardTitle>
            <CardDescription>Live connection status for your hardware agents and external integrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Desktop App Local Hardware Override */}
            {isDesktopApp && (
              <div className="group rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 transition-all hover:bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-950 dark:text-emerald-100">LodgeCore Desktop (Local)</span>
                      <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Direct hardware connection active</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400">Connected</Badge>
                </div>
              </div>
            )}

            {data?.hardware?.map((agent: any) => (
              <div key={agent.id} className="group rounded-xl border border-slate-200 bg-white p-4 transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      agent.status === 'ONLINE' ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-rose-100 dark:bg-rose-900/50"
                    )}>
                      {agent.status === 'ONLINE' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{agent.name}</span>
                      <p className="text-xs text-slate-500">Last seen: Just now</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    agent.status === 'ONLINE' ? "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 border-rose-200 dark:border-rose-800 dark:text-rose-400"
                  )}>
                    {agent.status === 'ONLINE' ? 'Connected' : 'Offline'}
                  </Badge>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={cn("h-full w-full rounded-full transition-all duration-500", agent.status === 'ONLINE' ? "bg-emerald-500" : "bg-rose-500")} />
                </div>
              </div>
            ))}

            {data?.hardware?.length === 0 && !isDesktopApp && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
                <Server className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                <span className="text-sm font-medium text-slate-500">No hardware agents configured.</span>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg shadow-inner",
                    data?.syncConflicts > 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  )}>
                    {data?.syncConflicts > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Offline Sync Queue</span>
                    <p className="text-xs text-slate-500">Pending events waiting to be synchronized</p>
                  </div>
                </div>
                <span className={cn(
                  "font-bold text-lg",
                  data?.syncConflicts > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {data?.syncConflicts} Pending
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  data?.syncConflicts > 0 ? "bg-gradient-to-r from-amber-400 to-orange-500 w-[45%]" : "bg-gradient-to-r from-emerald-400 to-emerald-500 w-full"
                )} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Conflicts Section */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Synchronization Conflicts</h2>
              <p className="text-sm font-medium text-slate-500">Review and resolve offline structural conflicts</p>
            </div>
          </div>
          {conflicts.length > 0 && (
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 py-1.5 px-3 shadow-sm dark:bg-rose-900/20 dark:border-rose-800/50 dark:text-rose-400">
              {conflicts.length} Action{conflicts.length !== 1 && 's'} Required
            </Badge>
          )}
        </div>

        {conflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-16 text-center dark:border-emerald-900/30 dark:bg-emerald-900/10">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 shadow-inner dark:bg-emerald-900/50">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-emerald-950 dark:text-emerald-100">System Healthy</h3>
            <p className="mt-2 text-emerald-700/80 dark:text-emerald-400/80 max-w-sm">
              All edge devices are perfectly in sync. There are currently no active synchronization conflicts requiring resolution.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {conflicts.map(conflict => {
              const isCritical = conflict.severity === 'CRITICAL';
              return (
                <Card key={conflict.id} className="overflow-hidden rounded-2xl border-0 shadow-lg ring-1 ring-slate-200/50 dark:ring-slate-800/50">
                  <div className={cn(
                    "absolute top-0 left-0 w-1.5 h-full",
                    isCritical ? "bg-rose-500" : "bg-slate-400"
                  )} />
                  <CardHeader className="bg-white pl-8 pb-4 dark:bg-slate-950">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-xl font-bold capitalize">
                            {conflict.edgeEvent.eventType.toLowerCase().replace(/_/g, ' ')}
                          </CardTitle>
                          <Badge className={cn(
                            "shadow-sm",
                            isCritical ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-slate-600 hover:bg-slate-700 text-white"
                          )}>
                            {conflict.severity}
                          </Badge>
                        </div>
                        <CardDescription className="font-medium text-slate-500">
                          <span className="capitalize">{conflict.aggregateType.toLowerCase()}</span> &bull; {conflict.aggregateId}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs font-medium text-slate-500">
                        <span className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
                          Cloud Version <span className="font-bold text-slate-700 dark:text-slate-300">v{conflict.expectedVersion}</span>
                        </span>
                        <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          Edge Version <span className="font-bold text-indigo-900 dark:text-indigo-300">v{conflict.receivedVersion}</span>
                        </span>
                        <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                          <Activity className="h-3 w-3" />
                          {new Date(conflict.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pl-8 pt-4 pb-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/20">
                    <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 shadow-sm dark:border-rose-900/30 dark:bg-rose-900/10">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                      <div>
                        <h4 className="font-bold text-rose-900 dark:text-rose-200">Conflict Reason</h4>
                        <p className="mt-1 text-sm font-medium text-rose-700/90 dark:text-rose-300/90 leading-relaxed">
                          {conflict.conflictReason}
                        </p>
                      </div>
                    </div>

                    {isCritical && (
                      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-900/20">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200/50 dark:bg-amber-900/50">
                          <span className="text-xl">⚠️</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-amber-900 dark:text-amber-200">Financial Impact Detected</h4>
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300/90">
                            Review the payload carefully. No financial adjustment has been silently applied. You must manually force or discard this action.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid gap-4 lg:grid-cols-2 pt-2">
                      <PayloadDisplay 
                        title={`Cloud State (v${conflict.expectedVersion})`}
                        subtitle="Authoritative server state before event"
                        payload={conflict.cloudState}
                      />
                      <div className="hidden lg:flex items-center justify-center absolute left-1/2 -ml-3 mt-24 z-10 w-6 h-6 rounded-full bg-slate-200 border-2 border-white dark:bg-slate-700 dark:border-slate-950 shadow-sm">
                        <ArrowRight className="h-3 w-3 text-slate-500 dark:text-slate-300" />
                      </div>
                      <PayloadDisplay 
                        title={`Edge State (v${conflict.receivedVersion})`}
                        subtitle="Conflicting offline event data"
                        payload={conflict.edgeEvent.payload}
                        isEdge={true}
                      />
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Select a resolution strategy:
                      </div>
                      <div className="flex w-full sm:w-auto gap-3">
                        <Button 
                           variant="outline" 
                           className="flex-1 sm:flex-none border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/20 font-semibold transition-all"
                           disabled={resolvingId === conflict.id}
                           onClick={() => handleResolve(conflict.id, 'REJECT_EDGE_EVENT')}
                        >
                          Discard Edge Event
                        </Button>
                        <Button 
                           className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg font-semibold transition-all"
                           disabled={resolvingId === conflict.id}
                           onClick={() => handleResolve(conflict.id, 'FORCE_EDGE_EVENT')}
                        >
                          Force Apply Event
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
