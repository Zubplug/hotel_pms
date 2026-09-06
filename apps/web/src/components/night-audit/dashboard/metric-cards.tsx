import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Banknote, Users, ClipboardCheck, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const currency = (value: number, code = 'NGN') => 
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: number; // percentage change
  icon: React.ElementType;
  tone?: 'default' | 'rose' | 'emerald' | 'amber' | 'indigo';
}

function Metric({ label, value, trend, icon: Icon, tone = 'default' }: MetricCardProps) {
  const iconColors = {
    default: 'text-slate-500 bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400',
    rose: 'text-rose-600 bg-rose-100 dark:bg-rose-500/20 dark:text-rose-400',
    emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400',
    amber: 'text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-400',
    indigo: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-400',
  };

  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 tracking-tight">
              {label}
            </p>
            <h3 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {value}
            </h3>
          </div>
          <div className={`p-2.5 rounded-xl transition-colors ${iconColors[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        
        {trend !== undefined && (
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium">
            {trend > 0 ? (
              <>
                <span className="flex items-center text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                  {trend.toFixed(1)}%
                </span>
                <span className="text-slate-400">vs yesterday</span>
              </>
            ) : trend < 0 ? (
              <>
                <span className="flex items-center text-rose-600 dark:text-rose-400">
                  <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                  {Math.abs(trend).toFixed(1)}%
                </span>
                <span className="text-slate-400">vs yesterday</span>
              </>
            ) : (
              <>
                <span className="flex items-center text-slate-500 dark:text-slate-400">
                  <Minus className="mr-0.5 h-3.5 w-3.5" />
                  0.0%
                </span>
                <span className="text-slate-400">no change</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricCards({ data }: { data: NightAuditData }) {
  const baseCurrency = data.property.baseCurrency;
  
  const revenue = data.analytics.revenue || 0;
  const payments = data.analytics.payments || 0;
  const inHouseGuests = data.analytics.inHouseGuests || 0;
  const occupied = data.analytics.rooms?.occupied || 0;
  const totalRooms = data.analytics.rooms?.total || 0;
  const openSessions = (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0);
  
  const adr = occupied > 0 ? revenue / occupied : 0;
  const revpar = totalRooms > 0 ? revenue / totalRooms : 0;

  // Attempt to calculate trend if trend data exists
  let revTrend, adrTrend, revparTrend;
  if (data.analytics.trend && data.analytics.trend.length >= 2) {
    const yesterday = data.analytics.trend[data.analytics.trend.length - 1]; // Assume last item is yesterday
    const yRev = Number(yesterday.totalRevenue) || 0;
    const yAdr = Number(yesterday.adr) || 0;
    const yRevpar = Number(yesterday.revpar) || 0;
    
    if (yRev > 0) revTrend = ((revenue - yRev) / yRev) * 100;
    if (yAdr > 0) adrTrend = ((adr - yAdr) / yAdr) * 100;
    if (yRevpar > 0) revparTrend = ((revpar - yRevpar) / yRevpar) * 100;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Metric 
        label="Revenue" 
        value={currency(revenue, baseCurrency)} 
        trend={revTrend}
        icon={TrendingUp} 
        tone="emerald" 
      />
      <Metric 
        label="Payments" 
        value={currency(payments, baseCurrency)} 
        icon={Banknote} 
        tone="indigo" 
      />
      <Metric 
        label="ADR" 
        value={currency(adr, baseCurrency)} 
        trend={adrTrend}
        icon={TrendingUp} 
        tone="default" 
      />
      <Metric 
        label="RevPAR" 
        value={currency(revpar, baseCurrency)} 
        trend={revparTrend}
        icon={TrendingUp} 
        tone="default" 
      />
      <Metric 
        label="In-House Guests" 
        value={inHouseGuests} 
        icon={Users} 
        tone="indigo" 
      />
      <Metric 
        label="Open Sessions" 
        value={openSessions} 
        icon={ClipboardCheck} 
        tone={openSessions > 0 ? 'rose' : 'emerald'} 
      />
    </div>
  );
}
