'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

type RoomType = { id: string; name: string; baseRate: number | string; currency?: string };
type RuleDraft = { amount: string; minAdults: string; maxAdults: string; minChildren: string; maxChildren: string; minOccupancy: string; maxOccupancy: string; minStay: string; maxStay: string; minRooms: string; maxRooms: string; longStayDiscount: string; multiRoomDiscount: string; prepaidAdjustment: string };

const inputClass = 'border-white/10 bg-white/[.045] text-slate-100 placeholder:text-slate-600';
const initialRule = (): RuleDraft => ({ amount: '', minAdults: '1', maxAdults: '2', minChildren: '0', maxChildren: '0', minOccupancy: '1', maxOccupancy: '2', minStay: '1', maxStay: '', minRooms: '1', maxRooms: '', longStayDiscount: '', multiRoomDiscount: '', prepaidAdjustment: '' });

export function CorporateApiContractDialog({ open, onOpenChange, accountId, propertyId, accountName }: { open: boolean; onOpenChange: (open: boolean) => void; accountId: string; propertyId: string; accountName: string }) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rules, setRules] = useState<Record<string, RuleDraft>>({});
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [paymentMode, setPaymentMode] = useState('PAY_LATER');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/v1/room-types?propertyId=${encodeURIComponent(propertyId)}`)
      .then(response => response.json())
      .then(json => {
        const rooms = (json.data || []).filter((room: RoomType) => room.id && room.name);
        setRoomTypes(rooms);
        setRules(current => Object.fromEntries(rooms.map((room: RoomType) => [room.id, current[room.id] || initialRule()])));
      })
      .catch(() => toast.error('Unable to load active room types'));
  }, [open, propertyId]);

  const includedRooms = useMemo(() => roomTypes.filter((room: RoomType) => rules[room.id]?.amount), [roomTypes, rules]);
  const updateRule = (roomTypeId: string, field: keyof RuleDraft, value: string) => setRules(current => ({ ...current, [roomTypeId]: { ...(current[roomTypeId] || initialRule()), [field]: value } }));
  const numberValue = (value: string, nullable = false) => value === '' && nullable ? null : Number(value);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !reference.trim()) return toast.error('Contract name and reference are required');
    if (includedRooms.length === 0) return toast.error('Add at least one room-type API rate');
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/corporate-contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corporateAccountId: accountId, propertyId, name: name.trim(), reference: reference.trim().toUpperCase(), defaultCurrency: currency, paymentMode,
          effectiveFrom, effectiveTo: effectiveTo || null,
          rules: includedRooms.map(room => { const rule = rules[room.id]; const factors: Record<string, unknown> = {}; if (rule.longStayDiscount) factors.stayLength = [{ minNights: Number(rule.minStay), maxNights: numberValue(rule.maxStay, true), adjustmentType: 'PERCENT_DISCOUNT', value: Number(rule.longStayDiscount) }]; if (rule.multiRoomDiscount) factors.roomCount = [{ minRooms: Number(rule.minRooms), maxRooms: numberValue(rule.maxRooms, true), adjustmentType: 'PERCENT_DISCOUNT', value: Number(rule.multiRoomDiscount) }]; if (rule.prepaidAdjustment) factors.paymentMode = { FULL: { adjustmentType: 'FIXED_NIGHTLY_ADJUSTMENT', value: Number(rule.prepaidAdjustment) } }; return { roomTypeId: room.id, amount: Number(rule.amount), currency, minAdults: Number(rule.minAdults), maxAdults: numberValue(rule.maxAdults, true), minChildren: Number(rule.minChildren), maxChildren: numberValue(rule.maxChildren, true), minOccupancy: Number(rule.minOccupancy), maxOccupancy: numberValue(rule.maxOccupancy, true), minStay: Number(rule.minStay), maxStay: numberValue(rule.maxStay, true), minRooms: Number(rule.minRooms), maxRooms: numberValue(rule.maxRooms, true), minLeadTimeHours: 0, maxAdvanceDays: null, pricingFactors: Object.keys(factors).length ? factors : null, weekdays: [], blackoutDates: [] }; }),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || json.message || 'Unable to create contract draft');
      toast.success('Corporate API contract draft saved');
      onOpenChange(false);
      setName(''); setReference(''); setRules({});
    } catch (error: any) { toast.error(error.message); } finally { setSubmitting(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="!max-h-[calc(100vh-2rem)] !w-[calc(100vw-2rem)] !max-w-[1180px] overflow-hidden rounded-2xl border-white/10 bg-[#0a0f1c] p-0 text-slate-100">
      <DialogHeader className="border-b border-white/[.08] bg-gradient-to-r from-cyan-950/80 to-[#0f172a] px-6 py-5">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300"><ShieldCheck className="h-5 w-5" /></div><div><DialogTitle className="text-lg text-white">Corporate API contract rate</DialogTitle><DialogDescription className="mt-1 text-xs text-slate-400">Create a draft negotiated contract for {accountName}. This does not change the PMS walk-in rate plan.</DialogDescription></div></div>
      </DialogHeader>
      <form onSubmit={submit} className="max-h-[calc(100vh-190px)] space-y-5 overflow-y-auto px-6 py-5 lg:px-10">
        <div className="grid gap-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[.03] p-4 sm:grid-cols-2">
          <div className="space-y-2"><Label className="text-xs text-slate-300">Contract name *</Label><Input className={inputClass} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. 2027 corporate accommodation agreement" /></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Contract reference *</Label><Input className={`${inputClass} font-mono uppercase`} value={reference} onChange={event => setReference(event.target.value)} placeholder="e.g. ACME-2027" /></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Currency</Label><select className={`h-10 w-full rounded-md ${inputClass}`} value={currency} onChange={event => setCurrency(event.target.value)}><option value="NGN">NGN</option><option value="USD">USD</option></select></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Payment mode</Label><select className={`h-10 w-full rounded-md ${inputClass}`} value={paymentMode} onChange={event => setPaymentMode(event.target.value)}><option value="PAY_LATER">Pay later — requires approval</option><option value="DEPOSIT">Partial prepayment</option><option value="FULL">Full prepayment</option><option value="PREPAID">Prepaid</option></select></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Effective from *</Label><Input type="date" className={inputClass} value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} /></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Effective to</Label><Input type="date" className={inputClass} value={effectiveTo} onChange={event => setEffectiveTo(event.target.value)} /></div>
        </div>
        <div><h3 className="text-sm font-semibold text-white">API room-type rates and restrictions</h3><p className="mt-1 text-xs text-slate-500">These rates are separate from the existing PMS rate plan. Leave a room blank if it is not covered by this contract.</p></div>
        <div className="overflow-x-auto rounded-xl border border-white/[.08] bg-[#0d1422]"><table className="w-full min-w-[1350px] text-xs"><thead className="bg-white/[.04] text-left text-slate-400"><tr><th className="px-3 py-3">Room type</th><th className="px-3 py-3">API rate</th><th className="px-3 py-3">Min/Max adults</th><th className="px-3 py-3">Min/Max children</th><th className="px-3 py-3">Min/Max guests</th><th className="px-3 py-3">Min/Max nights</th><th className="px-3 py-3">Min/Max rooms</th><th className="px-3 py-3">Factors</th></tr></thead><tbody className="divide-y divide-slate-800">{roomTypes.map(room => { const rule = rules[room.id] || initialRule(); const pair = (min: keyof RuleDraft, max: keyof RuleDraft) => <div className="flex gap-1"><Input type="number" min="0" className={`h-9 w-20 ${inputClass}`} value={rule[min]} onChange={event => updateRule(room.id, min, event.target.value)} placeholder="min" /><Input type="number" min="0" className={`h-9 w-20 ${inputClass}`} value={rule[max]} onChange={event => updateRule(room.id, max, event.target.value)} placeholder="max" /></div>; return <tr key={room.id}><td className="px-3 py-3 font-medium text-slate-200">{room.name}<div className="text-[10px] text-slate-500">Base: {Number(room.baseRate).toLocaleString()}</div></td><td className="px-3 py-3"><Input type="number" min="0" step="0.01" className={`h-9 w-28 ${inputClass}`} value={rule.amount} onChange={event => updateRule(room.id, 'amount', event.target.value)} placeholder="Not covered" /></td><td className="px-3 py-3">{pair('minAdults', 'maxAdults')}</td><td className="px-3 py-3">{pair('minChildren', 'maxChildren')}</td><td className="px-3 py-3">{pair('minOccupancy', 'maxOccupancy')}</td><td className="px-3 py-3">{pair('minStay', 'maxStay')}</td><td className="px-3 py-3">{pair('minRooms', 'maxRooms')}</td><td className="space-y-1 px-3 py-3"><Input type="number" min="0" max="100" step="0.01" className={`h-8 w-28 ${inputClass}`} value={rule.longStayDiscount} onChange={event => updateRule(room.id, 'longStayDiscount', event.target.value)} placeholder="Long stay %" /><Input type="number" min="0" max="100" step="0.01" className={`h-8 w-28 ${inputClass}`} value={rule.multiRoomDiscount} onChange={event => updateRule(room.id, 'multiRoomDiscount', event.target.value)} placeholder="Rooms %" /><Input type="number" step="0.01" className={`h-8 w-28 ${inputClass}`} value={rule.prepaidAdjustment} onChange={event => updateRule(room.id, 'prepaidAdjustment', event.target.value)} placeholder="Full-pay adj." /></td></tr>})}</tbody></table></div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[.04] p-4 text-xs leading-5 text-amber-100/80">This action creates a <strong>draft</strong> only. It does not activate API pricing, change PMS walk-in rates, authorize payment terms, or change the City Ledger. A property-authorized reviewer must approve and activate the contract version before API or website bookings can use it.</div>
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-5 border-t border-white/[.08] bg-[#0a0f1c] px-6 py-4"><Button type="button" variant="outline" className="border-white/10 bg-white/[.04] text-slate-200" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={submitting || roomTypes.length === 0} className="bg-cyan-600 text-white hover:bg-cyan-500">{submitting ? 'Saving draft...' : 'Save API contract draft'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
