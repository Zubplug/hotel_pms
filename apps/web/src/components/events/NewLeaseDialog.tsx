'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createLeaseContract } from '@/lib/events/lease-actions';
import { CalendarDays, CheckCircle2, Clock3, Landmark, Plus, Repeat2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Hall = { id: string; name: string; code: string; capacity: number };
type Corporate = { id: string; name: string; code: string };
type Segment = { hallId: string; usageDays: number[]; startTime: string; endTime: string; rate: string };
const days = [['0', 'Sun'], ['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat']] as const;
const emptySegment = (hallId = ''): Segment => ({ hallId, usageDays: [0], startTime: '09:00', endTime: '17:00', rate: '' });

export function NewLeaseDialog({ propertyId, halls, corporates, currency = 'NGN' }: { propertyId: string; halls: Hall[]; corporates: Corporate[]; currency?: string }) {
  const [open, setOpen] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([emptySegment(halls[0]?.id)]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const updateSegment = (index: number, change: Partial<Segment>) => setSegments((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  const toggleDay = (index: number, day: number) => setSegments((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, usageDays: item.usageDays.includes(day) ? item.usageDays.filter((value) => value !== day) : [...item.usageDays, day].sort() } : item));
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const toDate = (value: FormDataEntryValue | null) => new Date(`${String(value)}T00:00:00Z`);
        await createLeaseContract({
          propertyId,
          corporateAccountId: String(data.get('corporateAccountId')),
          hallId: segments[0].hallId,
          segments: segments.map((segment) => ({ ...segment, rate: Number(segment.rate) })),
          startDate: toDate(data.get('startDate')),
          endDate: toDate(data.get('endDate')),
          usageFrequency: String(data.get('usageFrequency')) as 'PER_USE' | 'DAILY' | 'WEEKLY',
          billingFrequency: String(data.get('billingFrequency')) as 'PER_USE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM',
          customBillingDates: String(data.get('customBillingDates') || '').split(',').map((value) => value.trim()).filter(Boolean).map((value) => new Date(`${value}T00:00:00Z`)),
          rate: Number(segments[0].rate),
          depositAmount: Number(data.get('depositAmount') || 0),
        });
        toast.success('Lease created and every hall schedule was reserved.');
        setOpen(false); router.refresh();
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to create the lease.'); }
    });
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" /> New lease</Button>} />
    <DialogContent className="fnb-event-dialog max-h-[92vh] overflow-y-auto sm:max-w-[900px]">
      <DialogHeader><div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Repeat2 className="h-5 w-5" /></div><DialogTitle className="text-xl">Create a multi-hall usage lease</DialogTitle><DialogDescription>One organisation contract can reserve different halls, days, times, and rates. Billing consolidates each period while retaining one invoice line per hall schedule.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-5">
        <section className="space-y-3"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300"><Landmark className="h-3.5 w-3.5" /> Contract owner</div><label className="space-y-1.5 text-xs font-semibold text-slate-300">Organisation<select name="corporateAccountId" required className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm">{corporates.length ? corporates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>) : <option value="">No active City Ledger organisations</option>}</select><span className="block text-[10px] font-normal text-slate-500">Contact details are taken from the corporate account and remain the system of record.</span></label></section>
        <section className="space-y-3 border-t border-white/10 pt-5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300"><CalendarDays className="h-3.5 w-3.5" /> Contract and billing</div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-semibold text-slate-300">Start date<input name="startDate" type="date" required className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm" /></label><label className="space-y-1.5 text-xs font-semibold text-slate-300">End date<input name="endDate" type="date" required className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm" /></label><label className="space-y-1.5 text-xs font-semibold text-slate-300">Usage pattern<select name="usageFrequency" className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm"><option value="WEEKLY">Weekly by selected days</option><option value="DAILY">Daily</option><option value="PER_USE">Single / per use</option></select></label><label className="space-y-1.5 text-xs font-semibold text-slate-300">Billing cycle<select name="billingFrequency" className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm"><option value="PER_USE">Per use</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option><option value="CUSTOM">Custom dates</option></select></label></div><label className="space-y-1.5 text-xs font-semibold text-slate-300">Custom billing dates<input name="customBillingDates" className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm" placeholder="2027-01-15, 2027-02-28" /><span className="block text-[10px] font-normal text-slate-500">Required only for Custom billing; separate dates with commas.</span></label></section>
        <section className="space-y-3 border-t border-white/10 pt-5"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300"><Clock3 className="h-3.5 w-3.5" /> Hall usage segments</div><Button type="button" variant="outline" size="sm" onClick={() => setSegments((items) => [...items, emptySegment(halls[0]?.id)])}><Plus className="mr-1 h-3.5 w-3.5" /> Add hall/time segment</Button></div><p className="text-xs text-slate-500">Example: Sunday · Hall B · 10:00–14:00; Tuesday · Gym Hall · 15:00–18:00; Friday · Meeting Hall · 09:00–12:00.</p>{segments.map((segment, index) => <div key={index} className="space-y-3 rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-200">Segment {index + 1}</p>{segments.length > 1 && <button type="button" onClick={() => setSegments((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-slate-500 hover:text-red-300" aria-label="Remove segment"><Trash2 className="h-4 w-4" /></button>}</div><div className="grid gap-4 sm:grid-cols-3"><label className="space-y-1.5 text-xs font-semibold text-slate-300 sm:col-span-2">Hall<select value={segment.hallId} onChange={(event) => updateSegment(index, { hallId: event.target.value })} required className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm">{halls.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code} · {item.capacity} guests</option>)}</select></label><label className="space-y-1.5 text-xs font-semibold text-slate-300">Rate per use ({currency})<input value={segment.rate} onChange={(event) => updateSegment(index, { rate: event.target.value })} type="number" min="0.01" step="0.01" required className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm" /></label></div><div><p className="mb-2 text-xs font-semibold text-slate-300">Usage days for this hall</p><div className="grid grid-cols-4 gap-2 text-xs sm:grid-cols-7">{days.map(([value, name]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.04] p-2 text-slate-300"><input type="checkbox" checked={segment.usageDays.includes(Number(value))} onChange={() => toggleDay(index, Number(value))} />{name}</label>)}</div></div><div className="grid gap-4 sm:grid-cols-3"><label className="space-y-1.5 text-xs font-semibold text-slate-300">Start time<input value={segment.startTime} onChange={(event) => updateSegment(index, { startTime: event.target.value })} type="time" required className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm" /></label><label className="space-y-1.5 text-xs font-semibold text-slate-300">End time<input value={segment.endTime} onChange={(event) => updateSegment(index, { endTime: event.target.value })} type="time" required className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm" /></label><div className="flex items-end text-xs text-slate-500">Each segment is checked independently.</div></div></div>)}</section>
        <label className="block max-w-sm space-y-1.5 text-xs font-semibold text-slate-300">Deposit ({currency})<input name="depositAmount" type="number" min="0" step="0.01" defaultValue="0" className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm" /></label>
        <div className="flex items-start gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/[.06] p-3 text-xs leading-5 text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />Every segment occurrence is conflict-checked, reserved under one event, and billed as a separate hall line.</div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending || !halls.length || !corporates.length}>{pending ? 'Creating lease…' : 'Create lease & reserve'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
