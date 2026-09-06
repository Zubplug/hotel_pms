import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { RoomAnalytics } from '@/types/night-audit';

export function OccupancyChart({ rooms }: { rooms: RoomAnalytics | undefined }) {
  if (!rooms) return null;

  const total = rooms.total || 0;
  const occupied = rooms.occupied || 0;
  const available = rooms.available || 0;
  const outOfOrder = rooms.outOfOrder || 0;

  const data = [
    { name: 'Occupied', value: occupied, color: '#4f46e5' }, // Indigo-600
    { name: 'Available', value: available, color: '#10b981' }, // Emerald-500
    { name: 'Out of Order', value: outOfOrder, color: '#f43f5e' }, // Rose-500
  ].filter(item => item.value > 0);

  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <Card className="flex flex-col h-full border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Occupancy Distribution</CardTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">Current room status for the business date</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center min-h-[250px]">
        {total > 0 ? (
          <div className="relative flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${value} Rooms`, 'Count']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-8">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{occupancyRate}%</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Occupancy</span>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">No room data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
