"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

const formSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  subtotal: z.coerce.number().min(0, 'Subtotal must be positive'),
  taxAmount: z.coerce.number().min(0, 'Tax amount must be positive'),
});

type FormValues = z.infer<typeof formSchema>;

export function RecordSupplierBillModal({ suppliers = [] }: { suppliers?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplierId: '',
      invoiceNumber: '',
      invoiceDate: '',
      dueDate: '',
      subtotal: 0,
      taxAmount: 0,
    }
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await fetch('/api/v1/accountant/payables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to record bill');
      }

      toast.success('Bill recorded');
      setOpen(false);
      reset();
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while recording the bill');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger >
        <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          Record Bill
        </button>
      </DialogTrigger>
      <DialogContent className="bg-slate-950 border-white/10 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record Supplier Bill</DialogTitle>
          <DialogDescription className="text-slate-400">
            Enter the details of the supplier invoice below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Supplier</label>
            <select
              {...register('supplierId')}
              className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Select a supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.supplierId && <p className="text-red-400 text-xs">{errors.supplierId.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Invoice Number</label>
            <input
              type="text"
              {...register('invoiceNumber')}
              className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="e.g. INV-2023-001"
            />
            {errors.invoiceNumber && <p className="text-red-400 text-xs">{errors.invoiceNumber.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Invoice Date</label>
              <input
                type="date"
                {...register('invoiceDate')}
                className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [color-scheme:dark]"
              />
              {errors.invoiceDate && <p className="text-red-400 text-xs">{errors.invoiceDate.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <input
                type="date"
                {...register('dueDate')}
                className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [color-scheme:dark]"
              />
              {errors.dueDate && <p className="text-red-400 text-xs">{errors.dueDate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subtotal</label>
              <input
                type="number"
                step="0.01"
                {...register('subtotal')}
                className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              {errors.subtotal && <p className="text-red-400 text-xs">{errors.subtotal.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tax Amount</label>
              <input
                type="number"
                step="0.01"
                {...register('taxAmount')}
                className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              {errors.taxAmount && <p className="text-red-400 text-xs">{errors.taxAmount.message}</p>}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Record Bill'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
