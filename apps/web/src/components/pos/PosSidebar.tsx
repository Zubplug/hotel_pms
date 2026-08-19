import React from 'react';
import {
  LayoutGrid, MapPin, Receipt, TrendingUp, ChefHat,
  Monitor, LogOut, UtensilsCrossed, UserCircle
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

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
  const { data: session } = useLodgeCoreSession();
  
  // Use session.operator for the active operator, fallback to user
  const operatorName = (session as any)?.operator?.name || (session?.user?.name) || 'Not signed in';
  const roleName = (session as any)?.operator?.role || 'Operator';

  const NavItem = ({
    icon: Icon,
    label,
    active,
    onClick,
  }: any) => (
    <button
      onClick={onClick}
      className={`
        relative group flex items-center gap-3 w-full px-4 py-4 rounded-xl
        transition-all duration-200 ease-out font-medium text-sm
        ${active
          ? 'bg-indigo-600 text-white shadow-md'
          : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-800'
        }
      `}
    >
      <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="w-[200px] flex flex-col py-6 px-4 shrink-0 z-20 bg-white border-r border-slate-200 shadow-sm h-full">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          <UtensilsCrossed className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-slate-800 leading-tight tracking-tight">LodgeCore</span>
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">POS Terminal</span>
        </div>
      </div>

      {/* Primary nav */}
      <div className="flex flex-col gap-2 flex-1 w-full">
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
        
        <div className="h-px w-full my-4 bg-slate-100" />

        <NavItem icon={Receipt}   label="All Orders"  onClick={onOpenMyOrders} active={false} />
        <NavItem icon={TrendingUp} label="My Sales"  onClick={onOpenMySales} active={false} />
        <NavItem icon={ChefHat}   label="Kitchen" onClick={onOpenKitchen} active={false} />
        <NavItem icon={Monitor}   label="KDS Display" onClick={() => window.open('/pos/kds', '_blank')} active={false} />
      </div>

      {/* Connection status pill */}
      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold mx-2 mt-4 ${
        !isOnline ? 'bg-rose-50 text-rose-600' :
        syncPending > 0 ? 'bg-amber-50 text-amber-600' :
        'bg-emerald-50 text-emerald-600'
      }`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${
          !isOnline ? 'bg-rose-500 animate-pulse' :
          syncPending > 0 ? 'bg-amber-500 animate-pulse' :
          'bg-emerald-500'
        }`} />
        {!isOnline ? 'Offline' : syncPending > 0 ? `Syncing (${syncPending})` : 'Live'}
      </div>

      {/* Operator Info & Switch */}
      <div className="mt-auto pt-6 border-t border-slate-100">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <UserCircle className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-800 truncate">{operatorName}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{roleName}</span>
            </div>
          </div>
          
          <button 
            onClick={onLock}
            className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
