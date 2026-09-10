"use client";

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  reference: z.string().optional(),
  lines: z.array(z.object({
    accountId: z.string().min(1, "Account is required"),
    debit: z.coerce.number().min(0),
    credit: z.coerce.number().min(0),
  })).min(2, "At least two lines required")
}).refine((data) => {
  const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
  return Math.abs(totalDebit - totalCredit) < 0.01;
}, { message: "Total debits must equal total credits", path: ["lines"] });

type FormData = z.infer<typeof schema>;

export function NewJournalEntryModal({ accounts }: { accounts: { id: string; name: string; code: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  
  const { register, control, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      lines: [{ debit: 0, credit: 0, accountId: '' }, { debit: 0, credit: 0, accountId: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch('/api/v1/accountant/gl/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          date: new Date(data.date).toISOString()
        })
      });
      if (!res.ok) throw new Error('Failed to post journal entry');
      toast.success('Journal entry posted successfully');
      setOpen(false);
      reset();
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
        New Journal Entry
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-slate-50 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post Journal Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" {...register('date')} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
              {errors.date && <p className="text-red-400 text-xs">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input {...register('reference')} placeholder="e.g. ADJ-001" className="bg-slate-950 border-white/10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input {...register('description')} className="bg-slate-950 border-white/10 text-white" />
            {errors.description && <p className="text-red-400 text-xs">{errors.description.message}</p>}
          </div>

          <div className="mt-6 border border-white/10 rounded-xl p-4 bg-slate-950">
            <div className="flex justify-between items-center mb-4">
              <Label>Journal Lines</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ debit: 0, credit: 0, accountId: '' })} className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300">
                <Plus className="w-4 h-4 mr-1" /> Add Line
              </Button>
            </div>
            
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <select {...register(`lines.${index}.accountId`)} className="flex h-9 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 text-white">
                      <option value="">Select Account...</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                    {errors.lines?.[index]?.accountId && <p className="text-red-400 text-xs mt-1">{errors.lines[index]?.accountId?.message}</p>}
                  </div>
                  <div className="w-32">
                    <Input type="number" step="0.01" placeholder="Debit" {...register(`lines.${index}.debit`)} className="bg-slate-900 border-white/10 text-white" />
                  </div>
                  <div className="w-32">
                    <Input type="number" step="0.01" placeholder="Credit" {...register(`lines.${index}.credit`)} className="bg-slate-900 border-white/10 text-white" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            {errors.lines?.root && <p className="text-red-400 text-sm mt-4 font-medium">{errors.lines.root.message}</p>}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Posting...' : 'Post Entry'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
