'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

type RoomType = { id: string; name: string; baseRate: number | string; currency?: string };
type RuleDraft = { amount: string; minAdults: string; maxAdults: string; minChildren: string; maxChildren: string; minOccupancy: string; maxOccupancy: string; minStay: string; maxStay: string; minRooms: string; maxRooms: string; longStayDiscount: string; multiRoomDiscount: string; prepaidAdjustment: string; partialPaymentAdjustment: string; roomDiscountTiers: string; stayDiscountTiers: string };

const inputClass = 'border-white/10 bg-white/[.045] text-slate-100 placeholder:text-slate-600';
const initialRule = (): RuleDraft => ({ amount: '', minAdults: '1', maxAdults: '2', minChildren: '0', maxChildren: '0', minOccupancy: '1', maxOccupancy: '2', minStay: '1', maxStay: '', minRooms: '1', maxRooms: '', longStayDiscount: '', multiRoomDiscount: '', prepaidAdjustment: '', partialPaymentAdjustment: '', roomDiscountTiers: '', stayDiscountTiers: '' });
function parseDiscountTiers(value: string, dimension: 'rooms' | 'nights') { return value.split(',').map(item => item.trim()).filter(Boolean).map(item => { const [range, discount] = item.split(':').map(value => value.trim()); const [min, max] = range.split('-').map(value => Number(value)); return { ...(dimension === 'rooms' ? { minRooms: min, maxRooms: Number.isFinite(max) ? max : null } : { minNights: min, maxNights: Number.isFinite(max) ? max : null }), adjustmentType: 'PERCENT_DISCOUNT', value: Number(discount) }; }).filter(item => Number.isFinite(item.value) && item.value >= 0); }

