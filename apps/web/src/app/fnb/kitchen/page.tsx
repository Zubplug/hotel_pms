'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Loader2, Clock, ChefHat, Play, Check, RotateCcw, AlertCircle, X, Maximize2 } from 'lucide-react';
import { formatDistanceToNowStrict, differenceInMinutes } from 'date-fns';

type PosProductionBatchStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'RECALLED';

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

  let borderColor = 'border-slate-200';
  if (batch.status === 'PENDING' || batch.status === 'PREPARING') {
    if (isCritical) borderColor = 'border-rose-400';
    else if (isWarning) borderColor = 'border-amber-400';
  }
  if (batch.status === 'RECALLED') borderColor = 'border-rose-400/80';
  if (batch.status === 'READY') borderColor = 'border-emerald-500/50';

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border ${borderColor} bg-white shadow-xl transition-all`}>
      {/* Header */}
      <div className={`flex items-center justify-between border-b border-slate-200 p-3 ${
        batch.status === 'RECALLED' ? 'bg-rose-50' : 
        batch.status === 'READY' ? 'bg-emerald-50' :
        isCritical ? 'bg-rose-50' : 
        isWarning ? 'bg-amber-50' : 'bg-slate-50'
      }`}>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-500">
            {batch.order.orderType} {batch.order.tableNumber ? `· TBL ${batch.order.tableNumber}` : ''}
          </span>
          <span className="text-sm font-bold text-slate-900">#{batch.order.orderNumber} - {batch.order.outlet.name}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`flex items-center gap-1 text-sm font-bold tabular-nums ${isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-500'}`}>
            <Clock className="h-3.5 w-3.5" /> {elapsed}
          </span>
          <span className="text-[10px] uppercase text-slate-500">{batch.station}</span>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 p-3">
        <ul className="space-y-3">
          {batch.items.map(item => (
            <li key={item.id} className={`flex flex-col ${item.voided ? 'opacity-50 line-through' : ''}`}>
              <div className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                <span className="min-w-[20px] text-indigo-600">{Number(item.quantity)}x</span>
                <span>{item.productName}</span>
              </div>
              {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                <div className="ml-7 mt-0.5 text-xs text-slate-500">
                  {Object.entries(item.modifiers).map(([k, v]: any) => (
                    <div key={k}>+ {v.name || k}</div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-1 border-t border-slate-200 p-1 bg-slate-50">
        {batch.status === 'PENDING' && (
          <button onClick={() => onTransition(batch.id, 'PREPARING')} className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-200">
            <Play className="h-4 w-4" /> Start Prep
          </button>
        )}
        {batch.status === 'PREPARING' && (
          <>
            <button onClick={() => onTransition(batch.id, 'READY')} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-100 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-200">
              <Check className="h-4 w-4" /> Ready
            </button>
            <button onClick={() => onTransition(batch.id, 'RECALLED')} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-100 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-200">
              <AlertCircle className="h-4 w-4" /> Recall
            </button>
          </>
        )}
        {batch.status === 'READY' && (
          <>
            <button onClick={() => onTransition(batch.id, 'COMPLETED')} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-200 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-300">
              <X className="h-4 w-4" /> Bump
            </button>
            <button onClick={() => onTransition(batch.id, 'RECALLED')} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-100 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-200">
              <AlertCircle className="h-4 w-4" /> Recall
            </button>
          </>
        )}
        {batch.status === 'RECALLED' && (
          <button onClick={() => onTransition(batch.id, 'PENDING')} className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-100 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-200">
            <RotateCcw className="h-4 w-4" /> Return to Pending
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

  const pending = batches.filter(b => b.status === 'PENDING' || b.status === 'RECALLED');
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
      <div className="flex min-h-[80vh] items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Navbar */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Kitchen Display System</h1>
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select 
            value={station} 
            onChange={e => setStation(e.target.value)}
            className="h-9 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-100"
          >
            <option value="ALL">All Stations</option>
            {availableStations.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button onClick={toggleFullscreen} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* KDS Grid */}
      <main className="flex-1 overflow-x-auto p-4 sm:p-6">
        <div className="grid min-w-[1000px] grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
          {/* Column 1: Pending & Recalled */}
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-100 p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">Pending</h2>
              <span className="rounded-full bg-slate-300 px-2 py-0.5 text-xs font-bold text-slate-700">{pending.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
              {pending.map(b => (
                <BatchCard key={b.id} batch={b} onTransition={handleTransition} />
              ))}
            </div>
          </div>

          {/* Column 2: Preparing */}
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-100 p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-600">Preparing</h2>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">{preparing.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
              {preparing.map(b => (
                <BatchCard key={b.id} batch={b} onTransition={handleTransition} />
              ))}
            </div>
          </div>

          {/* Column 3: Ready */}
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-100 p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-600">Ready</h2>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{ready.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
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
