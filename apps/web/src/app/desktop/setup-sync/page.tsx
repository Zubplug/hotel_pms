'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLodgeCoreProvider as useLodgeCore } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { Loader2, Server, CheckCircle2, AlertCircle, RefreshCw, WifiOff } from 'lucide-react';

export default function SetupSyncPage() {
  const router = useRouter();
  const { provider, isDesktopMode } = useLodgeCore();
  
  const [health, setHealth] = useState<any>(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    if (!isDesktopMode) {
      router.push('/desktop');
      return;
    }

    // Trigger force sync once on mount
    if (!hasTriggered && provider.system?.forceSync) {
      setHasTriggered(true);
      provider.system.forceSync().catch(console.error);
    }

    // Poll health every 500ms
    const interval = setInterval(async () => {
      try {
        if (provider.system?.getSyncHealth) {
          const res = await provider.system.getSyncHealth();
          if (res?.success && res.data) {
            setHealth(res.data);
            
            // If up to date, auto-redirect after a short delay
            if (res.data.sync === 'UP_TO_DATE' || res.data.sync === 'UpToDate') {
              clearInterval(interval);
              setTimeout(() => {
                router.push('/desktop');
              }, 1500);
            }
          }
        }
      } catch (e) {
        console.error('Failed to get sync health', e);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isDesktopMode, provider, hasTriggered, router]);

  const handleRetry = () => {
    if (provider.system?.forceSync) {
      provider.system.forceSync().catch(console.error);
    }
  };

  const renderIcon = () => {
    if (health?.network === 'OFFLINE' || health?.network === 'Offline') {
      return <WifiOff className="w-12 h-12 text-slate-400 mb-6" />;
    }
    if (health?.sync === 'ERROR' || health?.sync === 'Error') {
      return <AlertCircle className="w-12 h-12 text-red-500 mb-6" />;
    }
    if (health?.sync === 'UP_TO_DATE' || health?.sync === 'UpToDate') {
      return <CheckCircle2 className="w-12 h-12 text-green-500 mb-6" />;
    }
    return <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />;
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-lg bg-white rounded-[2rem] shadow-xl p-10 flex flex-col items-center text-center">
        {renderIcon()}

        <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">
          {health?.sync === 'UP_TO_DATE' || health?.sync === 'UpToDate'
            ? 'Ready to Sign In'
            : 'Initial Setup'}
        </h1>
        
        <p className="text-slate-500 mb-8 text-lg">
          {health?.sync === 'UP_TO_DATE' || health?.sync === 'UpToDate'
            ? 'Your terminal has been fully configured.'
            : 'Please wait while we synchronize data from LodgeCore Cloud.'}
        </p>

        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8 text-left space-y-4">
          <div className="flex items-center gap-3">
            {health?.network === 'OFFLINE' || health?.network === 'Offline' ? (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            )}
            <span className="font-medium text-slate-700">Connecting to LodgeCore Cloud</span>
          </div>

          <div className="flex items-center gap-3">
            {health?.sync === 'UP_TO_DATE' || health?.sync === 'UpToDate' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            ) : health?.sync === 'ERROR' || health?.sync === 'Error' ? (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            ) : health?.sync === 'SYNCING' || health?.sync === 'Syncing' ? (
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
            ) : (
              <div className="w-5 h-5 border-2 border-slate-300 rounded-full flex-shrink-0" />
            )}
            <div className="flex-1">
              <span className="font-medium text-slate-700">
                {health?.phase === 'STAFF' ? 'Downloading staff...' :
                 health?.phase === 'PREP' ? 'Preparing sync...' :
                 health?.sync === 'UP_TO_DATE' || health?.sync === 'UpToDate' ? 'Sync complete' :
                 'Synchronizing database'}
              </span>
              {(health?.sync === 'SYNCING' || health?.sync === 'Syncing') && health?.total > 0 && (
                <div className="text-sm text-slate-500 mt-1">
                  {health.current} / {health.total}
                </div>
              )}
            </div>
          </div>
        </div>

        {(health?.sync === 'ERROR' || health?.sync === 'Error' || health?.network === 'OFFLINE' || health?.network === 'Offline') && (
          <div className="w-full flex flex-col gap-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm font-medium">
              {health?.network === 'OFFLINE' || health?.network === 'Offline' 
                ? 'Internet connection unavailable. Please connect to the internet and try again.'
                : (health?.lastError || 'LodgeCore couldn\'t complete the initial synchronization.')}
            </div>
            <Button onClick={handleRetry} size="lg" className="w-full h-14 rounded-xl text-lg">
              <RefreshCw className="w-5 h-5 mr-2" />
              Retry Sync
            </Button>
            {health?.lastSyncAt && (
              <Button variant="outline" onClick={() => router.push('/desktop')} size="lg" className="w-full h-14 rounded-xl text-lg mt-2">
                Continue Offline (Cached Data)
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
