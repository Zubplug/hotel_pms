import React from 'react';
import {
  LayoutGrid, MapPin, Receipt, TrendingUp, ChefHat,
  Lock, Wifi, WifiOff, Monitor, UtensilsCrossed,
} from 'lucide-react';

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
  syncPending,
}: PosSidebarProps) {

  const NavItem = ({
    icon: Icon,
    label,
    active,
    onClick,
    danger = false,
  }: any) => (
    <button
      onClick={onClick}
      title={label}
      className={`
        relative group flex flex-col items-center justify-center w-14 h-14 rounded-2xl
        transition-all duration-200 ease-out
        ${danger
          ? 'hover:bg-rose-500/20 text-rose-400 hover:text-rose-300'
          : active
          ? 'bg-white/15 text-white shadow-lg shadow-black/20 backdrop-blur-sm'
          : 'text-white/50 hover:bg-white/10 hover:text-white/80'
        }
      `}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-amber-400 rounded-r-full" />
      )}
      <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${active ? 'text-white' : ''}`} />
      <span className="text-[9px] font-bold mt-1 tracking-wide uppercase opacity-70 group-hover:opacity-100">
        {label}
      </span>
    </button>
  );

  return (
    <div className="w-[72px] flex flex-col items-center py-5 shrink-0 z-20"
      style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}
    >
      {/* Logo */}
      <div className="mb-6 flex flex-col items-center">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shadow-black/40"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
        >
          <UtensilsCrossed className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Primary nav */}
      <div className="flex flex-col gap-1.5 flex-1 w-full px-3">
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

        <div className="h-px w-8 mx-auto my-3 bg-white/10 rounded-full" />

        <NavItem icon={Receipt}   label="Orders"  onClick={onOpenMyOrders} />
        <NavItem icon={TrendingUp} label="Sales"  onClick={onOpenMySales} />
        <NavItem icon={ChefHat}   label="Kitchen" onClick={onOpenKitchen} />
        <NavItem icon={Monitor}   label="KDS"     onClick={() => window.open('/pos/kds', '_blank')} />
      </div>

      {/* Bottom */}
      <div className="flex flex-col gap-2 w-full px-3 items-center mt-auto">
        {/* Online pill */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
          isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-500'
        }`}>
          {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
          {isOnline ? 'Live' : 'Off'}
          {syncPending > 0 && (
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full ml-0.5 animate-pulse" />
          )}
        </div>

        <NavItem icon={Lock} label="Lock" onClick={onLock} danger />
      </div>
    </div>
  );
}
