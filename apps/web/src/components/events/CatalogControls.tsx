'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { saveBanquetPackage, saveHall } from '@/lib/events/catalog-actions';
import { toast } from 'sonner';
import { Building2, Package, Pencil, Plus } from 'lucide-react';
import { HallScheduleDialog } from './HallScheduleDialog';

function SubmitButton({ editing, pending, noun }: { editing: boolean; pending: boolean; noun: string }) {
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : `Create ${noun}`}</Button>;
}

export function HallForm({ hall, onClose }: { hall?: { id: string; name: string; code: string; capacity: number; rate: string | null }; onClose?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    startTransition(async () => {
      try { await saveHall({ id: hall?.id, name: String(data.get('name') || ''), code: String(data.get('code') || ''), capacity: Number(data.get('capacity')), rate: Number(data.get('rate') || 0) }); toast.success(hall ? 'Hall updated.' : 'Hall created.'); setOpen(false); onClose?.(); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save hall.'); }
    });
  };
  return <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) onClose?.(); }}>
    <DialogTrigger render={<Button variant={hall ? 'outline' : 'default'} size={hall ? 'sm' : 'default'}><span className="flex items-center gap-2">{hall ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}{hall ? 'Edit hall' : 'Add Hall'}</span></Button>} />
    <DialogContent className="sm:max-w-[560px]">
      <DialogHeader><div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#24130d] text-orange-300"><Building2 className="h-5 w-5" /></div><DialogTitle className="text-xl text-[#24130d]">{hall ? 'Edit hall details' : 'Add a new hall'}</DialogTitle><DialogDescription>{hall ? 'Update the sellable space details used by your event booking flow.' : 'Set up a function space with the capacity and base rate your sales team will use.'}</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); submit(event.currentTarget); }} className="space-y-4">
        <div className="rounded-xl border border-[#eadfd8] bg-[#fff8f2] p-3 text-xs leading-5 text-[#6f5d53]">This information appears in the event diary and is used to validate guest capacity during booking.</div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53] sm:col-span-2">Hall name<Input name="name" defaultValue={hall?.name} placeholder="e.g. Grand Ballroom" required className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Short code<Input name="code" defaultValue={hall?.code} placeholder="e.g. GB" required className="mt-1.5 uppercase" /><span className="block text-[10px] font-normal text-[#947d72]">A unique internal code for schedules.</span></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Guest capacity<Input name="capacity" defaultValue={hall?.capacity} type="number" min="1" placeholder="250" required className="mt-1.5" /><span className="block text-[10px] font-normal text-[#947d72]">Maximum guests this space can hold.</span></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53] sm:col-span-2">Base hall rate<Input name="rate" defaultValue={hall?.rate || ''} type="number" min="0" step="0.01" placeholder="0" className="mt-1.5" /><span className="block text-[10px] font-normal text-[#947d72]">Optional starting rate in NGN. Packages can be priced separately.</span></label></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton editing={Boolean(hall)} pending={pending} noun="hall" /></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function HallScheduleLink({ hallId }: { hallId: string }) {
  return <HallScheduleDialog hallId={hallId} />;
}

export function PackageForm({ pkg }: { pkg?: { id: string; name: string; description: string | null; basePrice: string; isHallOnly: boolean } }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    startTransition(async () => {
      try { await saveBanquetPackage({ id: pkg?.id, name: String(data.get('name') || ''), description: String(data.get('description') || ''), basePrice: Number(data.get('basePrice')), isHallOnly: data.get('isHallOnly') === 'on' }); toast.success(pkg ? 'Package updated.' : 'Package created.'); setOpen(false); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save package.'); }
    });
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button variant={pkg ? 'outline' : 'default'}><span className="flex items-center gap-2">{pkg ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}{pkg ? 'Edit package' : 'New Package'}</span></Button>} />
    <DialogContent className="sm:max-w-[540px]">
      <DialogHeader><div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Package className="h-5 w-5" /></div><DialogTitle>{pkg ? 'Edit package details' : 'Create a new package'}</DialogTitle><DialogDescription>{pkg ? 'Update the commercial offer shown to the banquet booking team.' : 'Create a sellable package with a base price and booking type.'}</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); submit(event.currentTarget); }} className="space-y-4"><div className="space-y-4"><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Package name<Input name="name" defaultValue={pkg?.name} placeholder="e.g. Executive Conference Package" required className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Description<Input name="description" defaultValue={pkg?.description || ''} placeholder="Short description for sales and proposals" className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Base price<Input name="basePrice" defaultValue={pkg?.basePrice} type="number" min="0" step="0.01" placeholder="0" required className="mt-1.5" /></label><label className="flex items-center gap-3 rounded-xl border border-[#eadfd8] bg-[#fff8f2] p-3 text-sm font-medium text-[#3d2318]"><input name="isHallOnly" type="checkbox" defaultChecked={pkg?.isHallOnly} className="h-4 w-4 accent-orange-600" /><span><span className="block">Hall-only offer</span><span className="block text-xs font-normal text-[#947d72]">Use this for space rental without a catering package.</span></span></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton editing={Boolean(pkg)} pending={pending} noun="package" /></DialogFooter></form>
    </DialogContent>
  </Dialog>;
}
