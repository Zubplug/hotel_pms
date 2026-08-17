'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, DollarSign, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { signOut } from 'next-auth/react';

export default function StartShiftPage() {
  const router = useRouter();
  const { provider } = useLodgeCoreProvider();
  const { data: session, status } = useLodgeCoreSession();
  
  const [openingCash, setOpeningCash] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  // If already have a session, redirect to pos
  useEffect(() => {
    if ((session as any)?.sessionId) {
      router.push('/pos');
    }
  }, [session, router]);

  const handleStartShift = async () => {
    setIsStarting(true);
    try {
      // IPC call to start shift (create PosSession locally)
      const res = await provider.pos.startSession({
        userId: session?.user?.id || '',
        propertyId: (session?.user as any)?.propertyId || '',
        openingCash: Number(openingCash) || 0
      });
      if (res.data?.sessionId) {
        // We must reload so useLodgeCoreSession picks up the new sessionId from desktop auth state
        window.location.href = '/pos';
      } else {
        alert('Failed to start shift: ' + (res.error || 'Unknown error'));
        setIsStarting(false);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
      setIsStarting(false);
    }
  };

  if (status === 'loading' || (session as any)?.sessionId) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin" /></div>;
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
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-3xl font-bold text-white">₦</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-white text-center tracking-tight mb-2">Start Shift</h1>
        <p className="text-slate-300 text-center mb-8">Enter the opening cash float for this drawer to begin your shift.</p>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200 ml-1">Opening Cash (Float)</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-slate-400 font-semibold">₦</span>
              <Input 
                type="number"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                placeholder="0.00"
                className="h-14 pl-8 bg-white/5 border-white/10 text-white text-lg rounded-2xl focus:ring-indigo-500"
                autoFocus
              />
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
