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
  const color =
    occ >= 80 ? '#10B981' :
    occ >= 60 ? TONE_HEX.indigo :
    occ >= 40 ? TONE_HEX.amber :
    TONE_HEX.rose;

  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(occ / 100, 1)) * circ;

  const segments = [
    { label: 'Occupied',  value: occupied,     color: TONE_HEX.indigo },
    { label: 'Available', value: available,     color: TONE_HEX.emerald },
    { label: 'OOO',       value: outOfOrder,    color: TONE_HEX.rose },
    ...(complimentary > 0 ? [{ label: 'Comp', value: complimentary, color: TONE_HEX.amber }] : []),
  ].filter((b) => b.value > 0);

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={BedDouble}
        title="Room Status"
        subtitle="Business date · live"
        tone="indigo"
        actions={
          <span className="font-mono text-[14px] font-bold" style={{ color }}>
            {occ}% OCC
          </span>
        }
      />

      <div className="p-4 flex flex-col gap-4">
        {/* Gauge + legend */}
        <div className="flex items-center gap-4">
          {/* SVG gauge */}
          <div className="relative flex items-center justify-center shrink-0" style={{ width: 120, height: 120 }}>
            {/* Ambient glow */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, ${color}15 0%, transparent 65%)` }}
            />
            <svg width={120} height={120} className="-rotate-90">
              <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={12} />
              <circle
                cx={60} cy={60} r={r}
                fill="none"
                stroke={color}
                strokeWidth={12}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 10px ${color}70)`,
                  transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)',
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span
                className="font-mono text-[22px] font-bold leading-none"
                style={{ color: 'white', textShadow: `0 0 20px ${color}60` }}
              >
                {occ}%
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">OCC</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 flex-1">
            {[
              { label: 'Occupied',  value: occupied,  color: TONE_HEX.indigo },
              { label: 'Available', value: available, color: TONE_HEX.emerald },
              { label: 'OOO',       value: outOfOrder, color: TONE_HEX.rose },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: s.color, boxShadow: `0 0 4px ${s.color}80` }}
                />
                <span className="text-[11px] text-slate-500 w-16">{s.label}</span>
                <span
                  className="font-mono text-[13px] font-bold tabular-nums"
                  style={{ color: 'white' }}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stacked proportion bar */}
        {total > 0 && segments.length > 0 && (
          <div className="space-y-1.5">
            {/* Visual proportion bar */}
            <div className="h-2 overflow-hidden rounded-full flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {segments.map((seg, i) => (
                <div
                  key={seg.label}
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${(seg.value / total) * 100}%`,
                    background: seg.color,
                    borderRadius: i === 0 ? '999px 0 0 999px' : i === segments.length - 1 ? '0 999px 999px 0' : '0',
                  }}
                />
              ))}
            </div>
            {/* Bar labels */}
            {segments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-2">
                <span className="w-14 text-[10.5px] text-slate-500">{seg.label}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(seg.value / total) * 100}%`,
                      background: seg.color,
                    }}
                  />
                </div>
                <span className="font-mono text-[10.5px] font-semibold tabular-nums text-slate-400 w-5 text-right">
                  {seg.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          className="border-t pt-2.5 flex items-center justify-between"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <span className="text-[10.5px] text-slate-600">Total rooms</span>
          <span className="font-mono text-[14px] font-bold text-white tabular-nums">{total}</span>
        </div>
      </div>
    </Panel>
  );
}
