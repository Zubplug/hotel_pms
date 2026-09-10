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
  name: z.string().min(1, "Name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export function NewPeriodModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const res = await fetch('/api/v1/accountant/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString()
        })
      });
      if (!res.ok) throw new Error('Failed to create period');
      toast.success('Period created successfully');
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
        Open New Period
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-slate-50 max-w-sm">
        <DialogHeader>
          <DialogTitle>New Accounting Period</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Period Name</Label>
            <Input {...register('name')} placeholder="e.g. Q1 2026" className="bg-slate-950 border-white/10 text-white" />
            {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" {...register('startDate')} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
            {errors.startDate && <p className="text-red-400 text-xs">{errors.startDate.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input type="date" {...register('endDate')} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
            {errors.endDate && <p className="text-red-400 text-xs">{errors.endDate.message}</p>}
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Saving...' : 'Create Period'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
