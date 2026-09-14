'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Loader2, Clock, ChefHat, Play, Check, X, Maximize2 } from 'lucide-react';
import { formatDistanceToNowStrict, differenceInMinutes } from 'date-fns';

type PosProductionBatchStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'ACKNOWLEDGED';

interface BatchItem {
  id: string;
  productName: string;
  quantity: number;
  modifiers: any;
  course: number | null;
  voided?: boolean;
}

interface Batch {
  id: string;
  batchNumber: number;
  station: string;
  status: PosProductionBatchStatus;
  firedAt: string;
  items: BatchItem[];
  order: {
    orderNumber: string;
    orderType: string;
    displayName: string | null;
    tableNumber: string | null;
    guestCount: number;
    serverStaff: { firstName: string; lastName: string } | null;
    outlet: { name: string };
  };
}

const SLA_WARNING_MINUTES = 15;
const SLA_CRITICAL_MINUTES = 25;

function BatchCard({ batch, onTransition }: { batch: Batch, onTransition: (id: string, s: PosProductionBatchStatus) => void }) {
  const [elapsed, setElapsed] = useState('');
  const [mins, setMins] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date(batch.firedAt);
      setElapsed(formatDistanceToNowStrict(d));
      setMins(differenceInMinutes(new Date(), d));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000); // update every 10s
    return () => clearInterval(interval);
  }, [batch.firedAt]);

  const isWarning = mins >= SLA_WARNING_MINUTES && mins < SLA_CRITICAL_MINUTES;
  const isCritical = mins >= SLA_CRITICAL_MINUTES;

  let borderColor = 'border-slate-800';
  let headerBg = 'bg-slate-900';
  let timerColor = 'text-slate-400';

  if (batch.status === 'PENDING' || batch.status === 'PREPARING') {
    if (isCritical) {
      borderColor = 'border-red-500/40 shadow-sm shadow-red-900/20';
      headerBg = 'bg-red-950/20';
      timerColor = 'text-red-500';
    } else if (isWarning) {
      borderColor = 'border-amber-500/40';
      headerBg = 'bg-amber-950/20';
      timerColor = 'text-amber-500';
    }
  } else if (batch.status === 'READY') {
    borderColor = 'border-emerald-500/30';
    headerBg = 'bg-emerald-950/20';
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl bg-slate-900 border transition-all duration-300 ${borderColor}`}>
      {/* Header */}
      <div className={`flex items-start justify-between border-b border-slate-800 p-4 ${headerBg}`}>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xl font-black tracking-tight text-white">#{batch.order.orderNumber}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase tracking-wider">{batch.order.orderType}</span>
            {batch.order.tableNumber && (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider">
                TBL {batch.order.tableNumber}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">{batch.order.outlet.name} • {batch.station}</span>
        </div>
        
        <div className="flex flex-col items-end shrink-0 ml-2">
          <div className={`flex items-center gap-1.5 text-lg font-bold tabular-nums ${timerColor}`}>
            {isCritical && (
              <span className="relative flex h-2.5 w-2.5 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
            <Clock className="h-4 w-4" /> {elapsed}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 p-4 bg-slate-950/40">
        <ul className="space-y-4">
          {batch.items.map(item => (
            <li key={item.id} className={`flex flex-col ${item.voided ? 'opacity-40 line-through' : ''}`}>
              <div className="flex items-start gap-3 text-base font-semibold text-slate-100">
                <span className="min-w-[28px] rounded bg-slate-800 px-1.5 py-0.5 text-center text-emerald-400 tabular-nums">
                  {Number(item.quantity)}
                </span>
                <span className="leading-snug pt-0.5">{item.productName}</span>
              </div>
              {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                <div className="ml-10 mt-1.5 space-y-1">
                  {Object.entries(item.modifiers).map(([k, v]: any) => (
                    <div key={k} className="text-sm font-medium text-slate-400 flex items-start gap-1.5 before:content-['+'] before:text-slate-600 before:font-bold">
                      {v.name || k}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        {batch.status === 'PENDING' && (
          <button onClick={() => onTransition(batch.id, 'PREPARING')} className="w-full flex h-12 md:h-14 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-base md:text-lg font-bold text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700 shadow-md">
            <Play className="h-5 w-5 fill-current" /> Start Prep
          </button>
        )}
        {batch.status === 'PREPARING' && (
          <button onClick={() => onTransition(batch.id, 'READY')} className="w-full flex h-12 md:h-14 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-base md:text-lg font-bold text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700 shadow-md">
            <Check className="h-5 w-5" strokeWidth={3} /> Ready
          </button>
        )}
        {batch.status === 'READY' && (
          <button onClick={() => onTransition(batch.id, 'COMPLETED')} className="w-full flex h-12 md:h-14 items-center justify-center gap-2 rounded-lg bg-slate-700 text-base md:text-lg font-bold text-slate-200 transition-colors hover:bg-slate-600 active:bg-slate-800">
            <X className="h-5 w-5" strokeWidth={3} /> Bump Ticket
          </button>
        )}
      </div>
    </div>
  );
}

export default function KitchenDisplaySystem() {
  const { propertyId } = useProperty();
  const [station, setStation] = useState('ALL');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    if (!propertyId || document.hidden) return; // Save cost when tab is inactive
    try {
      const res = await fetch(`/api/v1/fnb/kitchen/batches?propertyId=${propertyId}&station=${station}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || 'Failed to fetch batches');
      setBatches(body.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [propertyId, station]);

  useEffect(() => {
    fetchBatches();
    const interval = setInterval(fetchBatches, 12000); // Poll every 12 seconds
    
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchBatches(); // fetch immediately when returning to tab
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchBatches]);

  const handleTransition = async (batchId: string, status: PosProductionBatchStatus) => {
    // Optimistic update
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status } : b));
    
    try {
      const res = await fetch(`/api/v1/fnb/kitchen/batches/${batchId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message || 'Transition failed');
      }
      fetchBatches();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      fetchBatches(); // Revert optimistic update
    }
  };

  const pending = batches.filter(b => b.status === 'PENDING');
  const preparing = batches.filter(b => b.status === 'PREPARING');
  const ready = batches.filter(b => b.status === 'READY');

  const availableStations = useMemo(() => {
    const s = new Set<string>();
    batches.forEach(b => s.add(b.station));
    // Default stations if none present
    if (s.size === 0) return ['KITCHEN', 'BAR'];
    return Array.from(s);
  }, [batches]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  };

  if (loading && batches.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Kitchen Display System</h1>
            {error && <p className="text-xs font-medium text-red-400">{error}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select 
            value={station} 
            onChange={e => setStation(e.target.value)}
            className="h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-bold text-slate-200 outline-none hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors appearance-none cursor-pointer pr-10 relative"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
          >
            <option value="ALL">All Stations</option>
            {availableStations.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button 
            onClick={toggleFullscreen} 
            className="flex h-11 px-4 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-700"
          >
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Fullscreen</span>
          </button>
        </div>
      </header>

      {/* KDS Grid */}
      <main className="flex-1 overflow-x-auto p-4 sm:p-6">
        <div className="grid min-w-[1024px] grid-cols-3 gap-6 h-[calc(100vh-7rem)]">
          
          {/* Column 1: Pending */}
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-900/50 p-4 border border-slate-800/80 shadow-inner">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                Pending
              </h2>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-black text-slate-300 shadow-sm tabular-nums">
                {pending.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600">
              {pending.map(b => (
                <BatchCard key={b.id} batch={b} onTransition={handleTransition} />
              ))}
            </div>
          </div>

          {/* Column 2: Preparing */}
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-900/50 p-4 border border-slate-800/80 shadow-inner">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                Preparing
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </h2>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-black text-emerald-400 shadow-sm tabular-nums">
                {preparing.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600">
              {preparing.map(b => (
                <BatchCard key={b.id} batch={b} onTransition={handleTransition} />
              ))}
            </div>
          </div>

          {/* Column 3: Ready */}
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-900/50 p-4 border border-slate-800/80 shadow-inner">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black uppercase tracking-widest text-emerald-300/70 flex items-center gap-2">
                Ready for Service
              </h2>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-black text-emerald-300/70 shadow-sm tabular-nums">
                {ready.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600">
              {ready.map(b => (
                <BatchCard key={b.id} batch={b} onTransition={handleTransition} />
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
