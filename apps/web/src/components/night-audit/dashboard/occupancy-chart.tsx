import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { RoomAnalytics } from '@/types/night-audit';
import { BedDouble } from 'lucide-react';

const DarkTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="rounded-xl border border-white/10 px-4 py-3 shadow-2xl backdrop-blur-xl" style={{ background: 'rgba(10,14,26,0.95)' }}>
        <p className="text-xs font-bold text-white">{d.name}</p>
        <p className="mt-0.5 text-xs text-slate-400">{d.value} rooms</p>
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
  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const data = [
    { name: 'Occupied', value: occupied, color: '#6366f1' },
    { name: 'Available', value: available, color: '#10b981' },
    { name: 'Out of Order', value: outOfOrder, color: '#f43f5e' },
  ].filter((item) => item.value > 0);

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-6 backdrop-blur-md sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
          <BedDouble className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-white">Occupancy Distribution</h3>
          <p className="text-[11px] text-slate-500">Room status — business date</p>
        </div>
      </div>

      <div className="relative mt-4 flex min-h-[220px] flex-1 flex-col justify-center">
        {total > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="48%"
                  innerRadius={64}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} opacity={0.9} />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label */}
            <div className="pointer-events-none absolute inset-0 mb-10 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold tracking-tight text-white">{occupancyRate}%</span>
              <span className="mt-1 text-[11px] font-medium text-slate-500">Occupancy</span>
              <span className="mt-0.5 text-[10px] text-slate-600">{occupied}/{total} rooms</span>
            </div>
          </>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/10">
            <p className="text-sm text-slate-500">No room data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
