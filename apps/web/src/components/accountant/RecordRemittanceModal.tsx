"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  taxType: z.string().min(1, "Tax type is required"),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  collectedAmount: z.coerce.number().min(0, "Amount must be positive"),
  remittedAmount: z.coerce.number().min(0, "Amount must be positive"),
  remittanceDate: z.string().min(1, "Date is required"),
  notes: z.string().optional()
});

export function RecordRemittanceModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { collectedAmount: 0, remittedAmount: 0 }
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const res = await fetch('/api/v1/accountant/taxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          periodStart: new Date(data.periodStart).toISOString(),
          periodEnd: new Date(data.periodEnd).toISOString(),
          remittanceDate: new Date(data.remittanceDate).toISOString()
        })
      });
      if (!res.ok) throw new Error('Failed to record remittance');
      toast.success('Remittance recorded successfully');
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
        New Remittance
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-slate-50 max-w-md">
        <DialogHeader>
          <DialogTitle>Record Tax Remittance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Tax Type</Label>
            <select {...register('taxType')} className="flex h-9 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 text-white">
              <option value="">Select Tax</option>
              <option value="VAT">Value Added Tax (VAT)</option>
              <option value="SERVICE_CHARGE">Service Charge</option>
              <option value="TOURISM_LEVY">Tourism Levy</option>
              <option value="PAYE">PAYE (Income Tax)</option>
            </select>
            {errors.taxType && <p className="text-red-400 text-xs">{errors.taxType.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period Start</Label>
              <Input type="date" {...register('periodStart')} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
              {errors.periodStart && <p className="text-red-400 text-xs">{errors.periodStart.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Period End</Label>
              <Input type="date" {...register('periodEnd')} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
              {errors.periodEnd && <p className="text-red-400 text-xs">{errors.periodEnd.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Collected Amount (₦)</Label>
              <Input type="number" step="0.01" {...register('collectedAmount')} className="bg-slate-950 border-white/10 text-white" />
              {errors.collectedAmount && <p className="text-red-400 text-xs">{errors.collectedAmount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Remitted Amount (₦)</Label>
              <Input type="number" step="0.01" {...register('remittedAmount')} className="bg-slate-950 border-white/10 text-white" />
              {errors.remittedAmount && <p className="text-red-400 text-xs">{errors.remittedAmount.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Remittance Date</Label>
            <Input type="date" {...register('remittanceDate')} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
            {errors.remittanceDate && <p className="text-red-400 text-xs">{errors.remittanceDate.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Input {...register('notes')} placeholder="e.g. Receipt #..." className="bg-slate-950 border-white/10 text-white" />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Recording...' : 'Record Remittance'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
