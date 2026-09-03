'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { formatRoomNumber } from '@/lib/format-room';
import { Printer, RefreshCw } from 'lucide-react';

export function ReceptionistShiftStartReport({ open, onOpenChange, dashboardData, propertyId }: { open: boolean; onOpenChange: (open: boolean) => void; dashboardData: any; propertyId: string }) {
  const { provider } = useLodgeCoreProvider();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const loadRooms = async () => { setLoadingRooms(true); try { const result = await provider.rooms.list(propertyId); setRooms(Array.isArray(result) ? result : result?.data || []); } finally { setLoadingRooms(false); } };
  useEffect(() => { if (open) void loadRooms(); }, [open, propertyId]);
  const availableRooms = useMemo(() => rooms.filter(room => ['AVAILABLE', 'CLEAN'].includes(String(room.status).toUpperCase())), [rooms]);
  const arrivals = dashboardData?.arrivals || [];
  const departures = dashboardData?.departures || [];
  const money = (value: unknown) => `${dashboardData?.property?.currency || 'NGN'} ${Math.abs(Number(value || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const balanceLabel = (value: unknown) => { const balance = Number(value || 0); if (balance > 0) return { text: `${money(balance)} debt`, className: 'text-rose-700' }; if (balance < 0) return { text: `${money(balance)} credit`, className: 'text-emerald-700' }; return { text: 'Settled', className: 'text-emerald-700' }; };

  // Inject print CSS into <head> while dialog is open, remove on close
  useEffect(() => {
    if (!open) return;
    const styleId = 'shift-report-print-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body > * { display: none !important; }
          .shift-report-print-root {
            display: block !important;
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
            z-index: 99999 !important;
          }
          .shift-report-print-root * { visibility: visible !important; }
          .print\\:hidden { display: none !important; }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, [open]);

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="!fixed !inset-4 !max-w-none !w-auto !h-auto !translate-x-0 !translate-y-0 !top-4 !left-4 !right-4 !bottom-4 flex flex-col p-0 overflow-hidden">
    {/* Print-only root: this is what gets shown on paper */}
    <div className="shift-report-print-root flex flex-col flex-1 min-h-0">
      {/* Header toolbar — pinned at top, hidden when printing */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-950 px-6 py-4 pr-14 text-white print:hidden shrink-0">
        <DialogHeader><DialogTitle className="text-white">Shift Start Report</DialogTitle></DialogHeader>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadRooms()} disabled={loadingRooms} className="border-white/30 bg-white/10 text-white hover:bg-white/20"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button size="sm" onClick={() => window.print()} className="bg-blue-600 text-white hover:bg-blue-500"><Printer className="mr-2 h-4 w-4" />Print A4 report</Button>
        </div>
      </div>

      {/* Report body — scrollable on screen, full A4 width on paper */}
      <div className="bg-white p-6 text-slate-900 sm:p-10 overflow-y-auto flex-1 min-h-0">
        <div className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">LodgeCore PMS</p>
            <h1 className="mt-1 text-3xl font-black leading-tight">Reception Shift Start Report</h1>
            <p className="mt-1 text-sm text-slate-500">Daily operational brief · {new Date(dashboardData?.businessDate || Date.now()).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="max-w-[35%] shrink-0 text-right text-sm">
            <p className="font-bold">{dashboardData?.property?.name || 'Property'}</p>
            <p className="text-slate-500">Prepared {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Arrivals', arrivals.length], ['Departures', departures.length], ['Available rooms', availableRooms.length], ['Total rooms', rooms.length]].map(([label, value]) =>
            <div key={String(label)} className="rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-black">{value}</p>
            </div>
          )}
        </div>

        <section className="mt-7">
          <h2 className="border-b border-slate-300 pb-2 text-lg font-bold">Today’s arrivals</h2>
          <ReportTable rows={arrivals} kind="arrival" balanceLabel={balanceLabel} />
        </section>

        <section className="mt-7">
          <h2 className="border-b border-slate-300 pb-2 text-lg font-bold">Today’s departures</h2>
          <ReportTable rows={departures} kind="departure" balanceLabel={balanceLabel} />
        </section>

        <section className="mt-7">
          <h2 className="border-b border-slate-300 pb-2 text-lg font-bold">Available rooms at shift start</h2>
          {loadingRooms
            ? <p className="py-4 text-sm text-slate-500">Loading room inventory…</p>
            : <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {availableRooms.map(room => <div key={room.id} className="rounded border border-slate-200 px-3 py-2 text-sm"><span className="font-bold">{formatRoomNumber(room.number)}</span><span className="ml-2 text-slate-500">{room.roomType?.name || room.roomTypeName || ''}</span></div>)}
              </div>
          }
        </section>

        <div className="mt-10 border-t border-slate-300 pt-3 text-xs text-slate-500">
          Operational use only · Verify balances and room readiness before check-in. Generated by LodgeCore PMS.
        </div>
      </div>
    </div>
  </DialogContent></Dialog>;
}

function ReportTable({ rows, kind, balanceLabel }: { rows: any[]; kind: 'arrival' | 'departure'; balanceLabel: (value: unknown) => { text: string; className: string } }) {
  if (!rows.length) return <p className="py-4 text-sm text-slate-500">No {kind}s scheduled for today.</p>;
  return <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] table-fixed text-left text-xs"><thead className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="w-[24%] py-2">Guest</th><th className="w-[17%]">Phone</th><th className="w-[12%]">Room</th><th className="w-[14%]">{kind === 'arrival' ? 'Arrival' : 'Departure'}</th><th className="w-[17%]">Room status</th><th className="w-[16%] text-right">Folio balance</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => { const balance = balanceLabel(row.balance); return <tr key={row.id}><td className="truncate py-2 pr-2 font-semibold">{row.guestName}</td><td className="truncate pr-2 font-mono">{row.guestPhone || '—'}</td><td>{formatRoomNumber(row.roomName) || 'Unassigned'}</td><td>{kind === 'arrival' ? row.arrivalTime || '—' : row.checkOutTime || '—'}</td><td className="truncate">{String(row.roomStatus || 'UNKNOWN').replaceAll('_', ' ')}</td><td className={`text-right font-semibold ${balance.className}`}>{balance.text}</td></tr>; })}</tbody></table></div>;
}
