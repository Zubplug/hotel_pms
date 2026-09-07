'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Server, Database, RefreshCw, Activity, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { getSystemHealth } from '@/lib/night-audit-actions';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

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

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'CRITICAL': return 'bg-red-600';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-600 to-blue-500 bg-clip-text text-transparent">
            System & Sync
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor background jobs, interface syncs, and database backups.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => {
          toast('Information', { description: 'Sync is automatic — offline devices will sync when reconnected' });
        }}>
          <RefreshCw className="h-4 w-4" />
          Force Sync All
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="border-cyan-200 dark:border-cyan-900/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-500" />
              Interface Status
            </CardTitle>
            <CardDescription>Live connection status for external systems</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Desktop App Local Hardware Override */}
            {isDesktopApp && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    LodgeCore Desktop (Local)
                  </span>
                  <span className="text-muted-foreground">Connected</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-full rounded-full bg-emerald-500" />
                </div>
              </div>
            )}

            {data?.hardware?.map((agent: any) => (
              <div key={agent.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    {agent.status === 'ONLINE' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-500" />
                    )}
                    {agent.name}
                  </span>
                  <span className="text-muted-foreground">
                    {agent.status === 'ONLINE' ? 'Connected' : 'Offline'}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full w-full rounded-full ${agent.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </div>
              </div>
            ))}

            {data?.hardware?.length === 0 && !isDesktopApp && (
              <div className="text-sm text-muted-foreground">No hardware agents configured.</div>
            )}

            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium flex items-center gap-2">
                  {data?.syncConflicts > 0 ? (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  Offline Sync Queue
                </span>
                <span className={data?.syncConflicts > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-600 dark:text-emerald-400"}>
                  {data?.syncConflicts} Pending
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${data?.syncConflicts > 0 ? 'bg-amber-500 w-[45%]' : 'bg-emerald-500 w-full'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Conflicts Section */}
      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200">Synchronization Conflicts</h2>
            <p className="text-sm text-muted-foreground mt-1">Review and resolve edge synchronization conflicts requiring managerial oversight.</p>
          </div>
        </div>

        {conflicts.length === 0 && (
          <Card className="bg-slate-50 border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center p-12 text-slate-500">
              <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-500" />
              <h3 className="text-lg font-semibold">System Healthy</h3>
              <p>There are currently no active synchronization conflicts.</p>
            </CardContent>
          </Card>
        )}

        {conflicts.map(conflict => (
          <Card key={conflict.id} className="border-l-4" style={{ borderLeftColor: conflict.severity === 'CRITICAL' ? 'red' : 'gray' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-3">
                  {conflict.edgeEvent.eventType.replace('_', ' ')}
                  <Badge className={getSeverityColor(conflict.severity)}>{conflict.severity}</Badge>
                </CardTitle>
                <CardDescription>
                  Aggregate: {conflict.aggregateType} | ID: {conflict.aggregateId}
                </CardDescription>
              </div>
              <div className="text-sm text-gray-500 text-right">
                <p>Cloud Version: {conflict.expectedVersion}</p>
                <p>Edge Version: {conflict.receivedVersion}</p>
                <p>{new Date(conflict.createdAt).toLocaleString()}</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 text-red-800 text-sm p-3 rounded-md mb-4 font-mono">
                {conflict.conflictReason}
              </div>

              {conflict.severity === 'CRITICAL' && (
                <div className="bg-yellow-50 text-yellow-800 text-sm p-3 rounded-md mb-4 font-semibold border border-yellow-200">
                  ⚠️ FINANCIAL IMPACT DETECTED. Review the payload carefully. No financial adjustment has been silently applied.
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm font-mono bg-slate-50 p-4 rounded-md overflow-auto max-h-60 mb-6 border">
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 pb-1 border-b">Expected Cloud State (V{conflict.expectedVersion})</h4>
                  <p className="italic text-slate-500 text-xs mb-2">The current authoritative state in the cloud database before this event occurred.</p>
                  <pre>{conflict.cloudState ? JSON.stringify(conflict.cloudState, null, 2) : "Cloud state snapshot not available"}</pre>
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 pb-1 border-b">Received Edge State (V{conflict.receivedVersion})</h4>
                  <p className="italic text-slate-500 text-xs mb-2">The conflicting event that was generated offline on the edge node.</p>
                  <pre>{JSON.stringify(conflict.edgeEvent.payload, null, 2)}</pre>
                </div>
              </div>

              <div className="flex gap-4 items-center bg-slate-100 p-4 rounded-md">
                <p className="flex-1 text-sm font-medium">Resolution Actions:</p>
                <Button 
                   variant="outline" 
                   className="text-red-600 border-red-200 hover:bg-red-50"
                   disabled={resolvingId === conflict.id}
                   onClick={() => handleResolve(conflict.id, 'REJECT_EDGE_EVENT')}
                >
                  Discard Edge Event
                </Button>
                <Button 
                   className="bg-blue-600 hover:bg-blue-700 text-white"
                   disabled={resolvingId === conflict.id}
                   onClick={() => handleResolve(conflict.id, 'FORCE_EDGE_EVENT')}
                >
                  Force Apply Edge Event
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
