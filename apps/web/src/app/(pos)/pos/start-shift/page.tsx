'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, DollarSign, LogOut, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { signOut } from 'next-auth/react';

export default function StartShiftPage() {
  const router = useRouter();
  const { provider } = useLodgeCoreProvider();
  const { data: session, status } = useLodgeCoreSession();
  
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [openingCash, setOpeningCash] = useState('');
  
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  // If already have a session, redirect to pos
  useEffect(() => {
    const activeSessionId = (session as any)?.sessionId || localStorage.getItem('lodgecore_pos_session_id');
    if (activeSessionId) {
      router.push('/pos');
    }
  }, [session, router]);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      const storedDeviceId = localStorage.getItem('lodgecore_pos_device_id');
      if (!storedDeviceId) {
        // Redirect to device registration if not registered
        router.push('/pos/device-registration');
        return;
      }
      setDeviceId(storedDeviceId);

      const fetchContext = async () => {
        try {
          const propertyId = (session.user as any).propertyId;
          const res = await provider.pos.getAuthorizedOutlets(propertyId, storedDeviceId);
          
          if (res.data?.device) {
            setDeviceInfo(res.data.device);
          }

          if (res.error) {
            setError(res.error);
            setIsLoadingContext(false);
            return;
          }

          setDeviceInfo(res.data?.device);
          setOutlets(res.data?.outlets || []);
          
          if (res.data?.outlets && res.data.outlets.length === 1) {
            setSelectedOutlet(res.data.outlets[0].id);
          } else if (res.data?.outlets && res.data.outlets.length > 0) {
            setSelectedOutlet(res.data.outlets[0].id); // default to first
          }
        } catch (e: any) {
          setError('Failed to fetch POS context: ' + e.message);
        } finally {
          setIsLoadingContext(false);
        }
      };

      fetchContext();
    }
  }, [status, session, provider, router]);

  const handleStartShift = async () => {
    if (!selectedOutlet) {
      setError('Please select an outlet.');
      return;
    }

    setIsStarting(true);
    setError('');
    
    try {
      const res = await provider.pos.startSession({
        userId: (session?.user as any)?.id || '',
        propertyId: (session?.user as any)?.propertyId || '',
        deviceId: deviceId!,
        outletId: selectedOutlet,
        openingCash: Number(openingCash) || 0
      });
      
      if (res.data?.sessionId) {
        localStorage.setItem('lodgecore_pos_session_id', res.data.sessionId);
        window.location.href = '/pos';
      } else {
        setError('Failed to start shift: ' + (res.error || 'Unknown error'));
        setIsStarting(false);
      }
    } catch (e: any) {
      setError('Error: ' + e.message);
      setIsStarting(false);
    }
  };

  if (status === 'loading' || (session as any)?.sessionId || isLoadingContext) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
      
      {/* Logout Button */}
      <button 
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 transition-colors shadow-lg"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-sm font-bold">Logout</span>
      </button>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">START POS SHIFT</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-200 text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-6">
          
          {/* Outlet Selection / Binding */}
          <div className="space-y-2 pb-4 border-b border-white/10">
            {outlets.length === 1 ? (
              <div className="text-center">
                <div className="text-xl font-bold text-indigo-300">{outlets[0].name}</div>
                <div className="text-sm font-medium text-slate-400 mt-1">{deviceInfo?.name || 'Unknown Device'}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Select Outlet</label>
                <select 
                  value={selectedOutlet}
                  onChange={e => setSelectedOutlet(e.target.value)}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 text-white text-lg rounded-xl focus:ring-indigo-500 focus:border-indigo-500 appearance-none outline-none"
                >
                  <option value="" disabled className="text-gray-800">Choose an outlet...</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id} className="text-gray-800">{o.name}</option>
                  ))}
                </select>
                <div className="text-xs text-slate-400 text-right mt-1">Terminal: {deviceInfo?.name || 'Unknown'}</div>
              </div>
            )}
          </div>

          {/* Cashier Info */}
          <div className="space-y-1 text-center pb-4 border-b border-white/10">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cashier</label>
            <div className="text-lg font-medium text-white">{session?.user?.name || session?.user?.email}</div>
          </div>

          {/* Opening Float */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block text-center">Opening Cash</label>
            <div className="relative max-w-[200px] mx-auto">
              <span className="absolute left-4 top-3 text-slate-400 font-semibold">₦</span>
              <Input 
                type="number"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                placeholder="0.00"
                className="h-14 pl-8 bg-white/5 border-white/10 text-white text-center text-xl font-bold rounded-2xl focus:ring-indigo-500"
                autoFocus
              />
            </div>
            
            <div className="flex justify-center items-center gap-2 mt-4">
              <input 
                type="checkbox" 
                id="no-float" 
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-indigo-500"
                onChange={(e) => {
                  if (e.target.checked) {
                    setOpeningCash('0');
                  } else {
                    if (openingCash === '0') setOpeningCash('');
                  }
                }}
                checked={openingCash === '0'}
              />
              <label htmlFor="no-float" className="text-sm text-slate-300 select-none cursor-pointer">
                Start with ₦0 Float
              </label>
            </div>
          </div>

          <Button 
            onClick={handleStartShift}
            disabled={isStarting || openingCash === '' || isNaN(Number(openingCash))}
            className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98]"
          >
            {isStarting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Open Drawer & Start Shift'}
          </Button>
        </div>
      </div>

    </div>
  );
}
