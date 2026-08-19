'use client';

import { useState, useEffect } from 'react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Loader2, Users, Clock, LayoutGrid } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface TableMapProps {
  outletId: string;
  onTableSelect: (table: any) => void;
  activeTableId?: string | null;
  refreshTrigger?: number;
  operatorToken?: string | null;
}

function TableCard({ table, isSelected, onSelect }: { table: any; isSelected: boolean; onSelect: () => void }) {
  const isOccupied = !!table.currentOrderId;
  const orderStatus = table.currentOrder?.status;

  // Determine visual state
  let cardClass = '';
  let statusLabel = '';
  let statusClass = '';
  let dotClass = '';

  if (isSelected) {
    cardClass = 'bg-indigo-600 border-indigo-500 text-white shadow-xl ring-4 ring-indigo-300/50';
    statusLabel = 'Active';
    statusClass = 'bg-white/20 text-white';
    dotClass = 'bg-white';
  } else if (isOccupied) {
    cardClass = 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100';
    statusLabel = orderStatus === 'SUBMITTED' ? 'Ordered' : orderStatus === 'IN_SERVICE' ? 'In Service' : 'Occupied';
    statusClass = 'bg-rose-100 text-rose-700 border border-rose-200';
    dotClass = 'bg-rose-500 animate-pulse';
  } else {
    cardClass = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30';
    statusLabel = 'Available';
    statusClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    dotClass = 'bg-emerald-500';
  }

  return (
    <button
      onClick={onSelect}
      style={{
        left: Math.min(table.positionX, 700),
        top: Math.min(table.positionY, 500),
        position: 'absolute',
      }}
      className={`w-28 flex flex-col items-center p-3 rounded-2xl border-2 transition-all duration-200 shadow-sm hover:scale-105 active:scale-95 ${cardClass}`}
    >
      {/* Table name */}
      <span className="font-black text-xl leading-tight">{table.name}</span>

      {/* Capacity */}
      <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
        <Users className="w-3 h-3" />
        <span>{table.capacity} seats</span>
      </div>

      {/* Status badge */}
      <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
        {statusLabel}
      </div>

      {/* Order total if occupied */}
      {isOccupied && table.currentOrder?.total && (
        <span className="mt-1 text-xs font-black text-rose-700">
          {formatCurrency(table.currentOrder.total)}
        </span>
      )}
    </button>
  );
}

export function TableMap({ outletId, onTableSelect, activeTableId, refreshTrigger, operatorToken }: TableMapProps) {
  const { provider } = useLodgeCoreProvider();
  const [floorPlans, setFloorPlans] = useState<any[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!outletId) return;
    const fetchFloorPlans = async () => {
      setIsLoading(true);
      try {
        const res = await provider.pos.getFloorPlans(outletId, operatorToken);
        if (res.data && res.data.length > 0) {
          setFloorPlans(res.data);
          setActivePlanId(res.data[0].id);
        }
      } catch (e) {
        console.error('Failed to fetch floor plans', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFloorPlans();
  }, [outletId, provider]);

  useEffect(() => {
    if (!activePlanId) return;
    const fetchTables = async () => {
      try {
        const res = await provider.pos.getTables(activePlanId, operatorToken);
        console.log('[TableMap DEBUG] getTables response:', res);
        if (res.debug) {
          console.warn('[TableMap API DEBUG INFO]', res.debug);
        }
        if (res.data) setTables(res.data);
      } catch (e) {
        console.error('Failed to fetch tables', e);
      }
    };
    fetchTables();
  }, [activePlanId, provider, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-400 font-medium">Loading floor plan...</p>
        </div>
      </div>
    );
  }

  if (floorPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <LayoutGrid className="w-8 h-8 text-slate-300" />
        </div>
        <div className="text-center">
          <p className="font-bold text-slate-500">No floor plans configured</p>
          <p className="text-sm mt-1">Set up tables from the Admin console → POS → Floor Plans</p>
        </div>
      </div>
    );
  }

  const available = tables.filter(t => !t.currentOrderId).length;
  const occupied = tables.filter(t => !!t.currentOrderId).length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header: floor plan tabs + legend */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0 gap-4">
        {/* Floor plan tabs */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {floorPlans.map((fp) => (
            <button
              key={fp.id}
              onClick={() => setActivePlanId(fp.id)}
              className={`px-4 py-1.5 rounded-full font-semibold text-sm transition-all whitespace-nowrap ${
                activePlanId === fp.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {fp.name}
            </button>
          ))}
        </div>

        {/* Stats + legend */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {available} Available
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {occupied} Occupied
          </div>
          {activeTableId && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              1 Active
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-auto p-6">
        {/* Grid background for visual reference */}
        <div
          className="relative w-full min-h-[600px]"
          style={{
            backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        >
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              isSelected={table.id === activeTableId}
              onSelect={() => onTableSelect(table)}
            />
          ))}

          {tables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
              <LayoutGrid className="w-12 h-12 text-slate-200" />
              <p className="font-semibold">No tables on this floor plan yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
