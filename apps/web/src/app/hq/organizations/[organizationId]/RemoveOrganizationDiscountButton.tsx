'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { removeOrganizationDiscount } from '../actions';

export default function RemoveOrganizationDiscountButton({ organizationId, discountId }: { organizationId: string; discountId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function remove() {
    setError(null);
    setConfirming(false);
    const formData = new FormData();
    formData.set('organizationId', organizationId);
    formData.set('discountId', discountId);
    startTransition(() => {
      void (async () => {
        try {
          await removeOrganizationDiscount(formData);
          toast.success('Discount removed. Future eligible charges will use the full price.');
        } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : 'The discount could not be removed.';
        setError(message);
        toast.error(message);
        }
      })();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => setConfirming(true)} disabled={pending} className="rounded-lg border border-rose-300/15 px-2.5 py-1.5 text-[10px] font-semibold text-rose-200 transition hover:bg-rose-300/10 disabled:cursor-wait disabled:opacity-50">
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {error && <p className="max-w-40 text-right text-[10px] text-rose-300">{error}</p>}
      {confirming && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#020713]/75 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby={`remove-discount-${discountId}`}>
        <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#101b2f] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
          <div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-300/10 text-rose-200"><AlertTriangle className="size-5" /></div><div><h2 id={`remove-discount-${discountId}`} className="text-base font-semibold text-white">Remove this discount?</h2><p className="mt-1 text-xs leading-5 text-slate-400">This commercial rule will stop applying to future eligible charges. Existing invoices will not be changed.</p></div></div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirming(false)} disabled={pending} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5">Keep discount</button><button type="button" onClick={remove} disabled={pending} className="rounded-xl bg-rose-400 px-4 py-2.5 text-xs font-bold text-rose-950 hover:bg-rose-300 disabled:cursor-wait disabled:opacity-50">{pending ? 'Removing…' : 'Remove discount'}</button></div>
        </div>
      </div>}
    </div>
  );
}
