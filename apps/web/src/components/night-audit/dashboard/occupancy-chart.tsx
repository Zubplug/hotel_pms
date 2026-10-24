'use client';
import React from 'react';
import { BedDouble } from 'lucide-react';
import { RoomAnalytics } from '@/types/night-audit';
import { Panel, PanelHeader, TONE_HEX } from './ui';

export function OccupancyChart({ rooms }: { rooms: RoomAnalytics | undefined }) {
  if (!rooms) return null;

  const { total = 0, occupied = 0, available = 0, outOfOrder = 0 } = rooms;
  const complimentary = (rooms as any).complimentary || 0;
  const occ = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const color = occ >= 80 ? TONE_HEX.emerald : occ >= 60 ? TONE_HEX.indigo : occ >= 40 ? TONE_HEX.amber : TONE_HEX.rose;

  const bars = [
    { label: 'Occupied', value: occupied, color: TONE_HEX.indigo },
    { label: 'Available', value: available, color: TONE_HEX.emerald },
    { label: 'OOO', value: outOfOrder, color: TONE_HEX.rose },
    ...(complimentary > 0 ? [{ label: 'Comp', value: complimentary, color: TONE_HEX.amber }] : []),
  ].filter((b) => b.value > 0);

  return (
    <Panel className="h-full">
      <PanelHeader icon={BedDouble} title="Room Status" subtitle="Business date · live" tone="indigo" />

      <div className="p-4 flex flex-col gap-4">
        {/* Gauge */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
            <svg width={80} height={80} className="-rotate-90">
              <circle cx={40} cy={40} r={32} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={9} />
              <circle
                cx={40} cy={40} r={32} fill="none" stroke={color} strokeWidth={9}
                strokeDasharray={`${2 * Math.PI * 32 * Math.min(occ / 100, 1)} ${2 * Math.PI * 32}`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${color}60)`, transition: 'stroke-dasharray 0.8s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-[18px] font-bold leading-none text-white">{occ}%</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">OCC</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {[
              { label: 'Occupied', value: occupied, color: TONE_HEX.indigo },
              { label: 'Available', value: available, color: TONE_HEX.emerald },
              { label: 'OOO', value: outOfOrder, color: TONE_HEX.rose },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[11px] text-slate-500 w-16">{s.label}</span>
                <span className="font-mono text-[12px] font-bold tabular-nums text-white">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mini stacked bars */}
        {total > 0 && (
          <div className="space-y-1.5">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="w-14 text-[10.5px] text-slate-500">{b.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(b.value / total) * 100}%`, background: b.color }}
                  />
                </div>
                <span className="font-mono text-[10.5px] font-semibold tabular-nums text-slate-400 w-5 text-right">{b.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-white/[0.05] pt-2 flex items-center justify-between">
          <span className="text-[10.5px] text-slate-600">Total rooms</span>
          <span className="font-mono text-[13px] font-bold text-white tabular-nums">{total}</span>
        </div>
      </div>
    </Panel>
  );
}
