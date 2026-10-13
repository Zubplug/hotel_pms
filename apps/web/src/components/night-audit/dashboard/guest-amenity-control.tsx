import React from 'react';
import { AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';

export function GuestAmenityControl({ data }: { data: NightAuditData }) {
  const control = data.financial.guestAmenity;
  if (!control) return null;
  const currency = data.property.baseCurrency || 'NGN';
  const formatMoney = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  const blocked = control.blockers.length > 0;

  return (
    <section className="rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-6 backdrop-blur-md sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${blocked ? 'border-rose-400/25 bg-rose-400/10 text-rose-400' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-400'}`}>
            <Package className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-white">Complimentary Guest Amenity Control</h3>
            <p className="text-sm text-slate-400">Night audit inventory issue and COGS preflight</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-bold ${blocked ? 'border-rose-400/25 bg-rose-400/10 text-rose-300' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'}`}>
          {blocked ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {control.enabled ? (blocked ? 'Blocked' : 'Ready') : 'Disabled'}
        </span>
      </div>

      {!control.enabled ? (
        <p className="mt-5 rounded-xl border border-white/[.06] bg-white/[.02] p-4 text-sm text-slate-400">Complimentary guest amenities are disabled for this property.</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Warehouse</p><p className="mt-1 truncate text-sm font-semibold text-white">{control.warehouse?.name || 'Not configured'}</p></div>
            <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">In-house guests</p><p className="mt-1 text-xl font-bold text-white">{control.guestCount}</p></div>
            <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cost / guest</p><p className="mt-1 text-xl font-bold text-rose-200">{formatMoney(control.perGuestCost)}</p></div>
            <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expected COGS</p><p className="mt-1 text-xl font-bold text-rose-200">{formatMoney(control.estimatedCost)}</p></div>
          </div>
          {(blocked || control.zeroCostItems.length > 0) && (
            <div className="mt-4 space-y-1 rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-4 text-xs">
              {control.blockers.map((blocker) => <p key={blocker} className="font-semibold text-rose-300">{blocker}</p>)}
              {control.zeroCostItems.length > 0 && <p className="text-amber-300">Reference cost used for zero-cost inventory: {control.zeroCostItems.join(', ')}.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
