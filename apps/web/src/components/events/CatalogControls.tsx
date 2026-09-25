'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveBanquetPackage, saveHall } from '@/lib/events/catalog-actions';
import { toast } from 'sonner';

function SubmitButton({ editing, pending }: { editing: boolean; pending: boolean }) {
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Create'}</Button>;
}

export function HallForm({ hall, onClose }: { hall?: { id: string; name: string; code: string; capacity: number; rate: string | null }; onClose?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(Boolean(hall));
  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    startTransition(async () => {
      try { await saveHall({ id: hall?.id, name: String(data.get('name') || ''), code: String(data.get('code') || ''), capacity: Number(data.get('capacity')), rate: Number(data.get('rate') || 0) }); toast.success(hall ? 'Hall updated.' : 'Hall created.'); setOpen(false); onClose?.(); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save hall.'); }
    });
  };
  if (!open) return hall ? <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>Edit</Button> : <Button onClick={() => setOpen(true)}>Add Hall</Button>;
  return <form onSubmit={event => { event.preventDefault(); submit(event.currentTarget); }} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-4"><Input name="name" defaultValue={hall?.name} placeholder="Hall name" required /><Input name="code" defaultValue={hall?.code} placeholder="Code" required /><Input name="capacity" defaultValue={hall?.capacity} type="number" min="1" placeholder="Capacity" required /><Input name="rate" defaultValue={hall?.rate || ''} type="number" min="0" step="0.01" placeholder="Rate" /><div className="flex gap-2 sm:col-span-4"><SubmitButton editing={Boolean(hall)} pending={pending} /><Button type="button" variant="outline" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</Button></div></form>;
}

export function HallScheduleLink({ hallId }: { hallId: string }) {
  return <Button variant="secondary" size="sm" className="w-full" asChild><Link href={`/fnb/events/bookings?view=timeline&hallId=${hallId}`}>View Schedule</Link></Button>;
}

export function PackageForm({ pkg }: { pkg?: { id: string; name: string; description: string | null; basePrice: string; isHallOnly: boolean } }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(Boolean(pkg));
  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    startTransition(async () => {
      try { await saveBanquetPackage({ id: pkg?.id, name: String(data.get('name') || ''), description: String(data.get('description') || ''), basePrice: Number(data.get('basePrice')), isHallOnly: data.get('isHallOnly') === 'on' }); toast.success(pkg ? 'Package updated.' : 'Package created.'); setOpen(false); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save package.'); }
    });
  };
  if (!open) return pkg ? <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>Edit Package</Button> : <Button onClick={() => setOpen(true)}>New Package</Button>;
  return <form onSubmit={event => { event.preventDefault(); submit(event.currentTarget); }} className="grid gap-2 rounded-lg border bg-white p-3"><Input name="name" defaultValue={pkg?.name} placeholder="Package name" required /><Input name="description" defaultValue={pkg?.description || ''} placeholder="Description" /><Input name="basePrice" defaultValue={pkg?.basePrice} type="number" min="0" step="0.01" placeholder="Base price" required /><label className="flex items-center gap-2 text-sm"><input name="isHallOnly" type="checkbox" defaultChecked={pkg?.isHallOnly} /> Hall only</label><div className="flex gap-2"><SubmitButton editing={Boolean(pkg)} pending={pending} /><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button></div></form>;
}
