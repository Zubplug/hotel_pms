'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { saveBanquetPackage, saveEventEquipment, saveHall } from '@/lib/events/catalog-actions';
import { toast } from 'sonner';
import { Building2, Package, Pencil, Plus, Wrench } from 'lucide-react';
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
    <DialogContent className="fnb-event-dialog sm:max-w-[560px]">
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

type PackageProduct = { id: string; name: string; price: unknown };
type PackageLineItem = { posProductId?: string | null; nameOverride?: string | null; quantity: number; priceOverride?: unknown | null; posProduct?: { name: string; price: unknown } | null };

export function PackageForm({ pkg, products = [] }: { pkg?: { id: string; name: string; description: string | null; basePrice: string; isHallOnly: boolean; items?: PackageLineItem[] }; products?: PackageProduct[] }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Array<{ posProductId: string; quantity: number; priceOverride: string }>>(() => (pkg?.items || []).map((item) => ({ posProductId: item.posProductId || '', quantity: item.quantity, priceOverride: item.priceOverride == null ? '' : String(item.priceOverride) })));
  const selectableProducts = Array.from(new Map(products.map((product) => [`${product.name.trim().toLowerCase()}::${String(product.price)}`, product])).values());
  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const lineItems = items.filter((item) => item.posProductId).map((item) => ({ posProductId: item.posProductId, quantity: Number(item.quantity), priceOverride: item.priceOverride === '' ? undefined : Number(item.priceOverride) }));
    startTransition(async () => {
      try { await saveBanquetPackage({ id: pkg?.id, name: String(data.get('name') || ''), description: String(data.get('description') || ''), basePrice: Number(data.get('basePrice')), isHallOnly: data.get('isHallOnly') === 'on', items: lineItems }); toast.success(pkg ? 'Package updated.' : 'Package created.'); setOpen(false); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save package.'); }
    });
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button variant={pkg ? 'outline' : 'default'}><span className="flex items-center gap-2">{pkg ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}{pkg ? 'Edit package' : 'New Package'}</span></Button>} />
    <DialogContent className="fnb-event-dialog max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
      <DialogHeader><div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#24130d] text-orange-300"><Package className="h-5 w-5" /></div><DialogTitle className="text-xl text-[#24130d]">{pkg ? 'Edit package details' : 'Create a new package'}</DialogTitle><DialogDescription>{pkg ? 'Update the commercial offer, pricing, and live POS items attached to this package.' : 'Build a complete sellable banquet offer with pricing, positioning, and operational line items.'}</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); submit(event.currentTarget); }} className="space-y-5"><section className="space-y-4"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700">Commercial details</div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53] sm:col-span-2">Package name<Input name="name" defaultValue={pkg?.name} placeholder="e.g. Executive Conference Package" required className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53] sm:col-span-2">Sales description<Input name="description" defaultValue={pkg?.description || ''} placeholder="What is included and who is this offer for?" className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Base price<input name="basePrice" defaultValue={pkg?.basePrice} type="number" min="0" step="0.01" placeholder="0" required className="mt-1.5 flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/30" /><span className="block text-[10px] font-normal text-[#947d72]">Default price shown in sales and booking.</span></label><label className="flex items-center gap-3 self-end rounded-xl border border-[#eadfd8] bg-[#fff8f2] p-3 text-sm font-medium text-[#3d2318]"><input name="isHallOnly" type="checkbox" defaultChecked={pkg?.isHallOnly} className="h-4 w-4 accent-orange-600" /><span><span className="block">Hall-only offer</span><span className="block text-xs font-normal text-[#947d72]">No catering included.</span></span></label></div></section><section className="space-y-3 border-t border-[#eadfd8] pt-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700">Package composition</p><p className="mt-1 text-xs text-[#947d72]">Attach active POS products for kitchen and BEO handoff.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, { posProductId: '', quantity: 1, priceOverride: '' }])} disabled={!selectableProducts.length}> <Plus className="mr-1 h-3.5 w-3.5" /> Add item</Button></div>{!selectableProducts.length ? <p className="rounded-xl border border-dashed border-[#d9c8bd] p-4 text-xs text-[#947d72]">No active POS products are available to attach yet.</p> : items.length === 0 ? <p className="rounded-xl border border-dashed border-[#d9c8bd] p-4 text-xs text-[#947d72]">No package items added. You can create the package with just its commercial details.</p> : <div className="space-y-2">{items.map((item, index) => <div key={`${index}-${item.posProductId}`} className="grid gap-2 rounded-xl border border-[#eadfd8] bg-[#fffaf7] p-3 sm:grid-cols-[1fr_90px_120px_32px]"><select value={item.posProductId} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, posProductId: event.target.value } : row))} className="h-8 rounded-lg border border-input bg-white px-2 text-xs"><option value="">Select POS product</option>{selectableProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · ₦{Number(product.price).toLocaleString('en-NG')}</option>)}</select><input aria-label="Quantity" type="number" min="1" value={item.quantity} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row))} className="h-8 rounded-lg border border-input bg-white px-2 text-xs" placeholder="Qty" /><input aria-label="Price override" type="number" min="0" step="0.01" value={item.priceOverride} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, priceOverride: event.target.value } : row))} className="h-8 rounded-lg border border-input bg-white px-2 text-xs" placeholder="Price override" /><Button type="button" variant="ghost" size="icon-sm" onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}>×</Button></div>)}</div>}</section><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton editing={Boolean(pkg)} pending={pending} noun="package" /></DialogFooter></form>
    </DialogContent>
  </Dialog>;
}

export function EquipmentForm({ equipment }: { equipment?: { id: string; name: string; description: string | null; totalStock: number; rentalPrice: string } }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    startTransition(async () => {
      try { await saveEventEquipment({ id: equipment?.id, name: String(data.get('name') || ''), description: String(data.get('description') || ''), totalStock: Number(data.get('totalStock')), rentalPrice: Number(data.get('rentalPrice')) }); toast.success(equipment ? 'Equipment updated.' : 'Equipment added.'); setOpen(false); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save equipment.'); }
    });
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant={equipment ? 'outline' : 'default'} size={equipment ? 'sm' : 'default'}><span className="flex items-center gap-2">{equipment ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}{equipment ? 'Edit equipment' : 'Add equipment'}</span></Button>} /><DialogContent className="sm:max-w-[560px]"><DialogHeader><div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#24130d] text-orange-300"><Wrench className="h-5 w-5" /></div><DialogTitle className="text-xl text-[#24130d]">{equipment ? 'Edit equipment' : 'Add equipment inventory'}</DialogTitle><DialogDescription>{equipment ? 'Update the rentable inventory used by event bookings.' : 'Add a separate rentable resource with stock controls and a unit rental price.'}</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }} className="space-y-4"><div className="rounded-xl border border-[#eadfd8] bg-[#fff8f2] p-3 text-xs leading-5 text-[#6f5d53]">Equipment is reserved independently from banquet packages and checked for availability during booking.</div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53] sm:col-span-2">Equipment name<Input name="name" defaultValue={equipment?.name} placeholder="e.g. Wireless microphone" required className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53] sm:col-span-2">Description<Input name="description" defaultValue={equipment?.description || ''} placeholder="Optional operational description" className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Total stock<Input name="totalStock" defaultValue={equipment?.totalStock} type="number" min="1" required className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Rental price / unit<Input name="rentalPrice" defaultValue={equipment?.rentalPrice} type="number" min="0" step="0.01" required className="mt-1.5" /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton editing={Boolean(equipment)} pending={pending} noun="equipment" /></DialogFooter></form></DialogContent></Dialog>;
}
