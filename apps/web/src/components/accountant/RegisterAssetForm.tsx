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
  code: z.string().min(1, "Asset code is required"),
  categoryId: z.string().min(1, "Category is required"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  purchasePrice: z.coerce.number().min(0, "Purchase price must be positive"),
  salvageValue: z.coerce.number().min(0, "Salvage value must be positive"),
  usefulLifeYears: z.coerce.number().min(1, "Useful life must be at least 1 year"),
});

type FormData = z.infer<typeof schema>;

export function RegisterAssetForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { purchasePrice: 0, salvageValue: 0, usefulLifeYears: 5 }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch('/api/v1/accountant/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          purchaseDate: new Date(data.purchaseDate).toISOString()
        })
      });
      if (!res.ok) throw new Error('Failed to register asset');
      toast.success('Asset registered successfully');
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
        Register Asset
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-slate-50 max-w-md">
        <DialogHeader>
          <DialogTitle>Register New Fixed Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Asset Name</Label>
            <Input {...register('name')} className="bg-slate-950 border-white/10 text-white" />
            {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Asset Code</Label>
              <Input {...register('code')} className="bg-slate-950 border-white/10 text-white" />
              {errors.code && <p className="text-red-400 text-xs">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select {...register('categoryId')} className="flex h-9 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 text-white">
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.categoryId && <p className="text-red-400 text-xs">{errors.categoryId.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Purchase Date</Label>
            <Input type="date" {...register('purchaseDate')} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
            {errors.purchaseDate && <p className="text-red-400 text-xs">{errors.purchaseDate.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purchase Price (₦)</Label>
              <Input type="number" step="0.01" {...register('purchasePrice')} className="bg-slate-950 border-white/10 text-white" />
              {errors.purchasePrice && <p className="text-red-400 text-xs">{errors.purchasePrice.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Salvage Value (₦)</Label>
              <Input type="number" step="0.01" {...register('salvageValue')} className="bg-slate-950 border-white/10 text-white" />
              {errors.salvageValue && <p className="text-red-400 text-xs">{errors.salvageValue.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Useful Life (Years)</Label>
            <Input type="number" {...register('usefulLifeYears')} className="bg-slate-950 border-white/10 text-white" />
            {errors.usefulLifeYears && <p className="text-red-400 text-xs">{errors.usefulLifeYears.message}</p>}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Registering...' : 'Register Asset'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
