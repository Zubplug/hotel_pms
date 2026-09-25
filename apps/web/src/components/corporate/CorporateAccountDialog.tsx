/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/incompatible-library */
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Building2, CreditCard, Landmark, Mail, Phone, Plus, ShieldAlert, Tag, UserRound } from 'lucide-react';

const dialogInput = 'border-white/10 bg-white/[.045] text-slate-100 placeholder:text-slate-600 shadow-inner shadow-black/10 focus-visible:border-indigo-400 focus-visible:ring-indigo-400/20 disabled:cursor-not-allowed disabled:opacity-50';
const dialogSelect = 'border-white/10 bg-white/[.045] text-slate-100 shadow-inner shadow-black/10 focus:ring-indigo-400/20 data-[placeholder]:text-slate-500';

interface QuickRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (ratePlanId: string) => void;
  propertyId: string;
}

function QuickRateDialog({ open, onOpenChange, onSaved, propertyId }: QuickRateDialogProps) {
  const { data: roomTypesData } = useSWR(
    open ? `/api/v1/room-types?propertyId=${propertyId}` : null,
    (url: string) => fetch(url).then(res => res.json())
  );
  const roomTypes = roomTypesData?.data || [];

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      code: '',
      currency: 'NGN',
      rates: {} as Record<string, string>
    }
  });

  useEffect(() => {
    if (open) {
      reset({
        name: '',
        code: '',
        currency: 'NGN',
        rates: {}
      });
    }
  }, [open, reset]);

  const ratesState = watch('rates') || {};
  const includedCount = Object.values(ratesState).filter(val => val !== '' && val !== null && val !== undefined).length;
  const totalRoomTypes = roomTypes.length;

  const onSubmit = async (data: any) => {
    try {
      const submittedRates = Object.entries(data.rates || {})
        .filter((entry) => entry[1] !== '' && entry[1] !== null && entry[1] !== undefined)
        .map(([roomTypeId, amount]) => ({ roomTypeId, amount: Number(amount) }));
        
      if (submittedRates.length === 0) {
        throw new Error('Please enter a corporate rate for at least one room type.');
      }

      const res = await fetch(`/api/v1/rate-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          currency: data.currency,
          rates: submittedRates,
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

  const renderVariance = (roomTypeId: string, baseRate: number) => {
    const entered = ratesState[roomTypeId];
    if (!entered || isNaN(Number(entered))) return <span className="text-slate-500">—</span>;
    
    const corpAmount = Number(entered);
    const variance = baseRate - corpAmount;
    const isDiscount = variance > 0;
    
    if (variance === 0) return <span className="text-slate-400">Match base</span>;
    
    const pct = ((Math.abs(variance) / baseRate) * 100).toFixed(1);
    
    return (
      <span className={isDiscount ? "text-emerald-400" : "text-amber-400"}>
        {isDiscount ? '↓' : '↑'} {variance.toLocaleString()} ({pct}%)
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-h-[calc(100vh-2rem)] !w-[calc(100vw-2rem)] !max-w-[1180px] flex flex-col overflow-hidden rounded-2xl border-white/10 bg-[#0a0f1c] p-0 text-slate-100 shadow-[0_30px_100px_rgba(0,0,0,.65)]">
        <DialogHeader className="border-b border-white/[.08] bg-gradient-to-r from-indigo-950/80 to-[#0f172a] px-6 py-5">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-500/15 p-2.5 text-indigo-300"><Tag className="h-5 w-5" /></div><div><DialogTitle className="text-lg text-white">Create negotiated rate</DialogTitle><DialogDescription className="mt-1 text-xs text-slate-400">Build a rate card for this property and assign it to a corporate account.</DialogDescription></div></div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 lg:px-10">
          <div className="grid gap-4 rounded-xl border border-white/[.07] bg-white/[.02] p-4 sm:grid-cols-[1.35fr_1fr]">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-300">Rate name *</Label>
              <Input className={dialogInput} {...register('name', { required: true })} placeholder="e.g. Apple negotiated rate" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-300">Rate code</Label>
              <div className="flex h-10 items-center justify-between rounded-md border border-dashed border-indigo-400/25 bg-indigo-400/[.06] px-3 text-sm text-indigo-200">
                <span className="font-mono">AUTO-GENERATED</span>
                <span className="text-[10px] uppercase tracking-[.12em] text-indigo-300/70">Assigned on save</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-300">Settlement currency</Label>
            <div className="w-1/2">
              <Select 
                value={watch('currency')} 
                onValueChange={(v) => setValue('currency', v as string)}
              >
                <SelectTrigger className={dialogSelect}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#111827] text-slate-100">
                  <SelectItem value="NGN">NGN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
            <Label className="text-md font-semibold text-slate-100">Room type rates</Label>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                {includedCount} of {totalRoomTypes} included
              </span>
            </div>
            
            <p className="text-sm text-slate-400">
              Leave the Corporate Rate blank if a room type is not included in the agreement.
            </p>

            <div className="overflow-hidden rounded-xl border border-white/[.08] bg-[#0d1422]">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/[.04] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Room Type</th>
                    <th className="px-4 py-3 font-medium text-right">Base Rate</th>
                    <th className="px-4 py-3 font-medium">Corporate Rate</th>
                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {roomTypes.map((rt: any) => (
                    <tr key={rt.id} className="transition-colors hover:bg-white/[.03]">
                      <td className="px-4 py-3 font-medium text-slate-200">
                        {rt.name}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                        {Number(rt.baseRate).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 w-40">
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="—"
                          {...register(`rates.${rt.id}`)} 
                          className={`h-9 ${dialogInput}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                        {renderVariance(rt.id, Number(rt.baseRate))}
                      </td>
                    </tr>
                  ))}
                  {roomTypes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No active room types found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 z-10 mt-4 border-t border-white/[.08] bg-[#0a0f1c] py-3">
            <Button type="button" variant="outline" className="border-white/10 bg-white/[.04] text-slate-200 hover:bg-white/[.08]" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || includedCount === 0 || roomTypes.length === 0}>
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

  const ratePlansKey = `/api/v1/rate-plans?propertyId=${propertyId}&type=CORPORATE&includeRates=true`;
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
  const ratePlanLocked = Boolean(isEditing && account?.ratePlanLocked);

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
        <DialogContent className="!max-h-[calc(100vh-2rem)] !w-[calc(100vw-2rem)] !max-w-[1180px] overflow-hidden rounded-2xl border-white/10 bg-[#0a0f1c] p-0 text-slate-100 shadow-[0_30px_100px_rgba(0,0,0,.65)]">
          <DialogHeader className="border-b border-white/[.08] bg-gradient-to-r from-indigo-950/80 via-[#0f172a] to-[#0a0f1c] px-6 py-5">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300"><Building2 className="h-5 w-5" /></div><div><DialogTitle className="text-lg text-white">{isEditing ? 'Edit corporate account' : 'Create corporate account'}</DialogTitle><DialogDescription className="mt-1 text-xs text-slate-400">{isEditing ? 'Update the account profile, contracted rates and financial controls.' : 'Set up a company profile for negotiated rates and direct billing.'}</DialogDescription></div></div>
          </DialogHeader>

          {isEditing && <div className="grid gap-3 border-b border-white/[.08] bg-[#0d1422] px-6 py-4 sm:grid-cols-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Ledger position</p><p className={`mt-1 text-lg font-bold ${Number(account?.balance || 0) < 0 ? 'text-cyan-300' : Number(account?.balance || 0) > 0 ? 'text-rose-300' : 'text-slate-300'}`}>{Number(account?.balance || 0) < 0 ? 'Advance credit' : Number(account?.balance || 0) > 0 ? 'Receivable' : 'Settled'}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Current balance</p><p className="mt-1 text-lg font-bold text-slate-100">{new Intl.NumberFormat('en-NG', { style: 'currency', currency: account?.currency || 'NGN', maximumFractionDigits: 0 }).format(Math.abs(Number(account?.balance || 0)))}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Credit headroom</p><p className="mt-1 text-lg font-bold text-emerald-300">{account?.creditLimit > 0 ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: account?.currency || 'NGN', maximumFractionDigits: 0 }).format(Number(account?.availableCredit || 0)) : 'Not configured'}</p></div></div>}
          <form onSubmit={handleSubmit(onSubmit)} className="max-h-[calc(100vh-195px)] space-y-5 overflow-y-auto px-6 py-5 lg:px-10">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-indigo-300"><UserRound className="h-4 w-4" />Company identity</div>
            <div className="grid gap-4 rounded-xl border border-white/[.07] bg-white/[.02] p-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs font-medium text-slate-300">Company name *</Label>
                <Input className={dialogInput} {...register('name', { required: 'Company name is required' })} disabled={formDisabled || isEditing} placeholder="e.g. Worldwide Commercial Venture Ltd" />
                {errors.name && <p className="text-[11px] text-rose-300">{String(errors.name.message)}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-300">Corporate code</Label>
                {isEditing ? (
                  <Input className={`${dialogInput} font-mono uppercase`} value={account.code} readOnly disabled={formDisabled} />
                ) : (
                  <div className="flex h-10 items-center justify-between rounded-md border border-dashed border-emerald-400/25 bg-emerald-400/[.06] px-3 text-sm text-emerald-200">
                    <span className="font-mono">AUTO-GENERATED</span>
                    <span className="text-[10px] uppercase tracking-[.12em] text-emerald-300/70">Assigned on save</span>
                  </div>
                )}
              </div>
            </div>
            {isEditing && <p className="text-[11px] text-slate-500">Company name and corporate code are locked after creation to preserve ledger and audit continuity.</p>}

            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-indigo-300"><Phone className="h-4 w-4" />Primary contact</div>
            <div className="grid gap-4 rounded-xl border border-white/[.07] bg-white/[.02] p-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-300">Contact person</Label>
                <Input className={dialogInput} {...register('contactPerson')} disabled={formDisabled} placeholder="Account owner or billing lead" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-300">Contact phone</Label>
                <Input className={dialogInput} {...register('contactPhone')} disabled={formDisabled} placeholder="+234 800 000 0000" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-300"><Mail className="h-3.5 w-3.5 text-slate-500" />Billing email</Label>
                <Input className={dialogInput} type="email" {...register('contactEmail')} disabled={formDisabled} placeholder="billing@company.com" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-indigo-300"><Tag className="h-4 w-4" />Commercial agreement</div>
            <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-300">Corporate rate plan</Label>
                <div className="flex gap-2">
                  <Select 
                    disabled={formDisabled || ratePlanLocked}
                    value={ratePlanId} 
                    onValueChange={v => setValue('ratePlanId', v || 'none')}
                  >
                    <SelectTrigger className={`flex-1 ${dialogSelect}`}>
                      <SelectValue placeholder="No corporate rate" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#111827] text-slate-100">
                      <SelectItem value="none">No corporate rate</SelectItem>
                      {ratePlans.map((plan: any) => (
                        <SelectItem key={plan.id} value={plan.id}>{plan.name} · {plan.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canEdit && canManageRates && !ratePlanLocked && <Button type="button" variant="outline" className="border-indigo-400/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20" size="icon" onClick={() => setQuickRateOpen(true)} title="Create custom rate"><Plus className="h-4 w-4" /></Button>}
                </div>
                {ratePlanLocked ? (
                  <p className="text-[11px] text-amber-200/80">Locked while this account has {account?.openSharedFolios ? `${account.openSharedFolios} open shared folio${account.openSharedFolios === 1 ? '' : 's'}` : 'an open shared folio'}{account?.checkedInGuests ? ` or ${account.checkedInGuests} checked-in guest${account.checkedInGuests === 1 ? '' : 's'}` : ''}. This protects in-progress billing.</p>
                ) : (
                  <p className="text-[11px] text-slate-500">The negotiated rate will be applied when reservations are linked to this account.</p>
                )}
              </div>
            </div>

            {ratePlanId && ratePlanId !== 'none' && (
              (() => {
                const selectedPlan = ratePlans.find((p: any) => p.id === ratePlanId);
                if (!selectedPlan || !selectedPlan.rates || selectedPlan.rates.length === 0) return null;
                
                return (
                  <div className="mt-4 overflow-hidden rounded-xl border border-indigo-400/15 bg-[#0d1422]">
                    <div className="flex items-center justify-between border-b border-white/[.08] bg-indigo-500/[.06] px-4 py-3 text-sm font-medium text-slate-200">
                      <span>Included room types</span><span className="text-[11px] font-normal text-indigo-300">Negotiated pricing preview</span>
                    </div>
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/[.03] text-slate-500">
                        <tr>
                          <th className="px-4 py-2 font-medium">Room Type</th>
                          <th className="px-4 py-2 font-medium text-right">Base Rate</th>
                          <th className="px-4 py-2 font-medium text-right">Corporate Rate</th>
                          <th className="px-4 py-2 font-medium text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {selectedPlan.rates.map((rate: any) => {
                          const baseRate = Number(rate.roomType?.baseRate || 0);
                          const corpAmount = Number(rate.amount);
                          const variance = baseRate - corpAmount;
                          const isDiscount = variance > 0;
                          const pct = baseRate > 0 ? ((Math.abs(variance) / baseRate) * 100).toFixed(1) : '0.0';
                          
                          return (
                            <tr key={rate.id} className="hover:bg-white/[.03]">
                              <td className="px-4 py-2 font-medium text-slate-300">
                                {rate.roomType?.name || 'Unknown'}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-500 tabular-nums">
                                {baseRate.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-300 font-medium tabular-nums">
                                {corpAmount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                {variance === 0 ? (
                                  <span className="text-slate-500">Match base</span>
                                ) : (
                                  <span className={isDiscount ? "text-emerald-400" : "text-amber-400"}>
                                    {isDiscount ? '↓' : '↑'} {variance.toLocaleString()} ({pct}%)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}

            <div className="space-y-4 rounded-xl border border-amber-400/15 bg-amber-400/[.035] p-4">
              <h4 className="flex items-center text-sm font-semibold text-slate-100">
                <ShieldAlert className="mr-2 h-4 w-4 text-amber-300" />
                Financial controls
              </h4>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-300"><CreditCard className="h-3.5 w-3.5 text-slate-500" />Credit limit</Label>
                  <Input 
                    className={dialogInput}
                    type="number" 
                    step="0.01"
                    {...register('creditLimit')} 
                    disabled={formDisabled || financialsDisabled} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-300"><Landmark className="h-3.5 w-3.5 text-slate-500" />Deposit policy</Label>
                  <Select 
                    disabled={formDisabled || depositPolicyDisabled} 
                    value={depositPolicy} 
                    onValueChange={v => setValue('depositPolicy', v as any)}
                  >
                    <SelectTrigger className={`h-11 min-w-[240px] w-full ${dialogSelect}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#111827] text-slate-100">
                      <SelectItem value="WAIVED">Waived (Billed to AR)</SelectItem>
                      <SelectItem value="STANDARD">Standard (Guest pays)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/[.07] pt-3">
                <Label className="flex-1 cursor-pointer text-xs text-slate-300">
                  Exempt from high-balance controls
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
                <p className="text-xs leading-5 text-amber-200/70">
                  Changes to credit limits affect available credit for future City Ledger charges and are recorded in the audit trail.
                </p>
              )}
            </div>

            <DialogFooter className="sticky bottom-0 -mx-6 -mb-5 mt-1 border-t border-white/[.08] bg-[#0a0f1c] px-6 py-4">
              <Button type="button" variant="outline" className="border-white/10 bg-white/[.04] text-slate-200 hover:bg-white/[.08]" onClick={() => onOpenChange(false)}>
                {canEdit ? 'Cancel' : 'Close'}
              </Button>
              {canEdit && (
                <Button type="submit" disabled={isSubmitting} className="min-w-32 bg-indigo-600 text-white shadow-lg shadow-indigo-950/30 hover:bg-indigo-500">
                  {isSubmitting ? 'Saving...' : isEditing ? 'Save changes' : 'Create account'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
