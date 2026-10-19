'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, RefreshCw, Loader2, LogOut, CheckCircle2,
  TrendingUp, Ticket, Users, Banknote, CreditCard,
  Building2, ReceiptText, BarChart3, Plus,
} from 'lucide-react';
import { formatMoney, formatDateTime } from '../_components/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { PrintPoolShiftButton } from '../_components/PoolPrintActions';

interface ShiftData {
  shiftStart: string | null;
  staffName: string;
  currency: string;
  todayAdmissions: number;
  todayGuests: number;
  revenue: number;
  byMethod: { method: string; count: number; amount: number }[];
  byPass: { name: string; count: number }[];
  incidentCount: number;
  checkCount: number;
  activeNow: number;
  openIncidents: number;
}

const METHOD_ICONS: Record<string, React.ElementType> = {
  CASH: Banknote,
  CARD: CreditCard,
  ROOM_CHARGE: Building2,
  COMPLIMENTARY: ReceiptText,
};

const METHOD_COLOURS: Record<string, string> = {
  CASH: '#34d399',
  CARD: '#38bdf8',
  ROOM_CHARGE: '#a78bfa',
  COMPLIMENTARY: '#f59e0b',
};

export default function ShiftPage() {
  const { provider } = useLodgeCoreProvider();
  const [data, setData] = useState<ShiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  const load = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [main, report] = await Promise.all([provider.pool.getSnapshot('', facilityId), provider.pool.getReport(today, today, facilityId)]);
      const md = main.data;
      const rd = report.data;

      // Aggregate payment methods from POS orders
      const methodMap: Record<string, { count: number; amount: number }> = {};
      for (const o of (rd?.posOrders ?? [])) {
        const m = (o as { paymentMethod?: string; paymentStatus?: string; total?: number }).paymentMethod ?? 'CASH';
        if (!methodMap[m]) methodMap[m] = { count: 0, amount: 0 };
        methodMap[m].count += 1;
        methodMap[m].amount += Number((o as { total?: number }).total ?? 0);
      }

      const byMethod = Object.entries(methodMap).map(([method, v]) => ({ method, ...v }));

      setData({
        shiftStart: new Date().toISOString(), // simplified — real PMS would have shift open time
        staffName: (md?.staffName ?? 'Pool Staff'),
        currency: md?.currency ?? 'NGN',
        todayAdmissions: rd?.summary?.totalAdmissions ?? 0,
        todayGuests: rd?.summary?.totalGuests ?? 0,
        revenue: rd?.summary?.posRevenue ?? 0,
        byMethod,
        byPass: Object.entries((rd?.byPass ?? {}) as Record<string, number>).map(([name, count]) => ({ name, count })),
        incidentCount: rd?.summary?.incidents ?? 0,
        checkCount: rd?.summary?.safetyChecks ?? 0,
        activeNow: md?.metrics?.occupancy ?? 0,
        openIncidents: (md?.incidents ?? []).length,
      });
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [facilityId, provider.pool]);

  useEffect(() => { load(); }, [load]);

  const closeShift = async () => {
    if (!confirm('Close this shift? This will generate the end-of-shift summary.')) return;
    setClosing(true);
    await new Promise(r => setTimeout(r, 800)); // Simulate shift close
    setClosing(false);
    setClosed(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#38bdf8' }} />
    </div>
  );

  if (!data) return null;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Shift header */}
      <div className="rounded-2xl p-5" style={{ border: '1px solid rgba(56,189,248,0.20)', background: 'linear-gradient(135deg, rgba(56,189,248,0.06), rgba(167,139,250,0.04))' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="pool-live-dot" />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#38bdf8' }}>
                {closed ? 'Shift Closed' : 'Active Shift'}
              </span>
            </div>
            <h2 className="text-lg font-black text-white">End-of-Shift Summary</h2>
            <p className="text-[12px] mt-0.5" style={{ color: '#64748b' }}>
              {data.staffName} · {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PrintPoolShiftButton data={data} />
            <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {!closed ? (
              <button
                onClick={closeShift}
                disabled={closing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all"
                style={{ background: 'rgba(244,63,94,0.16)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.28)' }}
              >
                {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Close Shift
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold" style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399' }}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Shift Closed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { l: 'Admissions', v: data.todayAdmissions, icon: Ticket, c: '#38bdf8' },
          { l: 'Total Guests', v: data.todayGuests, icon: Users, c: '#a78bfa' },
          { l: 'Revenue', v: formatMoney(data.revenue, data.currency), icon: TrendingUp, c: '#34d399' },
          { l: 'Safety Checks', v: data.checkCount, icon: CheckCircle2, c: '#fcd34d' },
          { l: 'Incidents', v: data.incidentCount, icon: BarChart3, c: data.openIncidents > 0 ? '#fda4af' : '#64748b' },
          { l: 'Still Inside', v: data.activeNow, icon: Users, c: data.activeNow > 0 ? '#fb923c' : '#64748b' },
        ].map(({ l, v, icon: Icon, c }) => (
          <div key={l} className="pool-metric text-center py-3 flex flex-col items-center gap-1">
            <Icon className="w-4 h-4" style={{ color: c }} />
            <p className="text-xl font-black text-white">{v}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>{l}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by payment method */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Banknote className="w-4 h-4" style={{ color: '#34d399' }} />
            <span className="text-sm font-bold text-white">Revenue by Payment Method</span>
          </div>
          {data.byMethod.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm" style={{ color: '#475569' }}>No transactions today</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {data.byMethod.map(({ method, count, amount }) => {
                const Icon = METHOD_ICONS[method] ?? Banknote;
                const colour = METHOD_COLOURS[method] ?? '#94a3b8';
                return (
                  <div key={method} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${colour}1a` }}>
                      <Icon className="w-4 h-4" style={{ color: colour }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] font-bold text-white">{method.replace(/_/g, ' ')}</p>
                      <p className="text-[11px]" style={{ color: '#64748b' }}>{count} transaction{count !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-black" style={{ color: colour }}>{formatMoney(amount, data.currency)}</p>
                  </div>
                );
              })}
              {/* Total */}
              <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(56,189,248,0.05)' }}>
                <span className="text-[12px] font-bold text-white">Total Revenue</span>
                <span className="text-base font-black" style={{ color: '#38bdf8' }}>{formatMoney(data.revenue, data.currency)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Admissions by pass type */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Ticket className="w-4 h-4" style={{ color: '#38bdf8' }} />
            <span className="text-sm font-bold text-white">Admissions by Pass Type</span>
          </div>
          {data.byPass.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm" style={{ color: '#475569' }}>No admissions today</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {data.byPass.map(({ name, count }, i) => {
                const pct = data.todayAdmissions > 0 ? (count / data.todayAdmissions) * 100 : 0;
                const colours = ['#38bdf8', '#34d399', '#a78bfa', '#fb923c', '#fcd34d'];
                const c = colours[i % colours.length];
                return (
                  <div key={name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-semibold text-white">{name}</p>
                      <p className="text-sm font-black" style={{ color: c }}>{count}</p>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c }} />
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{pct.toFixed(0)}% of admissions</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Warnings */}
      {data.activeNow > 0 && (
        <div className="flex items-center gap-2 p-4 rounded-xl text-[12px]" style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.22)', color: '#fcd34d' }}>
          <Users className="w-4 h-4 shrink-0" />
          <span>
            <strong>{data.activeNow} guest{data.activeNow !== 1 ? 's' : ''}</strong> still inside the pool. Check them out before closing shift.
          </span>
        </div>
      )}
      {data.openIncidents > 0 && (
        <div className="flex items-center gap-2 p-4 rounded-xl text-[12px]" style={{ background: 'rgba(244,63,94,0.09)', border: '1px solid rgba(244,63,94,0.22)', color: '#fda4af' }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            <strong>{data.openIncidents} open incident{data.openIncidents !== 1 ? 's' : ''}</strong> still unresolved. Resolve before closing shift.
          </span>
        </div>
      )}
    </div>
  );
}
