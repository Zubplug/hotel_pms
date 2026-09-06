import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendData } from '@/types/night-audit';
import { format } from 'date-fns';

const currency = (value: number, code = 'NGN') => 
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

export function RevenueTrendChart({ trend, baseCurrency }: { trend: TrendData[] | undefined, baseCurrency: string }) {
  const [activeMetric, setActiveMetric] = useState<'all' | 'revenue' | 'adr' | 'revpar'>('all');

  if (!trend || trend.length === 0) {
    return (
      <Card className="flex flex-col h-full border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Seven-Day Performance</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">Historical performance trend</p>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center min-h-[250px]">
          <div className="flex h-full w-full items-center justify-center border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">No historical data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format data for Recharts
  const data = trend.map(day => ({
    ...day,
    formattedDate: format(new Date(day.businessDate), 'dd MMM'),
    revenue: Number(day.totalRevenue) || 0,
    adr: Number(day.adr) || 0,
    revpar: Number(day.revpar) || 0,
  }));

  const showRevenue = activeMetric === 'all' || activeMetric === 'revenue';
  const showAdr = activeMetric === 'all' || activeMetric === 'adr';
  const showRevpar = activeMetric === 'all' || activeMetric === 'revpar';

  return (
    <Card className="flex flex-col h-full border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold">Seven-Day Performance</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">Revenue and performance trend</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg mt-3 sm:mt-0">
          <button 
            onClick={() => setActiveMetric('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeMetric === 'all' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            All
          </button>
          <button 
            onClick={() => setActiveMetric('revenue')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeMetric === 'revenue' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            Revenue
          </button>
          <button 
            onClick={() => setActiveMetric('adr')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeMetric === 'adr' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            ADR
          </button>
          <button 
            onClick={() => setActiveMetric('revpar')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeMetric === 'revpar' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            RevPAR
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[250px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="formattedDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              dy={10}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(val) => {
                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}m`;
                if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                return val;
              }}
            />
            {showRevenue && (
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                formatter={(value: any, name: any) => [currency(value, baseCurrency), name === 'revenue' ? 'Revenue' : String(name).toUpperCase()]}
                labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
              />
            )}
            {showRevenue && <Bar yAxisId="left" dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} name="Revenue" />}
            {showAdr && <Line yAxisId="left" type="monotone" dataKey="adr" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="ADR" />}
            {showRevpar && <Line yAxisId="left" type="monotone" dataKey="revpar" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="RevPAR" />}
            {activeMetric === 'all' && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
