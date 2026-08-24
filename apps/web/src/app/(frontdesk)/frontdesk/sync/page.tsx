'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Clock, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { format } from 'date-fns';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

export default function SyncCenterPage() {
  const router = useRouter();
  const { data: session } = useLodgeCoreSession();
  const { provider, isOnline, syncStatus } = useLodgeCoreProvider();
  const [isForceSyncing, setIsForceSyncing] = useState(false);

  const role = (session?.user as any)?.role;
  const isAuthorized = role === 'ADMIN' || role === 'MANAGER' || role === 'SYSTEM_ADMIN' || role === 'RECEPTIONIST' || role === 'FRONT_DESK';

  // If unauthorized, return early
  if (session && !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500 mb-6">You do not have the required permissions (ACCESS_SYNC_MANAGEMENT) to view the Sync Center.</p>
        <Button onClick={() => router.push('/frontdesk')}>Return to Dashboard</Button>
      </div>
    );
  }

  const { data: outboxData, refetch } = useQuery({
    queryKey: ['frontdesk', 'outboxEvents'],
    queryFn: async () => {
      if (provider.system?.getOutboxEvents) {
        return provider.system.getOutboxEvents();
      }
      return { success: false, data: [] };
    },
    refetchInterval: 5000,
    enabled: isAuthorized, // Only fetch if authorized
  });

  const handleForceSync = async () => {
    setIsForceSyncing(true);
    if (provider.system?.forceSync) {
      await provider.system.forceSync();
    }
    setTimeout(() => {
      refetch();
      setIsForceSyncing(false);
    }, 2000);
  };

  const events = outboxData?.data || [];
  const pendingEvents = events.filter((e: any) => e.Status === 'PENDING' || e.Status === 'FAILED');
  const conflictEvents = events.filter((e: any) => e.Status === 'CONFLICT');
  const syncedEvents = events.filter((e: any) => e.Status === 'SYNCED');

  const lastSyncTime = syncedEvents.length > 0 ? syncedEvents[0].SyncedAt : null;

  return (
    <div className="p-8 max-w-5xl mx-auto pb-24 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 animate-in slide-in-from-top-4 duration-500">
        <div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/frontdesk')} 
            className="rounded-full h-10 px-4 shadow-sm border-slate-200 text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">LodgeCore Sync Center</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage offline operations and connectivity.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Status Card */}
        <div className="col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isOnline ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
            }`}>
              {isOnline ? <CheckCircle2 className="w-8 h-8" /> : <CloudOff className="w-8 h-8" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {isOnline ? 'Connected to Cloud' : 'Offline Mode'}
              </h2>
              <p className="text-slate-500 font-medium">
                Last Sync: {lastSyncTime ? format(new Date(lastSyncTime), 'h:mm a') : 'Never'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleForceSync}
            disabled={!isOnline || isForceSyncing}
            className="rounded-full h-12 px-6 font-bold shadow-sm"
          >
            <RefreshCw className={`mr-2 h-5 w-5 ${isForceSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </div>

        {/* Stats Card */}
        <div className="bg-slate-900 rounded-3xl p-6 shadow-sm text-white flex flex-col justify-center">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-400 font-medium">Pending Operations</span>
            <span className="text-2xl font-bold">{pendingEvents.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-medium">Sync Conflicts</span>
            <span className="text-2xl font-bold text-red-400">{conflictEvents.length}</span>
          </div>
        </div>
      </div>

      {/* Conflicts Section */}
      {conflictEvents.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <AlertTriangle className="text-red-500 w-6 h-6" /> Requires Attention
          </h3>
          <div className="space-y-4">
            {conflictEvents.map((evt: any) => (
              <div key={evt.Id} className="bg-red-50 rounded-2xl p-5 border border-red-200 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 bg-red-200 text-red-800 text-xs font-bold rounded-full uppercase">
                      {evt.OperationType.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-bold text-slate-700">Entity: {evt.EntityId.substring(0, 8)}...</span>
                  </div>
                  <p className="text-red-700 font-medium">{evt.LastError || 'Conflict occurred during synchronization.'}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>ID: {evt.Id.substring(0, 8)}</p>
                  <p>{format(new Date(evt.CreatedAt), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Section */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Clock className="text-amber-500 w-6 h-6" /> Pending Operations
        </h3>
        
        {pendingEvents.length === 0 ? (
          <div className="text-center p-12 bg-slate-50 rounded-3xl border border-slate-100">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900">All caught up</h3>
            <p className="text-slate-500">There are no pending operations to synchronize.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingEvents.map((evt: any) => (
              <div key={evt.Id} className="bg-white rounded-2xl p-5 border border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full uppercase">
                      {evt.OperationType.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-bold text-slate-700">Entity: {evt.EntityId.substring(0, 8)}...</span>
                  </div>
                  {evt.Status === 'FAILED' && evt.LastError && (
                    <p className="text-amber-600 text-sm font-medium mt-1">Failed (Retry {evt.AttemptCount}): {evt.LastError}</p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{format(new Date(evt.CreatedAt), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
