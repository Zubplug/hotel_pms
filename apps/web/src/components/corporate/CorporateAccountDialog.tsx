'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';

interface CorporateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  account?: any | null;
  propertyId: string;
  canEdit?: boolean;
  canChangeFinancials?: boolean;
  canChangeDepositPolicy?: boolean;
}

export function CorporateAccountDialog({
  open,
  onOpenChange,
  onSaved,
  account,
  propertyId,
  canEdit = false,
  canChangeFinancials = false,
  canChangeDepositPolicy = false
}: CorporateAccountDialogProps) {
  const isEditing = !!account;
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      code: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      creditLimit: 0,
      depositPolicy: 'WAIVED',
      exemptFromHighBalance: false
    }
  });

  useEffect(() => {
    if (account && open) {
      reset({
        name: account.name || '',
        code: account.code || '',
        contactPerson: account.contactPerson || '',
        contactEmail: account.contactEmail || '',
        contactPhone: account.contactPhone || '',
        creditLimit: account.creditLimit || 0,
        depositPolicy: account.depositPolicy || 'WAIVED',
        exemptFromHighBalance: account.exemptFromHighBalance || false
      });
    } else if (open) {
      reset({
        name: '',
        code: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        creditLimit: 0,
        depositPolicy: 'WAIVED',
        exemptFromHighBalance: false
      });
    }
  }, [account, open, reset]);

  const depositPolicy = watch('depositPolicy');
  const exemptFromHighBalance = watch('exemptFromHighBalance');

  const onSubmit = async (data: any) => {
    try {
      const url = isEditing 
        ? `/api/v1/corporate-accounts/${account.id}` 
        : `/api/v1/corporate-accounts`;
      
      const payload = {
        ...data,
        propertyId,
        creditLimit: Number(data.creditLimit)
      };
      if (isEditing && (
        Number(data.creditLimit) !== Number(account.creditLimit) ||
        data.depositPolicy !== account.depositPolicy ||
        Boolean(data.exemptFromHighBalance) !== Boolean(account.exemptFromHighBalance)
      )) {
        const reason = window.prompt('Reason for changing financial controls (required):');
        if (!reason || reason.trim().length < 5) throw new Error('A financial-control change reason is required');
        (payload as any).reason = reason.trim();
      }

      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save corporate account');
      }

      toast.success(isEditing ? 'Account updated' : 'Account created');
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const formDisabled = !canEdit;
  const financialsDisabled = !canChangeFinancials;
  const depositPolicyDisabled = !canChangeDepositPolicy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Corporate Account' : 'New Corporate Account'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input {...register('name', { required: true })} disabled={formDisabled} />
            </div>
            <div className="space-y-2">
              <Label>Corporate Code *</Label>
              <Input {...register('code', { required: true })} disabled={formDisabled} placeholder="e.g. ABC" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input {...register('contactPerson')} disabled={formDisabled} />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input {...register('contactPhone')} disabled={formDisabled} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contact Email</Label>
            <Input type="email" {...register('contactEmail')} disabled={formDisabled} />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-4">
            <h4 className="flex items-center text-sm font-semibold text-slate-200">
              <ShieldAlert className="mr-2 h-4 w-4 text-emerald-400" />
              Financial Controls
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Credit Limit (City Ledger)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  {...register('creditLimit')} 
                  disabled={formDisabled || financialsDisabled} 
                />
              </div>
              <div className="space-y-2">
                <Label>Deposit Policy</Label>
                <Select 
                  disabled={formDisabled || depositPolicyDisabled} 
                  value={depositPolicy} 
                  onValueChange={v => setValue('depositPolicy', v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WAIVED">Waived (Billed to AR)</SelectItem>
                    <SelectItem value="STANDARD">Standard (Guest pays)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="flex-1 cursor-pointer">
                Exempt from High Balance Reports
              </Label>
              <Switch 
                disabled={formDisabled || financialsDisabled}
                checked={exemptFromHighBalance}
                onCheckedChange={v => setValue('exemptFromHighBalance', v)}
              />
            </div>

            {(!canChangeFinancials || !canChangeDepositPolicy) && isEditing && (
              <p className="text-xs text-rose-300/80">
                You do not have permission to modify financial controls for this account.
              </p>
            )}
            {(canChangeFinancials || canChangeDepositPolicy) && (
              <p className="text-xs text-emerald-400/80">
                Warning: Changing the credit limit affects the company's available credit for future City Ledger charges. This action will be audited.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {canEdit ? 'Cancel' : 'Close'}
            </Button>
            {canEdit && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Account'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
