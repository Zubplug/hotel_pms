'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Server, Database, RefreshCw, Activity, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { getSystemHealth } from '@/lib/night-audit-actions';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';

export default function SystemSyncPage() {
  const { propertyId } = useProperty();
  const { isOnline, isDesktopMode } = useLodgeCoreProvider();
  const isDesktopApp = HardwareBridge.isAvailable();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propertyId) {
      setLoading(true);
      getSystemHealth(propertyId).then(res => {
        setData(res);
        setLoading(false);
      });
    }
  }, [propertyId]);

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
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Force Sync All
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-cyan-200 dark:border-cyan-900/50 shadow-sm col-span-2">
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

        <div className="space-y-6">
          <Card className="border-blue-200 dark:border-blue-900/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-500" />
                Database Backup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mt-2">
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium">Backup Completed</p>
                  <p className="text-sm text-muted-foreground">Today at 02:00 AM</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full text-sm">View Backup Logs</Button>
            </CardFooter>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-5 w-5 text-slate-500" />
                Server Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>CPU Usage</span>
                    <span className="font-medium">32%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-900 dark:bg-slate-400 w-[32%] rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Memory</span>
                    <span className="font-medium">4.2 GB / 8 GB</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-900 dark:bg-slate-400 w-[52%] rounded-full" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