export function CorporateApiContractDialog({ open, onOpenChange, accountId, propertyId, accountName, propertyDefault = false }: { open: boolean; onOpenChange: (open: boolean) => void; accountId?: string; propertyId: string; accountName: string; propertyDefault?: boolean }) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rules, setRules] = useState<Record<string, RuleDraft>>({});
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [paymentMode, setPaymentMode] = useState('PAY_LATER');
  const [negotiationEnabled, setNegotiationEnabled] = useState(false);
  const [negotiationMinRooms, setNegotiationMinRooms] = useState('');
  const [negotiationMinNights, setNegotiationMinNights] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [sourceRatePlanId, setSourceRatePlanId] = useState('');
  const [corporateRatePlans, setCorporateRatePlans] = useState<{ id: string; name: string; code: string; includeFoodAllocation: boolean }[]>([]);
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
    fetch(`/api/v1/rate-plans?propertyId=${encodeURIComponent(propertyId)}&type=CORPORATE`)
      .then(response => response.json())
      .then(json => {
        const plans = json.data || [];
        setCorporateRatePlans(plans);
        if (!sourceRatePlanId && plans[0]?.id) setSourceRatePlanId(plans[0].id);
      })
      .catch(() => toast.error('Unable to load corporate rate plans'));
  }, [open, propertyId, sourceRatePlanId]);

  const includedRooms = useMemo(() => roomTypes.filter((room: RoomType) => rules[room.id]?.amount), [roomTypes, rules]);
  const updateRule = (roomTypeId: string, field: keyof RuleDraft, value: string) => setRules(current => ({ ...current, [roomTypeId]: { ...(current[roomTypeId] || initialRule()), [field]: value } }));
  const numberValue = (value: string, nullable = false) => value === '' && nullable ? null : Number(value);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !reference.trim()) return toast.error('Contract name and reference are required');
    if (includedRooms.length === 0) return toast.error('Add at least one room-type API rate');
    if (propertyDefault && !sourceRatePlanId) return toast.error('Select the PMS corporate rate plan used for this property default');
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/corporate-contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(propertyDefault ? { isPropertyDefault: true } : { corporateAccountId: accountId }), propertyId, name: name.trim(), reference: reference.trim().toUpperCase(), defaultCurrency: currency, paymentMode,
          effectiveFrom, effectiveTo: effectiveTo || null, negotiationEnabled, negotiationMinRooms: negotiationMinRooms ? Number(negotiationMinRooms) : null, negotiationMinNights: negotiationMinNights ? Number(negotiationMinNights) : null,
          rules: includedRooms.map(room => { const rule = rules[room.id]; const factors: Record<string, unknown> = {}; const stayTiers = parseDiscountTiers(rule.stayDiscountTiers, 'nights'); const roomTiers = parseDiscountTiers(rule.roomDiscountTiers, 'rooms'); if (stayTiers.length) factors.stayLength = stayTiers; else if (rule.longStayDiscount) factors.stayLength = [{ minNights: Number(rule.minStay), maxNights: numberValue(rule.maxStay, true), adjustmentType: 'PERCENT_DISCOUNT', value: Number(rule.longStayDiscount) }]; if (roomTiers.length) factors.roomCount = roomTiers; else if (rule.multiRoomDiscount) factors.roomCount = [{ minRooms: Number(rule.minRooms), maxRooms: numberValue(rule.maxRooms, true), adjustmentType: 'PERCENT_DISCOUNT', value: Number(rule.multiRoomDiscount) }]; const paymentMode: Record<string, unknown> = {}; if (rule.prepaidAdjustment) paymentMode.FULL = { adjustmentType: 'FIXED_NIGHTLY_ADJUSTMENT', value: -Math.abs(Number(rule.prepaidAdjustment)) }; if (rule.partialPaymentAdjustment) paymentMode.DEPOSIT = { adjustmentType: 'FIXED_NIGHTLY_ADJUSTMENT', value: -Math.abs(Number(rule.partialPaymentAdjustment)) }; if (Object.keys(paymentMode).length) factors.paymentMode = paymentMode; return { roomTypeId: room.id, ...(propertyDefault ? { sourceRatePlanId } : {}), amount: Number(rule.amount), currency, minAdults: Number(rule.minAdults), maxAdults: numberValue(rule.maxAdults, true), minChildren: Number(rule.minChildren), maxChildren: numberValue(rule.maxChildren, true), minOccupancy: Number(rule.minOccupancy), maxOccupancy: numberValue(rule.maxOccupancy, true), minStay: Number(rule.minStay), maxStay: numberValue(rule.maxStay, true), minRooms: Number(rule.minRooms), maxRooms: numberValue(rule.maxRooms, true), minLeadTimeHours: 0, maxAdvanceDays: null, pricingFactors: Object.keys(factors).length ? factors : null, weekdays: [], blackoutDates: [] }; }),
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
        <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300"><ShieldCheck className="h-5 w-5" /></div><div><DialogTitle className="text-lg text-white">{propertyDefault ? 'Property default Corporate API contract' : 'Corporate API contract rate'}</DialogTitle><DialogDescription className="mt-1 text-xs text-slate-400">{propertyDefault ? `Create the default Corporate API contract for ${accountName}. Account-specific negotiated contracts take priority.` : `Create a draft negotiated contract for ${accountName}. This does not change the PMS walk-in rate plan.`}</DialogDescription></div></div>
      </DialogHeader>
      <form onSubmit={submit} className="max-h-[calc(100vh-190px)] space-y-5 overflow-y-auto px-6 py-5 lg:px-10">
        <div className="grid gap-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[.03] p-4 sm:grid-cols-2">
          <div className="space-y-2"><Label className="text-xs text-slate-300">Contract name *</Label><Input className={inputClass} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. 2027 corporate accommodation agreement" /></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Contract reference *</Label><Input className={`${inputClass} font-mono uppercase`} value={reference} onChange={event => setReference(event.target.value)} placeholder="e.g. ACME-2027" /></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Currency</Label><select className={`h-10 w-full rounded-md ${inputClass}`} value={currency} onChange={event => setCurrency(event.target.value)}><option value="NGN">NGN</option><option value="USD">USD</option></select></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Payment mode</Label><select className={`h-10 w-full rounded-md ${inputClass}`} value={paymentMode} onChange={event => setPaymentMode(event.target.value)}><option value="PAY_LATER">Pay later — requires approval</option><option value="DEPOSIT">Partial prepayment</option><option value="FULL">Full prepayment</option><option value="PREPAID">Prepaid</option></select></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Effective from *</Label><Input type="date" className={inputClass} value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} /></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Effective to</Label><Input type="date" className={inputClass} value={effectiveTo} onChange={event => setEffectiveTo(event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={negotiationEnabled} onChange={event => setNegotiationEnabled(event.target.checked)} /> Show “Request negotiated rate” only for eligible stays</label><div className="grid gap-3 sm:grid-cols-3"><div><Label className="text-[11px] text-slate-400">Minimum rooms</Label><Input type="number" min="1" className={inputClass} value={negotiationMinRooms} onChange={event => setNegotiationMinRooms(event.target.value)} placeholder="e.g. 10" /></div><div><Label className="text-[11px] text-slate-400">Minimum stay nights</Label><Input type="number" min="1" className={inputClass} value={negotiationMinNights} onChange={event => setNegotiationMinNights(event.target.value)} placeholder="e.g. 3" /></div></div><p className="text-[11px] text-slate-500">The default Corporate API rate remains active. The negotiation action is offered only when the stay meets the configured room and night minimums.</p></div>
          {propertyDefault && <div className="space-y-2 sm:col-span-2"><Label className="text-xs text-slate-300">PMS corporate rate-plan anchor *</Label><select className={`h-10 w-full rounded-md ${inputClass}`} value={sourceRatePlanId} onChange={event => setSourceRatePlanId(event.target.value)}><option value="">Select a corporate rate plan</option>{corporateRatePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.code} · {plan.includeFoodAllocation ? 'Food allocation included' : 'No food allocation'}</option>)}</select><p className="text-[11px] text-slate-500">The default contract keeps its own API prices while inheriting this plan’s accounting and food-allocation policy.</p></div>}
        </div>
        <div><h3 className="text-sm font-semibold text-white">API room-type rates and restrictions</h3><p className="mt-1 text-xs text-slate-500">These rates are separate from the existing PMS rate plan. Tier format: 1-3:2,4-7:5 means 2% for 1–3 and 5% for 4–7.</p></div>
        <div className="overflow-x-auto rounded-xl border border-white/[.08] bg-[#0d1422]"><table className="w-full min-w-[1350px] text-xs"><thead className="bg-white/[.04] text-left text-slate-400"><tr><th className="px-3 py-3">Room type</th><th className="px-3 py-3">API rate</th><th className="px-3 py-3">Min/Max adults</th><th className="px-3 py-3">Min/Max children</th><th className="px-3 py-3">Min/Max guests</th><th className="px-3 py-3">Min/Max nights</th><th className="px-3 py-3">Min/Max rooms</th><th className="px-3 py-3">Factors</th></tr></thead><tbody className="divide-y divide-slate-800">{roomTypes.map(room => { const rule = rules[room.id] || initialRule(); const pair = (min: keyof RuleDraft, max: keyof RuleDraft) => <div className="flex gap-1"><Input type="number" min="0" className={`h-9 w-20 ${inputClass}`} value={rule[min]} onChange={event => updateRule(room.id, min, event.target.value)} placeholder="min" /><Input type="number" min="0" className={`h-9 w-20 ${inputClass}`} value={rule[max]} onChange={event => updateRule(room.id, max, event.target.value)} placeholder="max" /></div>; return <tr key={room.id}><td className="px-3 py-3 font-medium text-slate-200">{room.name}<div className="text-[10px] text-slate-500">Base: {Number(room.baseRate).toLocaleString()}</div></td><td className="px-3 py-3"><Input type="number" min="0" step="0.01" className={`h-9 w-28 ${inputClass}`} value={rule.amount} onChange={event => updateRule(room.id, 'amount', event.target.value)} placeholder="Not covered" /></td><td className="px-3 py-3">{pair('minAdults', 'maxAdults')}</td><td className="px-3 py-3">{pair('minChildren', 'maxChildren')}</td><td className="px-3 py-3">{pair('minOccupancy', 'maxOccupancy')}</td><td className="px-3 py-3">{pair('minStay', 'maxStay')}</td><td className="px-3 py-3">{pair('minRooms', 'maxRooms')}</td><td className="space-y-1 px-3 py-3"><Input type="number" min="0" max="100" step="0.01" className={`h-8 w-28 ${inputClass}`} value={rule.stayDiscountTiers} onChange={event => updateRule(room.id, 'stayDiscountTiers', event.target.value)} placeholder="Nights tiers 1-3:2,4-7:5" /><Input type="number" min="0" max="100" step="0.01" className={`h-8 w-28 ${inputClass}`} value={rule.roomDiscountTiers} onChange={event => updateRule(room.id, 'roomDiscountTiers', event.target.value)} placeholder="Room tiers 1-3:2,4-7:5" /><Input type="number" step="0.01" className={`h-8 w-28 ${inputClass}`} value={rule.prepaidAdjustment} onChange={event => updateRule(room.id, 'prepaidAdjustment', event.target.value)} placeholder="Full adj./room/night" /> <Input type="number" step="0.01" className={`h-8 w-28 ${inputClass}`} value={rule.partialPaymentAdjustment} onChange={event => updateRule(room.id, 'partialPaymentAdjustment', event.target.value)} placeholder="Deposit adj./room/night" /></td></tr>})}</tbody></table></div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[.04] p-4 text-xs leading-5 text-amber-100/80">This action creates a <strong>draft</strong> only. It does not activate API pricing, change PMS walk-in rates, authorize payment terms, or change the City Ledger. A property-authorized reviewer must approve and activate the contract version before API or website bookings can use it.</div>
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-5 border-t border-white/[.08] bg-[#0a0f1c] px-6 py-4"><Button type="button" variant="outline" className="border-white/10 bg-white/[.04] text-slate-200" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={submitting || roomTypes.length === 0} className="bg-cyan-600 text-white hover:bg-cyan-500">{submitting ? 'Saving draft...' : 'Save API contract draft'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
