'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CalendarDays, ClipboardList, Mail, Phone, Plus, UserRound } from 'lucide-react';
import { createEventLead } from '@/lib/events/crm-add-lead';
import { toast } from 'sonner';

const initialForm = { contactName: '', companyName: '', contactEmail: '', contactPhone: '', eventType: '', expectedGuests: '', preferredDate: '', notes: '' };

export function AddLeadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const update = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      await createEventLead({ ...formData, expectedGuests: Number(formData.expectedGuests || 0) });
      toast.success('Lead added to the sales pipeline.');
      setFormData(initialForm);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" /> New inquiry</Button>} /><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]"><DialogHeader><div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#24130d] text-orange-300"><UserRound className="h-5 w-5" /></div><DialogTitle className="text-xl text-[#24130d]">Capture a new event inquiry</DialogTitle><DialogDescription>Record enough commercial context for the sales team to respond, qualify, and convert the opportunity.</DialogDescription></DialogHeader><form onSubmit={handleSubmit} className="space-y-5"><section className="space-y-3"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700"><UserRound className="h-3.5 w-3.5" /> Contact profile</div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Contact name <Input name="contactName" value={formData.contactName} onChange={update} placeholder="e.g. Jane Doe" required className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Company / organization <Input name="companyName" value={formData.companyName} onChange={update} placeholder="Optional company name" className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]"><span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span><Input name="contactEmail" type="email" value={formData.contactEmail} onChange={update} placeholder="name@company.com" className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]"><span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span><Input name="contactPhone" value={formData.contactPhone} onChange={update} placeholder="+234 ..." className="mt-1.5" /></label></div></section><section className="space-y-3 border-t border-[#eadfd8] pt-5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700"><CalendarDays className="h-3.5 w-3.5" /> Event brief</div><div className="grid gap-4 sm:grid-cols-3"><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53] sm:col-span-1">Event type <Input name="eventType" value={formData.eventType} onChange={update} placeholder="Wedding, conference" className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Expected guests <Input name="expectedGuests" type="number" min="0" value={formData.expectedGuests} onChange={update} placeholder="150" className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[#6f5d53]">Preferred date <Input name="preferredDate" type="date" value={formData.preferredDate} onChange={update} className="mt-1.5" /></label></div></section><section className="space-y-3 border-t border-[#eadfd8] pt-5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700"><ClipboardList className="h-3.5 w-3.5" /> Sales notes</div><label className="sr-only" htmlFor="lead-notes">Sales notes</label><textarea id="lead-notes" name="notes" value={formData.notes} onChange={update} rows={4} placeholder="Capture requirements, budget context, source, or the next promised action..." className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-orange-500/30" /></section><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding inquiry…' : 'Add to pipeline'}</Button></DialogFooter></form></DialogContent></Dialog>;
}
