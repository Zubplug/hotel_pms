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
  accountCode: z.string().min(1, "Account code is required"),
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
});

export function AddAccountModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const res = await fetch('/api/v1/accountant/gl/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create account');
      toast.success('Account created successfully');
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
        Add Account
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-slate-50 max-w-sm">
        <DialogHeader>
          <DialogTitle>New Chart of Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Account Code</Label>
            <Input {...register('accountCode')} placeholder="e.g. 1001" className="bg-slate-950 border-white/10 text-white" />
            {errors.accountCode && <p className="text-red-400 text-xs">{errors.accountCode.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register('name')} placeholder="e.g. Cash in Bank" className="bg-slate-950 border-white/10 text-white" />
            {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <select {...register('type')} className="flex h-9 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 text-white">
              <option value="">Select Type</option>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="EQUITY">Equity</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expense</option>
            </select>
            {errors.type && <p className="text-red-400 text-xs">{errors.type.message}</p>}
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Saving...' : 'Add Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
