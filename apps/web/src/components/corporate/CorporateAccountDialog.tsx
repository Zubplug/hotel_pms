'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { toast } from 'sonner';
import { ShieldAlert, Plus } from 'lucide-react';

interface QuickRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (ratePlanId: string) => void;
  propertyId: string;
}

function QuickRateDialog({ open, onOpenChange, onSaved, propertyId }: QuickRateDialogProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      code: '',
      amount: '',
      currency: 'NGN'
    }
  });

  useEffect(() => {
    if (open) {
      reset({
        name: '',
        code: '',
        amount: '',
        currency: 'NGN'
      });
    }
  }, [open, reset]);

  const onSubmit = async (data: any) => {
    try {
      const res = await fetch(`/api/v1/rate-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          propertyId,
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message || 'Failed to create rate plan');
      }
      
      const json = await res.json();
      toast.success('Corporate rate created successfully');
      onSaved(json.data.id);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle>Create Corporate Rate</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Rate Name *</Label>
            <Input {...register('name', { required: true })} placeholder="e.g. Apple Negotiated Rate" />
          </div>
          <div className="space-y-2">
            <Label>Rate Code *</Label>
            <Input {...register('code', { required: true })} placeholder="e.g. APP-CORP" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Flat Rate Amount *</Label>
              <Input type="number" step="0.01" {...register('amount', { required: true })} placeholder="e.g. 25000" />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select 
                value={watch('currency')} 
                onValueChange={(v) => setValue('currency', v as string)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">NGN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-md border border-slate-700">
            <strong>ⓘ Note:</strong> This flat rate will initially apply to all active room types. Individual room-type rates can be adjusted later in Rate Management.
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Rate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CorporateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  account?: any | null;
  propertyId: string;
  canEdit?: boolean;
  canChangeFinancials?: boolean;
  canChangeDepositPolicy?: boolean;
  canManageRates?: boolean;
}

export function CorporateAccountDialog({
  open,
  onOpenChange,
  onSaved,
  account,
  propertyId,
  canEdit = false,
  canChangeFinancials = false,
  canChangeDepositPolicy = false,
  canManageRates = true // default to true if they have access to this feature, or pass down from parent
}: CorporateAccountDialogProps) {
  const isEditing = !!account;
  const { mutate } = useSWRConfig();
  const [quickRateOpen, setQuickRateOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      code: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      creditLimit: 0,
      depositPolicy: 'WAIVED',
      exemptFromHighBalance: false,
      ratePlanId: 'none'
    }
  });

  const ratePlansKey = `/api/v1/rate-plans?propertyId=${propertyId}`;
  const { data: ratePlansData } = useSWR(
    open ? ratePlansKey : null,
    (url: string) => fetch(url).then(res => res.json())
  );
  const ratePlans = ratePlansData?.data || [];

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
        exemptFromHighBalance: account.exemptFromHighBalance || false,
        ratePlanId: account.ratePlanId || 'none'
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
        exemptFromHighBalance: false,
        ratePlanId: 'none'
      });
    }
  }, [account, open, reset]);

  const depositPolicy = watch('depositPolicy');
  const exemptFromHighBalance = watch('exemptFromHighBalance');
  const ratePlanId = watch('ratePlanId');

  const onSubmit = async (data: any) => {
    try {
      const url = isEditing 
        ? `/api/v1/corporate-accounts/${account.id}` 
        : `/api/v1/corporate-accounts`;
      
      const payload = {
        ...data,
        propertyId,
        creditLimit: Number(data.creditLimit),
        ratePlanId: data.ratePlanId === 'none' ? null : data.ratePlanId
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

  const handleRateCreated = async (newRatePlanId: string) => {
    await mutate(ratePlansKey);
    setValue('ratePlanId', newRatePlanId);
    setQuickRateOpen(false);
  };

  return (
    <>
      <QuickRateDialog 
        open={quickRateOpen} 
        onOpenChange={setQuickRateOpen} 
        onSaved={handleRateCreated}
        propertyId={propertyId}
      />
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input type="email" {...register('contactEmail')} disabled={formDisabled} />
              </div>
              <div className="space-y-2">
                <Label>Corporate Rate Plan</Label>
                <div className="flex space-x-2">
                  <Select 
                    disabled={formDisabled} 
                    value={ratePlanId} 
                    onValueChange={v => setValue('ratePlanId', v || 'none')}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="No corporate rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No corporate rate</SelectItem>
                      {ratePlans.map((plan: any) => (
                        <SelectItem key={plan.id} value={plan.id}>{plan.name} ({plan.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {canEdit && canManageRates && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => setQuickRateOpen(true)}
                      title="Create Custom Rate"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
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
    </>
  );
}
