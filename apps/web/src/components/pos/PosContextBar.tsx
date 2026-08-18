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
    <div className="h-13 flex items-center justify-between px-6 shrink-0 bg-white border-b border-slate-200 shadow-sm"
      style={{ minHeight: '52px' }}
    >
      {/* Left: Outlet */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50 border border-indigo-100">
          <Store className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-800 tracking-wide uppercase leading-none">{outletName}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Point of Sale</p>
        </div>
      </div>

      {/* Center: Operator */}
      <div className="flex items-center gap-4">
        {operatorName && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
              <User className="w-3 h-3 text-indigo-600" />
            </div>
            <span className="text-xs font-bold text-slate-700">{operatorName}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 tabular-nums">{timeStr}</span>
          <span className="text-slate-300 mx-0.5">·</span>
          <span className="text-xs text-slate-500">{dateStr}</span>
        </div>
      </div>

      {/* Right: Status */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
          isOnline
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            : 'bg-slate-50 text-slate-500 border border-slate-200'
        }`}>
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
        {syncPending > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 text-xs font-bold border border-amber-100">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            {syncPending} Pending
          </div>
        )}
      </div>
    </div>
  );
}
