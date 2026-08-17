import React from 'react';
import { Store, User, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react';

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
  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] z-10">
      
      {/* Left: Outlet & Device Context */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Store className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800 tracking-tight uppercase">
              {outletName}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Operator Context */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          <span className="text-xs font-medium text-slate-500">
            Drawer: <strong className="text-slate-700">{drawerName}</strong>
          </span>
        </div>
        
        {operatorName && (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span className="text-xs font-medium text-slate-500">
              Operator: <strong className="text-indigo-700">{operatorName}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Right: Network Context */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
          isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
        
        {syncPending > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-bold">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {syncPending} Pending Sync
          </div>
        )}
      </div>
    </div>
  );
}
