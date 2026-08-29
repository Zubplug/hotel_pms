'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import {
  LayoutGrid, MapPin, Receipt, TrendingUp, ChefHat, Wallet,
  Monitor, Lock, UserCircle, RefreshCw, Wifi, WifiOff, Printer,
  AlertTriangle, ChevronLeft, ChevronRight, ArrowRightLeft,
} from 'lucide-react';

interface PosSidebarProps {
  viewMode: 'menu' | 'tables';
  setViewMode: (mode: 'menu' | 'tables') => void;
  onOpenMyOrders: () => void;
  onOpenMySales: () => void;
  onOpenShiftBank: () => void;
  onOpenHandovers?: () => void;
  onOpenKitchen: () => void;
  onOpenPrinterSettings: () => void;
  onOpenSyncCenter: () => void;
  onLock: () => void;
  onEmergencyOverride?: () => void;
  isOnline: boolean;
  syncPending: number;
  activeOperator: any | null;
  isDesktop?: boolean;
}

export function PosSidebar({
  viewMode,
  setViewMode,
  onOpenMyOrders,
  onOpenMySales,
  onOpenShiftBank,
  onOpenHandovers,
  onOpenKitchen,
  onOpenPrinterSettings,
  onOpenSyncCenter,
  onLock,
  onEmergencyOverride,
  isOnline,
  syncPending,
  activeOperator,
  isDesktop = false,
}: PosSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const operatorName = activeOperator
    ? `${activeOperator.firstName || ''} ${activeOperator.lastName || ''}`.trim() || activeOperator.name || 'Operator'
    : 'Not signed in';
  const roleName = activeOperator?.position || activeOperator?.role || activeOperator?.posRole || 'Staff';

  const initials = operatorName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  // ── Nav Item ───────────────────────────────────────────────────────
  const NavItem = ({
    icon: Icon,
    label,
    active,
    onClick,
    badge,
    danger,
  }: {
    icon: any;
    label: string;
    active?: boolean;
    onClick: () => void;
    badge?: number;
    danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`
        relative group flex items-center gap-3 w-full rounded-xl
        transition-all duration-150 font-semibold text-sm touch-manipulation
        ${collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
        ${active
          ? 'bg-indigo-600 text-white shadow-md'
          : danger
            ? 'text-rose-400 hover:bg-rose-50 hover:text-rose-600'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }
      `}
    >
      <Icon className={`shrink-0 transition-colors ${collapsed ? 'w-5 h-5' : 'w-4.5 h-4.5 w-[18px] h-[18px]'} ${active ? 'text-white' : danger ? 'text-rose-400 group-hover:text-rose-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
      {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span className="min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center px-1 shrink-0">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {/* Tooltip for collapsed mode */}
      {collapsed && (
        <span className="
          absolute left-full ml-2 px-2 py-1 rounded-lg bg-slate-800 text-white text-xs font-semibold
          whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100
          transition-opacity duration-150 z-50 shadow-lg
        ">
          {label}
        </span>
      )}
    </button>
  );

  const statusColor = !isOnline ? 'text-rose-500' : syncPending > 0 ? 'text-amber-500' : 'text-emerald-500';
  const StatusIcon = !isOnline ? WifiOff : syncPending > 0 ? RefreshCw : Wifi;

  return (
    <div
      className={`
        flex flex-col relative z-20 bg-white border-r border-slate-200 h-full
        transition-all duration-200 ease-in-out shrink-0
        ${collapsed ? 'w-[60px]' : 'w-[188px]'}
      `}
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className={`flex items-center gap-2.5 px-3 pt-4 pb-3 border-b border-slate-100 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm bg-indigo-50 flex items-center justify-center">
          <Image
            src="/lodgecore-logo.png"
            alt="LC"
            width={32}
            height={32}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none min-w-0">
            <span className="font-black text-slate-800 text-[13px] tracking-tight">LodgeCore</span>
            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">POS</span>
          </div>
        )}
      </div>

      {/* ── Primary Nav ──────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 px-2 pt-3">
        {!collapsed && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-1">Station</p>}
        <NavItem icon={LayoutGrid} label="Order Entry" active={viewMode === 'menu'}    onClick={() => setViewMode('menu')} />
        <NavItem icon={MapPin}     label="Table Map"   active={viewMode === 'tables'}  onClick={() => setViewMode('tables')} />
      </div>

      <div className="mx-3 my-2.5 h-px bg-slate-100" />

      {/* ── Manage Nav ───────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 px-2">
        {!collapsed && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-1">Manage</p>}
        <NavItem icon={Receipt}    label="All Orders"   onClick={onOpenMyOrders} />
        <NavItem icon={TrendingUp} label="My Sales"     onClick={onOpenMySales} />
        <NavItem icon={Wallet}     label="Shift Bank"   onClick={onOpenShiftBank} />
        {onOpenHandovers && (
          <NavItem icon={ArrowRightLeft} label="Handovers" onClick={onOpenHandovers} />
        )}
        <NavItem icon={ChefHat}    label="Kitchen"      onClick={onOpenKitchen} />
        {isDesktop && (
          <NavItem icon={Printer}    label="Printers"     onClick={onOpenPrinterSettings} />
        )}
        {isDesktop && (
          <NavItem icon={RefreshCw}  label="Sync Center"  onClick={onOpenSyncCenter} />
        )}
      </div>

      {/* ── Spacer ───────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Status & Collapse ────────────────────────────── */}
      <div className="px-2 pb-1">
        {/* Connection pill */}
        <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold mb-1 ${!isOnline ? 'bg-rose-50' : syncPending > 0 ? 'bg-amber-50' : 'bg-emerald-50'} ${statusColor} ${collapsed ? 'justify-center' : ''}`}>
          <StatusIcon className={`w-3 h-3 shrink-0 ${syncPending > 0 ? 'animate-spin' : ''}`} />
          {!collapsed && <span>{!isOnline ? 'Offline' : syncPending > 0 ? `Syncing ${syncPending}` : 'Live'}</span>}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors text-[10px] font-semibold touch-manipulation"
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <><ChevronLeft className="w-3.5 h-3.5" /><span>Collapse</span></>
          }
        </button>
      </div>

      {/* ── Operator Card ────────────────────────────────── */}
      <div className="border-t border-slate-100 p-2">
        {collapsed ? (
          /* Compact avatar + lock */
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
              {activeOperator ? initials : <UserCircle className="w-4 h-4" />}
            </div>
            <button
              onClick={onLock}
              title="Switch Operator"
              className="w-full flex items-center justify-center py-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors touch-manipulation"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[10px] font-black">
                {activeOperator ? initials : <UserCircle className="w-4 h-4" />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-bold text-slate-800 truncate leading-tight">{operatorName}</span>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate">{roleName}</span>
              </div>
            </div>
            <button
              onClick={onLock}
              className="w-full py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-1.5 touch-manipulation"
            >
              <Lock className="w-3 h-3" /> Switch
            </button>
            {onEmergencyOverride && (
              <button
                onClick={onEmergencyOverride}
                className="w-full py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5 touch-manipulation"
              >
                <AlertTriangle className="w-3 h-3" /> Override
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
