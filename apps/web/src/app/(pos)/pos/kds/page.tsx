'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

type Station = 'KITCHEN' | 'BAR';

type BatchStatus = 'PENDING' | 'ACKNOWLEDGED' | 'PREPARING' | 'READY' | 'COMPLETED';

interface BatchItem {
  productName: string;
  quantity: number;
  modifiers: string[] | null;
  course: number | null;
}

interface ProductionBatch {
  id: string;
  orderId: string;
  batchNumber: number;
  station: Station;
  status: BatchStatus;
  firedAt: string;
  items: BatchItem[];
  order: {
    orderNumber: string;
    tableNumber: string | null;
  };
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_SEQUENCE: BatchStatus[] = [
  'PENDING',
  'ACKNOWLEDGED',
  'PREPARING',
  'READY',
  'COMPLETED',
];

const STATUS_STYLES: Record<BatchStatus, { bg: string; text: string; label: string }> = {
  PENDING:      { bg: 'bg-slate-600/70',  text: 'text-slate-200',  label: 'PENDING' },
  ACKNOWLEDGED: { bg: 'bg-blue-600/80',   text: 'text-blue-100',   label: 'ACKNOWLEDGED' },
  PREPARING:    { bg: 'bg-orange-500/80', text: 'text-orange-100', label: 'PREPARING' },
  READY:        { bg: 'bg-emerald-500/80',text: 'text-emerald-100',label: 'READY ✓' },
  COMPLETED:    { bg: 'bg-emerald-700/90',text: 'text-emerald-100',label: 'COMPLETED ✓' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getElapsedSeconds(firedAt: string): number {
  return Math.floor((Date.now() - new Date(firedAt).getTime()) / 1000);
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function getBorderColor(seconds: number): string {
  const mins = seconds / 60;
  if (mins < 5) return 'border-emerald-500';
  if (mins < 10) return 'border-amber-400';
  return 'border-rose-500';
}

function getUrgencyGlow(seconds: number): string {
  const mins = seconds / 60;
  if (mins > 10) return 'shadow-[0_0_24px_rgba(239,68,68,0.3)]';
  if (mins > 5)  return 'shadow-[0_0_16px_rgba(251,191,36,0.2)]';
  return '';
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function getOutletId(): Promise<string | null> {
  const sessionId = localStorage.getItem('lodgecore_pos_session_id');
  if (!sessionId) return null;
  try {
    const res = await fetch(`/api/v1/pos/sessions/${sessionId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.outlet?.id ?? data?.outletId ?? null;
  } catch {
    return null;
  }
}

async function fetchBatches(outletId: string, station: Station): Promise<ProductionBatch[]> {
  const res = await fetch(
    `/api/v1/pos/outlets/${outletId}/production-batches?station=${station}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.batches ?? data?.data ?? []);
}

async function advanceBatchStatus(batchId: string, newStatus: BatchStatus): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/pos/production-batches/${batchId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Station Selector ─────────────────────────────────────────────────────────

function StationSelector({ onSelect }: { onSelect: (station: Station) => void }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-12 p-8">
      {/* Logo / Title */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl mb-6">
          <span className="text-white font-black text-3xl">L</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">LodgeCore</h1>
        <p className="text-slate-400 text-lg font-medium mt-2 tracking-wide">Production Display System</p>
      </div>

      {/* Station Buttons */}
      <div className="flex flex-col sm:flex-row gap-6">
        <button
          id="kds-select-kitchen"
          onClick={() => onSelect('KITCHEN')}
          className="group flex flex-col items-center justify-center gap-4 w-64 h-52 rounded-3xl border-2 border-slate-700 bg-slate-900 hover:border-orange-500 hover:bg-orange-950/30 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(249,115,22,0.3)] active:scale-95"
        >
          <span className="text-7xl group-hover:scale-110 transition-transform duration-300">🔥</span>
          <div className="text-center">
            <p className="text-xl font-black text-white tracking-tight">KITCHEN DISPLAY</p>
            <p className="text-sm text-slate-500 font-medium mt-1">Food production tickets</p>
          </div>
        </button>

        <button
          id="kds-select-bar"
          onClick={() => onSelect('BAR')}
          className="group flex flex-col items-center justify-center gap-4 w-64 h-52 rounded-3xl border-2 border-slate-700 bg-slate-900 hover:border-blue-500 hover:bg-blue-950/30 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(59,130,246,0.3)] active:scale-95"
        >
          <span className="text-7xl group-hover:scale-110 transition-transform duration-300">🍺</span>
          <div className="text-center">
            <p className="text-xl font-black text-white tracking-tight">BAR DISPLAY</p>
            <p className="text-sm text-slate-500 font-medium mt-1">Drinks &amp; cocktail tickets</p>
          </div>
        </button>
      </div>

      <p className="text-slate-600 text-sm">Tap a station to begin</p>
    </div>
  );
}

// ─── Batch Card ───────────────────────────────────────────────────────────────

interface BatchCardProps {
  batch: ProductionBatch;
  onTap: (batch: ProductionBatch) => void;
  isAdvancing: boolean;
  elapsedTick: number; // increments every 30s to trigger re-render
}

function BatchCard({ batch, onTap, isAdvancing, elapsedTick }: BatchCardProps) {
  const elapsed = getElapsedSeconds(batch.firedAt);
  const borderColor = getBorderColor(elapsed);
  const glow = getUrgencyGlow(elapsed);
  const statusStyle = STATUS_STYLES[batch.status];
  const nextStatus = STATUS_SEQUENCE[STATUS_SEQUENCE.indexOf(batch.status) + 1] as BatchStatus | undefined;

  return (
    <button
      id={`kds-card-${batch.id}`}
      onClick={() => !isAdvancing && onTap(batch)}
      disabled={isAdvancing || batch.status === 'COMPLETED'}
      className={`
        relative flex flex-col w-full text-left rounded-2xl border-2 ${borderColor} ${glow}
        bg-slate-800 transition-all duration-200
        hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]
        disabled:cursor-not-allowed disabled:opacity-70
        overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500
      `}
      aria-label={`Batch ${batch.batchNumber} for ${batch.order.orderNumber} - ${batch.status}`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-700/60">
        <div>
          <p className="text-2xl font-black text-white tracking-tight leading-none">
            {batch.order.orderNumber}
          </p>
          {batch.order.tableNumber && (
            <p className="text-slate-400 font-semibold text-sm mt-0.5">
              Table {batch.order.tableNumber}
            </p>
          )}
        </div>
        <div className="text-right shrink-0 ml-2">
          <span className="inline-block bg-slate-700 text-slate-300 text-xs font-black px-2 py-0.5 rounded-full mb-1">
            #{batch.batchNumber}
          </span>
          <p className="text-slate-500 text-xs font-medium whitespace-nowrap">
            {formatElapsed(elapsed)}
          </p>
        </div>
      </div>

      {/* Items List */}
      <div className="px-4 py-3 flex-1 space-y-2">
        {batch.items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="text-white font-black text-base leading-tight min-w-[1.5rem]">
              ×{item.quantity}
            </span>
            <div className="flex-1">
              <span className="text-white font-semibold text-sm leading-tight block">
                {item.productName}
              </span>
              {item.modifiers && item.modifiers.length > 0 && (
                <ul className="mt-0.5 space-y-0.5">
                  {item.modifiers.map((mod, mIdx) => (
                    <li key={mIdx} className="text-slate-400 text-xs font-medium pl-2 border-l border-slate-600">
                      {mod}
                    </li>
                  ))}
                </ul>
              )}
              {item.course != null && (
                <span className="text-indigo-400 text-[10px] font-black uppercase tracking-wider mt-0.5 block">
                  Course {item.course}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Status Footer */}
      <div className={`px-4 py-3 flex items-center justify-between ${statusStyle.bg}`}>
        <span className={`text-xs font-black uppercase tracking-widest ${statusStyle.text}`}>
          {statusStyle.label}
        </span>
        {nextStatus && !isAdvancing && (
          <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
            Tap → {nextStatus}
          </span>
        )}
        {isAdvancing && (
          <span className="text-[10px] font-semibold text-white/60 animate-pulse">Updating…</span>
        )}
      </div>
    </button>
  );
}

// ─── Completed Card Overlay ───────────────────────────────────────────────────

function CompletedOverlay({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-emerald-600/95 animate-in fade-in duration-300">
      <span className="text-5xl mb-2">✓</span>
      <p className="text-white font-black text-lg">{orderNumber}</p>
      <p className="text-emerald-200 font-semibold text-sm">COMPLETED</p>
    </div>
  );
}

// ─── KDS Display ─────────────────────────────────────────────────────────────

interface KdsDisplayProps {
  station: Station;
  outletId: string;
  outletName: string;
}

function KdsDisplay({ station, outletId, outletName }: KdsDisplayProps) {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [advancing, setAdvancing] = useState<Record<string, boolean>>({});
  const [completing, setCompleting] = useState<Record<string, boolean>>({});
  const [clock, setClock] = useState<Date>(new Date());
  const [elapsedTick, setElapsedTick] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevBatchIdsRef = useRef<Set<string>>(new Set());

  const stationLabel = station === 'KITCHEN' ? '🔥 KITCHEN' : '🍺 BAR';
  const stationColor = station === 'KITCHEN' ? 'text-orange-400' : 'text-blue-400';

  // Load batches
  const loadBatches = useCallback(async () => {
    try {
      const data = await fetchBatches(outletId, station);
      setBatches((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        // Keep completed ones that are fading out
        const completingIds = Object.keys(completing);
        const completingBatches = prev.filter((b) => completingIds.includes(b.id));
        const fresh = data.filter((b: ProductionBatch) => !completingIds.includes(b.id));
        // Detect new batches for slide-in animation tracking
        fresh.forEach((b: ProductionBatch) => prevBatchIdsRef.current.add(b.id));
        return [...completingBatches, ...fresh];
      });
      setError(null);
    } catch {
      setError('Connection lost — retrying…');
    } finally {
      setIsLoading(false);
    }
  }, [outletId, station, completing]);

  // Poll every 10s
  useEffect(() => {
    loadBatches();
    const pollId = setInterval(loadBatches, 10_000);
    return () => clearInterval(pollId);
  }, [loadBatches]);

  // Live clock (every second)
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Elapsed time refresh (every 30s)
  useEffect(() => {
    const id = setInterval(() => setElapsedTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleTap = async (batch: ProductionBatch) => {
    const currentIdx = STATUS_SEQUENCE.indexOf(batch.status);
    if (currentIdx === -1 || currentIdx >= STATUS_SEQUENCE.length - 1) return;
    const nextStatus = STATUS_SEQUENCE[currentIdx + 1];

    setAdvancing((prev) => ({ ...prev, [batch.id]: true }));

    const ok = await advanceBatchStatus(batch.id, nextStatus);

    if (ok) {
      if (nextStatus === 'COMPLETED') {
        // Show completed overlay, then fade out after 3s
        setBatches((prev) =>
          prev.map((b) => (b.id === batch.id ? { ...b, status: 'COMPLETED' } : b))
        );
        setCompleting((prev) => ({ ...prev, [batch.id]: true }));
        setTimeout(() => {
          setBatches((prev) => prev.filter((b) => b.id !== batch.id));
          setCompleting((prev) => {
            const next = { ...prev };
            delete next[batch.id];
            return next;
          });
        }, 3_000);
      } else {
        setBatches((prev) =>
          prev.map((b) => (b.id === batch.id ? { ...b, status: nextStatus } : b))
        );
      }
    }

    setAdvancing((prev) => ({ ...prev, [batch.id]: false }));
  };

  const pendingCount = batches.filter(
    (b) => b.status !== 'COMPLETED' && !completing[b.id]
  ).length;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header Bar */}
      <header className="shrink-0 bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        {/* Left: Logo + Station */}
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow">
            L
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">
              {outletName || 'Production Display'}
            </p>
            <p className={`text-xl font-black tracking-tight ${stationColor}`}>
              {stationLabel}
            </p>
          </div>
        </div>

        {/* Center: Batch count */}
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-rose-400 text-xs font-semibold animate-pulse bg-rose-950/50 px-3 py-1 rounded-full">
              ⚠ {error}
            </span>
          )}
          <div className="bg-slate-800 rounded-2xl px-5 py-2 text-center">
            <p className="text-3xl font-black text-white leading-none">{pendingCount}</p>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
              {pendingCount === 1 ? 'ticket' : 'tickets'}
            </p>
          </div>
        </div>

        {/* Right: Clock */}
        <div className="text-right">
          <p className="text-2xl font-black text-white tabular-nums tracking-tight">
            {formatClock(clock)}
          </p>
          <p className="text-slate-500 text-xs font-semibold mt-0.5">
            {clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <div className="w-10 h-10 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
              <p className="font-semibold text-sm">Loading tickets…</p>
            </div>
          </div>
        ) : batches.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <span className="text-7xl mb-4">🍽️</span>
            <p className="text-xl font-black text-slate-400">All clear!</p>
            <p className="text-slate-600 font-medium mt-1">No pending tickets right now.</p>
            <p className="text-slate-700 text-xs mt-4">Polling every 10 seconds…</p>
          </div>
        ) : (
          /* Batch Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {batches.map((batch) => (
              <div key={batch.id} className="relative">
                <BatchCard
                  batch={batch}
                  onTap={handleTap}
                  isAdvancing={!!advancing[batch.id]}
                  elapsedTick={elapsedTick}
                />
                {completing[batch.id] && (
                  <CompletedOverlay orderNumber={batch.order.orderNumber} />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer hint */}
      <footer className="shrink-0 border-t border-slate-800 px-6 py-2 flex items-center justify-between">
        <p className="text-slate-700 text-xs font-medium">
          Tap a ticket card to advance its status
        </p>
        <p className="text-slate-700 text-xs font-medium">
          Auto-refresh every 10s
        </p>
      </footer>
    </div>
  );
}

// ─── Inner page (reads searchParams) ─────────────────────────────────────────

function KdsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const stationParam = searchParams.get('station')?.toUpperCase() as Station | null;
  const isValidStation = stationParam === 'KITCHEN' || stationParam === 'BAR';

  const [station, setStation] = useState<Station | null>(
    isValidStation ? stationParam : null
  );
  const [outletId, setOutletId] = useState<string | null>(null);
  const [outletName, setOutletName] = useState<string>('');
  const [loadingOutlet, setLoadingOutlet] = useState(true);

  // Restore station from localStorage if not in URL
  useEffect(() => {
    if (!isValidStation) {
      const saved = localStorage.getItem('lodgecore_kds_station') as Station | null;
      if (saved === 'KITCHEN' || saved === 'BAR') {
        setStation(saved);
      }
    }
  }, [isValidStation]);

  // Resolve outletId from session
  useEffect(() => {
    const resolve = async () => {
      const id = await getOutletId();
      if (id) {
        setOutletId(id);
        // Attempt to get outlet name from session data
        const sessionId = localStorage.getItem('lodgecore_pos_session_id');
        if (sessionId) {
          try {
            const res = await fetch(`/api/v1/pos/sessions/${sessionId}`);
            if (res.ok) {
              const data = await res.json();
              setOutletName(data?.outlet?.name ?? '');
            }
          } catch {}
        }
      }
      setLoadingOutlet(false);
    };
    resolve();
  }, []);

  const handleStationSelect = (s: Station) => {
    setStation(s);
    localStorage.setItem('lodgecore_kds_station', s);
    // Update URL without full navigation
    const url = new URL(window.location.href);
    url.searchParams.set('station', s);
    window.history.replaceState({}, '', url.toString());
  };

  if (loadingOutlet) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-10 h-10 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
          <p className="font-semibold text-sm">Connecting to outlet…</p>
        </div>
      </div>
    );
  }

  if (!station) {
    return <StationSelector onSelect={handleStationSelect} />;
  }

  if (!outletId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <span className="text-5xl mb-4 block">⚠️</span>
          <h2 className="text-xl font-black text-white mb-2">No Session Found</h2>
          <p className="text-slate-400 text-sm mb-6">
            This display needs an active POS session to identify the outlet. Please start a shift first.
          </p>
          <button
            onClick={() => router.push('/pos/start-shift')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            Go to Start Shift
          </button>
        </div>
      </div>
    );
  }

  return <KdsDisplay station={station} outletId={outletId} outletName={outletName} />;
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function KdsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      }
    >
      <KdsPageInner />
    </Suspense>
  );
}
