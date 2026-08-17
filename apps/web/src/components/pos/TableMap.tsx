'use client';

import { useState, useEffect } from 'react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Loader2, Users } from 'lucide-react';

interface TableMapProps {
  outletId: string;
  onTableSelect: (table: any) => void;
  activeTableId?: string | null;
  refreshTrigger?: number;
}

export function TableMap({ outletId, onTableSelect, activeTableId, refreshTrigger }: TableMapProps) {
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
        const res = await provider.pos.getFloorPlans(outletId);
        if (res.data && res.data.length > 0) {
          setFloorPlans(res.data);
          setActivePlanId(res.data[0].id);
        }
      } catch (e) {
        console.error("Failed to fetch floor plans", e);
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
        const res = await provider.pos.getTables(activePlanId);
        if (res.data) {
          setTables(res.data);
        }
      } catch (e) {
        console.error("Failed to fetch tables", e);
      }
    };
    fetchTables();
  }, [activePlanId, provider, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (floorPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="font-medium">No floor plans configured for this outlet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Floor Plan Tabs */}
      <div className="px-6 py-4 flex gap-3 overflow-x-auto border-b border-slate-200">
        {floorPlans.map((fp) => (
          <button
            key={fp.id}
            onClick={() => setActivePlanId(fp.id)}
            className={`px-5 py-2.5 rounded-full font-medium text-sm transition-colors whitespace-nowrap ${
              activePlanId === fp.id
                ? 'bg-slate-800 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {fp.name}
          </button>
        ))}
      </div>

      {/* Table Map Area */}
      <div className="flex-1 relative p-6 bg-slate-100 overflow-auto">
        <div className="relative w-full h-full min-h-[500px]">
          {tables.map((table) => {
            const isOccupied = !!table.currentOrderId;
            const orderStatus = table.currentOrder?.status || 'UNKNOWN';
            const isSelected = table.id === activeTableId;

            let bgColor = 'bg-white text-slate-700 border-slate-200';
            let statusBadge = null;

            if (isSelected) {
              bgColor = 'ring-4 ring-purple-500 bg-purple-50 text-purple-900 border-purple-200';
            } else if (isOccupied) {
              if (orderStatus === 'HELD') {
                bgColor = 'bg-slate-100 text-slate-900 border-slate-300';
                statusBadge = (
                  <span className="mt-1 text-[10px] uppercase font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-sm">
                    Held
                  </span>
                );
              } else if (orderStatus === 'COMPLETED') {
                bgColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                statusBadge = (
                  <span className="mt-1 text-[10px] uppercase font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-sm">
                    Completed
                  </span>
                );
              } else if (orderStatus === 'SERVED' || orderStatus === 'READY') {
                bgColor = 'bg-blue-100 text-blue-900 border-blue-300';
                statusBadge = (
                  <span className="mt-1 text-[10px] uppercase font-bold bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-sm">
                    {orderStatus}
                  </span>
                );
              } else if (orderStatus === 'PREPARING') {
                bgColor = 'bg-orange-100 text-orange-900 border-orange-300';
                statusBadge = (
                  <span className="mt-1 text-[10px] uppercase font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-sm">
                    Preparing
                  </span>
                );
              } else {
                // OPEN, SUBMITTED
                bgColor = 'bg-rose-100 text-rose-900 border-rose-300';
                statusBadge = (
                  <span className="mt-1 text-[10px] uppercase font-bold bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded-sm">
                    Occupied
                  </span>
                );
              }
            } else {
              // Available
              bgColor = 'bg-emerald-50 text-emerald-900 border-emerald-200';
            }

            return (
              <button
                key={table.id}
                onClick={() => onTableSelect(table)}
                style={{ left: table.positionX + '%', top: table.positionY + '%' }}
                className={`absolute w-24 h-24 rounded-2xl flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105 active:scale-95 border-2 ${bgColor}`}
              >
                <span className="font-bold text-lg">{table.name}</span>
                <div className="flex items-center gap-1 text-xs opacity-70 mt-1">
                  <Users className="w-3 h-3" />
                  <span>{table.capacity}</span>
                </div>
                {statusBadge}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
