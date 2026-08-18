import React from 'react';
import { Store, User, Wifi, WifiOff, Clock } from 'lucide-react';

interface PosContextBarProps {
  outletName?: string;
  drawerName?: string;
  operatorName?: string;
  isOnline: boolean;
  syncPending: number;
}

export function PosContextBar({
  outletName = 'Main Restaurant',
  drawerName = 'N/A',
  operatorName,
  isOnline,
  syncPending,
}: PosContextBarProps) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="h-13 flex items-center justify-between px-6 shrink-0 border-b border-white/10"
      style={{ background: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)', minHeight: '52px' }}
    >
      {/* Left: Outlet */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
        >
          <Store className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-black text-white tracking-wide uppercase leading-none">{outletName}</p>
          <p className="text-[10px] text-white/40 font-medium mt-0.5">Point of Sale</p>
        </div>
      </div>

      {/* Center: Operator */}
      <div className="flex items-center gap-4">
        {operatorName && (
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5">
            <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
              <User className="w-3 h-3 text-amber-900" />
            </div>
            <span className="text-xs font-bold text-white/90">{operatorName}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
          <Clock className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs font-bold text-white/60 tabular-nums">{timeStr}</span>
          <span className="text-white/20 mx-0.5">·</span>
          <span className="text-xs text-white/40">{dateStr}</span>
        </div>
      </div>

      {/* Right: Status */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
          isOnline
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
        }`}>
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
        {syncPending > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            {syncPending} Pending
          </div>
        )}
      </div>
    </div>
  );
}
