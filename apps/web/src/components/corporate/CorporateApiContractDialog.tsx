'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

type RoomType = { id: string; name: string; baseRate: number | string; currency?: string };
type RatePlan = { id: string; name: string; code: string; includeFoodAllocation: boolean; rates?: { amount: number | string; currency?: string; roomType?: { id: string } }[] };
type RuleDraft = { amount: string; minAdults: string; maxAdults: string; minChildren: string; maxChildren: string; minOccupancy: string; maxOccupancy: string; minStay: string; maxStay: string; minRooms: string; maxRooms: string; longStayDiscount: string; multiRoomDiscount: string; prepaidAdjustment: string; partialPaymentAdjustment: string; roomDiscountTiers: string; stayDiscountTiers: string };
type DiscountTier = { minRooms?: number; maxRooms?: number | null; minNights?: number; maxNights?: number | null; adjustmentType: string; value: number };

const inputClass = 'border-white/10 bg-white/[.045] text-slate-100 placeholder:text-slate-600';
function generateContractReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CORP-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}
const initialRule = (propertyDefault = false): RuleDraft => ({ amount: '', minAdults: '1', maxAdults: '2', minChildren: '0', maxChildren: '0', minOccupancy: '1', maxOccupancy: '2', minStay: '1', maxStay: '', minRooms: '1', maxRooms: '', longStayDiscount: '', multiRoomDiscount: '', prepaidAdjustment: propertyDefault ? '2000' : '', partialPaymentAdjustment: '', roomDiscountTiers: propertyDefault ? '1-3:0,4-7:3,8:5' : '', stayDiscountTiers: propertyDefault ? '1-2:0,3-6:2,7:5' : '' });
function parseDiscountTiers(value: string, dimension: 'rooms' | 'nights'): DiscountTier[] { return value.split(',').map(item => item.trim()).filter(Boolean).map(item => { const [range, discount] = item.split(':').map(value => value.trim()); const [min, max] = range.split('-').map(value => Number(value)); return { ...(dimension === 'rooms' ? { minRooms: min, maxRooms: Number.isFinite(max) ? max : null } : { minNights: min, maxNights: Number.isFinite(max) ? max : null }), adjustmentType: 'PERCENT_DISCOUNT', value: Number(discount) }; }).filter(item => Number.isFinite(item.value) && item.value >= 0); }
function estimatedRate(baseRate: number, rule: RuleDraft, paymentMode: string) { let amount = Number.isFinite(baseRate) ? baseRate : 0; const stay = parseDiscountTiers(rule.stayDiscountTiers, 'nights').find(item => item.minNights <= 1 && (item.maxNights == null || item.maxNights >= 1)); const rooms = parseDiscountTiers(rule.roomDiscountTiers, 'rooms').find(item => item.minRooms <= 1 && (item.maxRooms == null || item.maxRooms >= 1)); for (const adjustment of [stay, rooms]) if (adjustment) amount *= 1 - adjustment.value / 100; if (paymentMode === 'FULL' && rule.prepaidAdjustment) amount -= Math.abs(Number(rule.prepaidAdjustment)); if (paymentMode === 'DEPOSIT' && rule.partialPaymentAdjustment) amount -= Math.abs(Number(rule.partialPaymentAdjustment)); return Math.max(0, Math.round(amount * 100) / 100); }
function FactorEditor({ roomTypeId, rule, updateRule }: { roomTypeId: string; rule: RuleDraft; updateRule: (roomTypeId: string, field: keyof RuleDraft, value: string) => void }) { const field = (name: keyof RuleDraft, label: string, hint: string, placeholder: string, type: 'text' | 'number' = 'text') => <label className="rounded-lg border border-white/[.08] bg-black/10 p-2"><span className="mb-1 flex items-center justify-between gap-2 text-[10px] font-medium text-slate-300"><span>{label}</span><span className="text-right text-slate-600">{hint}</span></span><Input type={type} step={type === 'number' ? '0.01' : undefined} className={`h-8 w-full ${inputClass}`} value={rule[name]} onChange={event => updateRule(roomTypeId, name, event.target.value)} placeholder={placeholder} /></label>; return <div className="min-w-[360px] rounded-xl border border-cyan-400/15 bg-cyan-400/[.035] p-3"><div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-cyan-200">Pricing factors</p><p className="mt-0.5 text-[10px] text-slate-500">Adjust the rate for this room type</p></div><span className="rounded-full border border-white/10 bg-white/[.04] px-2 py-1 text-[10px] text-slate-500">Optional</span></div><div className="grid grid-cols-2 gap-2">{field('stayDiscountTiers', 'Stay discounts', 'nights · %', '1-2:0, 3-6:2, 7:5')}{field('roomDiscountTiers', 'Room discounts', 'rooms · %', '1-3:0, 4-7:3, 8:5')}{field('prepaidAdjustment', 'Full payment', 'discount / night', 'e.g. 2,000', 'number')}{field('partialPaymentAdjustment', 'Deposit payment', 'discount / night', 'e.g. 1,000', 'number')}</div><p className="mt-2 text-[10px] leading-4 text-slate-500">Example: <span className="text-slate-400">3-6:2</span> applies a 2% discount to stays of 3–6 nights.</p></div>; }

export function CorporateApiContractDialog({ open, onOpenChange, accountId, propertyId, accountName, propertyDefault = false }: { open: boolean; onOpenChange: (open: boolean) => void; accountId?: string; propertyId: string; accountName: string; propertyDefault?: boolean }) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rules, setRules] = useState<Record<string, RuleDraft>>({});
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [paymentMode, setPaymentMode] = useState('PAY_LATER');
  const [negotiationEnabled, setNegotiationEnabled] = useState(propertyDefault);
  const [negotiationMinRooms, setNegotiationMinRooms] = useState(propertyDefault ? '10' : '');
  const [negotiationMinNights, setNegotiationMinNights] = useState(propertyDefault ? '3' : '');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [sourceRatePlanId, setSourceRatePlanId] = useState('');
  const [foodAllocationEnabled, setFoodAllocationEnabled] = useState(false);
  const [corporateRatePlans, setCorporateRatePlans] = useState<RatePlan[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReference(current => current || generateContractReference());
    fetch(`/api/v1/room-types?propertyId=${encodeURIComponent(propertyId)}`)
      .then(response => response.json())
      .then(json => {
        const rooms = (json.data || []).filter((room: RoomType) => room.id && room.name);
        setRoomTypes(rooms);
        setRules(current => Object.fromEntries(rooms.map((room: RoomType) => [room.id, current[room.id] || initialRule(propertyDefault)])));
      })
      .catch(() => toast.error('Unable to load active room types'));
    fetch(`/api/v1/rate-plans?propertyId=${encodeURIComponent(propertyId)}&type=${propertyDefault ? 'STANDARD' : 'CORPORATE'}&includeRates=true`)
      .then(response => response.json())
      .then(json => {
        const plans = json.data || [];
        setCorporateRatePlans(plans);
        if (!sourceRatePlanId && plans[0]?.id) { setSourceRatePlanId(plans[0].id); setFoodAllocationEnabled(Boolean(plans[0].includeFoodAllocation)); }
      })
      .catch(() => toast.error('Unable to load corporate rate plans'));
  }, [open, propertyId, sourceRatePlanId]);

  const includedRooms = useMemo(() => propertyDefault ? roomTypes : roomTypes.filter((room: RoomType) => rules[room.id]?.amount), [propertyDefault, roomTypes, rules]);
  const updateRule = (roomTypeId: string, field: keyof RuleDraft, value: string) => setRules(current => ({ ...current, [roomTypeId]: { ...(current[roomTypeId] || initialRule()), [field]: value } }));
  const numberValue = (value: string, nullable = false) => value === '' && nullable ? null : Number(value);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error('Contract name is required');
    const contractReference = reference.trim() || generateContractReference();
    if (includedRooms.length === 0) return toast.error('Add at least one room-type API rate');
    if (propertyDefault && !sourceRatePlanId) return toast.error('Select the PMS corporate rate plan used for this property default');
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/corporate-contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(propertyDefault ? { isPropertyDefault: true } : { corporateAccountId: accountId }), propertyId, name: name.trim(), reference: contractReference.toUpperCase(), defaultCurrency: currency, paymentMode,
          effectiveFrom, effectiveTo: null, negotiationEnabled, negotiationMinRooms: negotiationMinRooms ? Number(negotiationMinRooms) : null, negotiationMinNights: negotiationMinNights ? Number(negotiationMinNights) : null,
          rules: includedRooms.map(room => { const rule = rules[room.id]; const factors: Record<string, unknown> = {}; const stayTiers = parseDiscountTiers(rule.stayDiscountTiers, 'nights'); const roomTiers = parseDiscountTiers(rule.roomDiscountTiers, 'rooms'); if (stayTiers.length) factors.stayLength = stayTiers; else if (rule.longStayDiscount) factors.stayLength = [{ minNights: Number(rule.minStay), maxNights: numberValue(rule.maxStay, true), adjustmentType: 'PERCENT_DISCOUNT', value: Number(rule.longStayDiscount) }]; if (roomTiers.length) factors.roomCount = roomTiers; else if (rule.multiRoomDiscount) factors.roomCount = [{ minRooms: Number(rule.minRooms), maxRooms: numberValue(rule.maxRooms, true), adjustmentType: 'PERCENT_DISCOUNT', value: Number(rule.multiRoomDiscount) }]; const paymentMode: Record<string, unknown> = {}; if (rule.prepaidAdjustment) paymentMode.FULL = { adjustmentType: 'FIXED_NIGHTLY_ADJUSTMENT', value: -Math.abs(Number(rule.prepaidAdjustment)) }; if (rule.partialPaymentAdjustment) paymentMode.DEPOSIT = { adjustmentType: 'FIXED_NIGHTLY_ADJUSTMENT', value: -Math.abs(Number(rule.partialPaymentAdjustment)) }; if (Object.keys(paymentMode).length) factors.paymentMode = paymentMode; if (propertyDefault) factors.foodAllocation = foodAllocationEnabled; return { roomTypeId: room.id, ...(propertyDefault ? { sourceRatePlanId } : {}), amount: propertyDefault ? null : Number(rule.amount), currency, minAdults: Number(rule.minAdults), maxAdults: numberValue(rule.maxAdults, true), minChildren: Number(rule.minChildren), maxChildren: numberValue(rule.maxChildren, true), minOccupancy: Number(rule.minOccupancy), maxOccupancy: numberValue(rule.maxOccupancy, true), minStay: Number(rule.minStay), maxStay: numberValue(rule.maxStay, true), minRooms: Number(rule.minRooms), maxRooms: numberValue(rule.maxRooms, true), minLeadTimeHours: 0, maxAdvanceDays: null, pricingFactors: Object.keys(factors).length ? factors : null, weekdays: [], blackoutDates: [] }; }),
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
          <div className="space-y-2"><Label className="text-xs text-slate-300">Auto-generated contract reference</Label><Input className={`${inputClass} font-mono uppercase opacity-80`} value={reference} readOnly aria-readonly="true" /><p className="text-[11px] text-slate-500">This reference is generated automatically and cannot be edited.</p></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Currency</Label><select className={`h-10 w-full rounded-md ${inputClass}`} value={currency} onChange={event => setCurrency(event.target.value)}><option value="NGN">NGN</option><option value="USD">USD</option></select></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Default payment mode</Label><select className={`h-10 w-full rounded-md ${inputClass}`} value={paymentMode} onChange={event => setPaymentMode(event.target.value)}><option value="PAY_LATER">Pay later — requires approval</option><option value="DEPOSIT">Partial prepayment</option><option value="FULL">Full prepayment</option><option value="PREPAID">Prepaid</option></select><p className="text-[11px] text-slate-500">Corporate users may choose any supported payment mode when requesting availability and making each reservation.</p></div>
          <div className="space-y-2"><Label className="text-xs text-slate-300">Effective from *</Label><Input type="date" className={inputClass} value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={negotiationEnabled} onChange={event => setNegotiationEnabled(event.target.checked)} /> Show “Request negotiated rate” only for eligible stays</label><div className="grid gap-3 sm:grid-cols-3"><div><Label className="text-[11px] text-slate-400">Minimum rooms</Label><Input type="number" min="1" className={inputClass} value={negotiationMinRooms} onChange={event => setNegotiationMinRooms(event.target.value)} placeholder="e.g. 10" /></div><div><Label className="text-[11px] text-slate-400">Minimum stay nights</Label><Input type="number" min="1" className={inputClass} value={negotiationMinNights} onChange={event => setNegotiationMinNights(event.target.value)} placeholder="e.g. 3" /></div></div><p className="text-[11px] text-slate-500">The default Corporate API rate remains active. The negotiation action is offered only when the stay meets the configured room and night minimums.</p></div>
          {propertyDefault && <div className="space-y-3 sm:col-span-2"><div><Label className="text-xs text-slate-300">PMS normal rate-plan anchor *</Label><select className={`h-10 w-full rounded-md ${inputClass}`} value={sourceRatePlanId} onChange={event => { const plan = corporateRatePlans.find(item => item.id === event.target.value); setSourceRatePlanId(event.target.value); setFoodAllocationEnabled(Boolean(plan?.includeFoodAllocation)); }}><option value="">Select a normal PMS rate plan</option>{corporateRatePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.code} · {plan.includeFoodAllocation ? 'Food allocation included' : 'No food allocation'}</option>)}</select><p className="text-[11px] text-slate-500">The default contract derives its base room rates from this normal PMS plan, then applies the configured corporate adjustments.</p></div><label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/[.03] p-3 text-xs text-slate-300"><input type="checkbox" checked={foodAllocationEnabled} onChange={event => setFoodAllocationEnabled(event.target.checked)} /><span><strong className="block text-slate-100">Include food allocation</strong><span className="text-slate-500">Enable or disable the complimentary food allocation for this Corporate API default.</span></span></label></div>}
        </div>
        <div><h3 className="text-sm font-semibold text-white">API room-type adjustments and restrictions</h3><p className="mt-1 text-xs text-slate-500">These adjustments are applied to the selected PMS normal rate plan. Tier format: 1-3:2,4-7:5 means 2% for 1–3 and 5% for 4–7.</p></div>
        <div className="overflow-x-auto rounded-xl border border-white/[.08] bg-[#0d1422]"><table className="w-full min-w-[1500px] text-xs"><thead className="bg-white/[.04] text-left text-slate-400"><tr><th className="px-3 py-3">Room type</th><th className="px-3 py-3">API rate</th><th className="px-3 py-3">Estimated rate</th><th className="px-3 py-3">Min/Max adults</th><th className="px-3 py-3">Min/Max children</th><th className="px-3 py-3">Min/Max guests</th><th className="px-3 py-3">Min/Max nights</th><th className="px-3 py-3">Min/Max rooms</th><th className="px-3 py-3">Factors</th></tr></thead><tbody className="divide-y divide-slate-800">{roomTypes.map(room => { const rule = rules[room.id] || initialRule(propertyDefault); const selectedPlan = corporateRatePlans.find(plan => plan.id === sourceRatePlanId); const planRate = selectedPlan?.rates?.find(rate => rate.roomType?.id === room.id); const baseRate = propertyDefault ? Number(planRate?.amount ?? room.baseRate) : Number(rule.amount); const estimate = estimatedRate(baseRate, rule, paymentMode); const pair = (min: keyof RuleDraft, max: keyof RuleDraft) => <div className="flex gap-1"><Input type="number" min="0" className={`h-9 w-20 ${inputClass}`} value={rule[min]} onChange={event => updateRule(room.id, min, event.target.value)} placeholder="min" /><Input type="number" min="0" className={`h-9 w-20 ${inputClass}`} value={rule[max]} onChange={event => updateRule(room.id, max, event.target.value)} placeholder="max" /></div>; return <tr key={room.id}><td className="px-3 py-3 font-medium text-slate-200">{room.name}<div className="text-[10px] text-slate-500">Base: {Number(baseRate).toLocaleString()} {currency}</div></td><td className="px-3 py-3"><Input type="number" min="0" step="0.01" className={`h-9 w-28 ${inputClass}`} value={rule.amount} onChange={event => updateRule(room.id, 'amount', event.target.value)} placeholder={propertyDefault ? "Uses PMS rate" : "API rate"} disabled={propertyDefault} /></td><td className="px-3 py-3"><strong className="text-cyan-300">{currency} {estimate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><div className="text-[10px] text-slate-500">1 night · 1 room · {paymentMode.replace('_', ' ').toLowerCase()}</div></td><td className="px-3 py-3">{pair('minAdults', 'maxAdults')}</td><td className="px-3 py-3">{pair('minChildren', 'maxChildren')}</td><td className="px-3 py-3">{pair('minOccupancy', 'maxOccupancy')}</td><td className="px-3 py-3">{pair('minStay', 'maxStay')}</td><td className="px-3 py-3">{pair('minRooms', 'maxRooms')}</td><td className="px-3 py-3 align-top"><FactorEditor roomTypeId={room.id} rule={rule} updateRule={updateRule} /></td></tr>})}</tbody></table></div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[.04] p-4 text-xs leading-5 text-amber-100/80">This action creates a <strong>draft</strong> only. It does not activate API pricing, change PMS walk-in rates, authorize payment terms, or change the City Ledger. A property-authorized reviewer must approve and activate the contract version before API or website bookings can use it.</div>
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-5 border-t border-white/[.08] bg-[#0a0f1c] px-6 py-4"><Button type="button" variant="outline" className="border-white/10 bg-white/[.04] text-slate-200" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={submitting || roomTypes.length === 0} className="bg-cyan-600 text-white hover:bg-cyan-500">{submitting ? 'Saving draft...' : 'Save API contract draft'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
