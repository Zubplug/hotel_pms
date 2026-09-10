"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RunPayrollDialog() {
  const [open, setOpen] = useState(false);
  const [periodDate, setPeriodDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/accountant/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startDate: new Date(periodDate).toISOString(), 
          endDate: new Date(new Date(periodDate).setMonth(new Date(periodDate).getMonth() + 1)).toISOString()
        })
      });
      if (!res.ok) throw new Error('Failed to run payroll');
      
      toast.success('Payroll run initiated');
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || 'Error running payroll');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
        Run Payroll
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-slate-50 max-w-sm">
        <DialogHeader>
          <DialogTitle>Initiate Payroll Run</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleRun} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Payroll Period Start</Label>
            <Input type="date" required value={periodDate} onChange={(e) => setPeriodDate(e.target.value)} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Processing...' : 'Run Payroll'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
