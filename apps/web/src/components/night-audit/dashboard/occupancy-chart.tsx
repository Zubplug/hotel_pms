import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { RoomAnalytics } from '@/types/night-audit';
import { BedDouble } from 'lucide-react';

/* ── Large SVG ring gauge ─────────────────────────────────────────────────── */
function OccupancyRing({
  pct,
  occupied,
  total,
}: {
  pct: number;
  occupied: number;
  total: number;
}) {
  const size = 160;
  const sw = 14;
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * Math.min(pct / 100, 1);

  const color =
    pct >= 80 ? '#10b981' :
    pct >= 60 ? '#6366f1' :
    pct >= 40 ? '#f59e0b' :
    '#f43f5e';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} />
        {/* Background arc ticks */}
        {[25, 50, 75].map((p) => {
          const angle = (p / 100) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const x = cx + (r) * Math.cos(rad);
          const y = cy + (r) * Math.sin(rad);
          return (
            <circle key={p} cx={x} cy={y} r={2} fill="rgba(255,255,255,0.12)" />
          );
        })}
        {/* Progress */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 8px ${color}70)`,
            transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[2.2rem] font-bold leading-none tracking-tight text-white">{pct}%</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Occupancy</span>
        <span className="mt-1 text-[11px] font-medium text-slate-400">{occupied} / {total}</span>
      </div>
    </div>
  );
}

const BarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div
        className="rounded-xl border border-white/[0.1] px-3 py-2 shadow-xl"
        style={{ background: 'rgba(8,12,24,0.97)', backdropFilter: 'blur(16px)' }}
      >
        <p className="text-xs font-bold text-white">{d.name}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{d.value} rooms</p>
      </div>
    );
  }
  return null;
};

export function OccupancyChart({ rooms }: { rooms: RoomAnalytics | undefined }) {
  if (!rooms) return null;

  const total = rooms.total || 0;
  const occupied = rooms.occupied || 0;
  const available = rooms.available || 0;
  const outOfOrder = rooms.outOfOrder || 0;
  const complimentary = (rooms as any).complimentary || 0;
  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const barData = [
    { name: 'Occupied', value: occupied, color: '#6366f1' },
    { name: 'Available', value: available, color: '#10b981' },
    { name: 'Out of Order', value: outOfOrder, color: '#f43f5e' },
    ...(complimentary > 0 ? [{ name: 'Complimentary', value: complimentary, color: '#f59e0b' }] : []),
  ].filter((d) => d.value > 0);

  const color =
    occupancyRate >= 80 ? '#10b981' :
    occupancyRate >= 60 ? '#6366f1' :
    occupancyRate >= 40 ? '#f59e0b' :
    '#f43f5e';

  return (
    <div
      className="flex h-full flex-col rounded-[24px] border border-white/[0.06] p-6 sm:p-7"
      style={{ background: 'rgba(255,255,255,0.025)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
          <BedDouble className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-white">Occupancy Distribution</h3>
          <p className="text-[11px] text-slate-500">Room status · business date</p>
        </div>
      </div>

      {total > 0 ? (
        <>
          {/* Ring gauge */}
          <div className="mt-5 flex justify-center">
            <OccupancyRing pct={occupancyRate} occupied={occupied} total={total} />
          </div>

          {/* Bar breakdown */}
          {barData.length > 0 && (
            <div className="mt-5 h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide domain={[0, total]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={82}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={16}>
                    {barData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color}
                        style={{ filter: `drop-shadow(0 0 4px ${entry.color}50)` }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stat row */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-4">
            {[
              { label: 'Occupied', value: occupied, color },
              { label: 'Available', value: available, color: '#10b981' },
              { label: 'OOO', value: outOfOrder, color: '#f43f5e' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-mono text-lg font-bold tabular-nums text-white">{s.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: s.color }}>{s.label}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6 flex flex-1 min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-white/[0.07]">
          <p className="text-sm text-slate-500">No room data available</p>
        </div>
      )}
    </div>
  );
}
