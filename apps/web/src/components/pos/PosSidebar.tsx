import React from 'react';
import { LayoutGrid, MapPin, Search, Receipt, TrendingUp, ChefHat, Lock, Wifi, WifiOff, Monitor } from 'lucide-react';

interface PosSidebarProps {
  viewMode: 'menu' | 'tables';
  setViewMode: (mode: 'menu' | 'tables') => void;
  onOpenMyOrders: () => void;
  onOpenMySales: () => void;
  onOpenKitchen: () => void;
  onLock: () => void;
  isOnline: boolean;
  syncPending: number;
}

export function PosSidebar({
  viewMode,
  setViewMode,
  onOpenMyOrders,
  onOpenMySales,
  onOpenKitchen,
  onLock,
  isOnline,
  syncPending
}: PosSidebarProps) {
  const NavItem = ({ icon: Icon, label, active, onClick, textClass = 'text-slate-500' }: any) => (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all ${
        active
          ? 'bg-indigo-50 text-indigo-700 shadow-sm'
          : `hover:bg-slate-100 ${textClass}`
      }`}
    >
      <Icon className={`w-6 h-6 ${active ? 'text-indigo-600' : ''}`} />
      <span className="text-[10px] font-semibold mt-1 opacity-0 group-hover:opacity-100 absolute -bottom-4 whitespace-nowrap bg-slate-800 text-white px-2 py-0.5 rounded shadow-lg z-50 transition-opacity">
        {label}
      </span>
    </button>
  );

  return (
    <div className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-4 shrink-0 shadow-sm z-10">
      <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-6 shadow-sm">
        L
      </div>

      <div className="flex flex-col gap-2 flex-1 w-full px-2">
        <NavItem
          icon={LayoutGrid}
          label="Menu"
          active={viewMode === 'menu'}
          onClick={() => setViewMode('menu')}
        />
        <NavItem
          icon={MapPin}
          label="Tables"
          active={viewMode === 'tables'}
          onClick={() => setViewMode('tables')}
        />
        <div className="h-px bg-slate-100 w-10 mx-auto my-2" />
        <NavItem
          icon={Receipt}
          label="My Orders"
          onClick={onOpenMyOrders}
        />
        <NavItem
          icon={TrendingUp}
          label="My Sales"
          onClick={onOpenMySales}
        />
        <NavItem
          icon={ChefHat}
          label="Kitchen"
          onClick={onOpenKitchen}
        />
        <NavItem
          icon={Monitor}
          label="KDS Display"
          onClick={() => window.open('/pos/kds', '_blank')}
        />
      </div>

      <div className="flex flex-col gap-2 mt-auto w-full px-2 items-center pb-2">
        <button
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors"
          title={isOnline ? 'Online' : 'Offline'}
        >
          {isOnline ? (
            <Wifi className="w-5 h-5 text-emerald-500" />
          ) : (
            <WifiOff className="w-5 h-5 text-slate-400" />
          )}
          {syncPending > 0 && (
            <span className="absolute top-1 right-2 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />
          )}
        </button>
        <button
          onClick={onLock}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
          title="Lock / Switch User"
        >
          <Lock className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
