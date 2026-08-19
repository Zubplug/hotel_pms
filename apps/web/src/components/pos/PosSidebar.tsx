import React from 'react';
import Image from 'next/image';
import {
  LayoutGrid, MapPin, Receipt, TrendingUp, ChefHat,
  Monitor, Lock, UserCircle, RefreshCw, Wifi, WifiOff
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
  activeOperator: any | null;
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
  activeOperator,
}: PosSidebarProps) {
  const operatorName = activeOperator
    ? `${activeOperator.firstName || ''} ${activeOperator.lastName || ''}`.trim() || activeOperator.name || 'Operator'
    : 'Not signed in';
  const roleName = activeOperator?.position || activeOperator?.role || activeOperator?.posRole || 'Staff';

  // Build initials for avatar
  const initials = operatorName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const NavItem = ({
    icon: Icon,
    label,
    active,
    onClick,
    badge,
  }: any) => (
    <button
      onClick={onClick}
      className={`
        relative group flex items-center gap-3 w-full px-4 py-3 rounded-xl
        transition-all duration-150 font-medium text-sm
        ${active
          ? 'bg-indigo-600 text-white shadow-md'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }
      `}
    >
      <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && (
        <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="w-[200px] flex flex-col py-5 px-3 shrink-0 z-20 bg-white border-r border-slate-200 h-full">
      
      {/* Brand */}
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-sm">
          <Image
            src="/lodgecore-logo.png"
            alt="LodgeCore"
            width={36}
            height={36}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-black text-slate-800 text-sm tracking-tight">LodgeCore</span>
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">POS Terminal</span>
        </div>
      </div>

      {/* Primary navigation */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-1">Station</p>
        <NavItem
          icon={LayoutGrid}
          label="Order Entry"
          active={viewMode === 'menu'}
          onClick={() => setViewMode('menu')}
        />
        <NavItem
          icon={MapPin}
          label="Table Map"
          active={viewMode === 'tables'}
          onClick={() => setViewMode('tables')}
        />
      </div>

      <div className="h-px w-full my-4 bg-slate-100" />

      {/* Secondary navigation */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-1">Manage</p>
        <NavItem icon={Receipt}   label="All Orders"  onClick={onOpenMyOrders} active={false} />
        <NavItem icon={TrendingUp} label="My Sales"   onClick={onOpenMySales}  active={false} />
        <NavItem icon={ChefHat}   label="Kitchen"     onClick={onOpenKitchen}  active={false} />
        <NavItem icon={Monitor}   label="KDS Display" onClick={() => window.open('/pos/kds', '_blank')} active={false} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Connection status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold mx-1 mb-3 ${
        !isOnline        ? 'bg-rose-50 text-rose-600' :
        syncPending > 0  ? 'bg-amber-50 text-amber-600' :
                           'bg-emerald-50 text-emerald-600'
      }`}>
        {!isOnline ? (
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
        ) : syncPending > 0 ? (
          <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
        ) : (
          <Wifi className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>
          {!isOnline ? 'Offline' : syncPending > 0 ? `Syncing (${syncPending})` : 'Live'}
        </span>
      </div>

      {/* Active Operator card */}
      <div className="border-t border-slate-100 pt-4 px-1">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-3">
          
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-xs font-black">
              {activeOperator ? initials : <UserCircle className="w-5 h-5" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-800 truncate leading-tight">{operatorName}</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{roleName}</span>
            </div>
          </div>

          {/* Switch Operator button */}
          <button
            onClick={onLock}
            className="w-full py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Lock className="w-3.5 h-3.5" />
            Switch Operator
          </button>
        </div>
      </div>
    </div>
  );
}
