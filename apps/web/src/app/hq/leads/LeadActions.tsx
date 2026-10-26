'use client';

import { useState } from 'react';

export type LeadConversionData = {
  id: string;
  status: string;
  name: string;
  email: string;
  phone: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  company: string | null;
  organizationName?: string | null;
  propertyName: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  website?: string | null;
  location: string | null;
  roomCount: number | null;
};

const inputClass = 'w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/10';
const labelClass = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500';

export function LeadActions({ lead }: { lead: LeadConversionData }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [form, setForm] = useState(() => ({
    organizationName: lead.organizationName || lead.company || lead.propertyName || `${lead.name}'s organization`,
    organizationSlug: '',
    defaultCurrency: 'NGN',
    defaultTimezone: 'Africa/Lagos',
    propertyName: lead.propertyName || lead.company || lead.organizationName || '',
    address: lead.address || '',
    city: lead.city || lead.location || '',
    state: lead.state || '',
    country: lead.country || 'Nigeria',
    phone: lead.phone || '',
    email: lead.email,
    website: lead.website || '',
    firstName: lead.firstName || lead.name.split(/\s+/)[0] || '',
    middleName: lead.middleName || '',
    lastName: lead.lastName || lead.name.split(/\s+/).slice(1).join(' ') || '',
  }));

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function update(action: 'QUALIFY' | 'CONVERT') {
    setState('working');
    const body = action === 'CONVERT' ? {
      action,
      organizationName: form.organizationName.trim(),
      organization: { name: form.organizationName.trim(), slug: form.organizationSlug.trim() || undefined, defaultCurrency: form.defaultCurrency, defaultTimezone: form.defaultTimezone },
      property: { name: form.propertyName.trim(), address: form.address.trim(), city: form.city.trim(), state: form.state.trim(), country: form.country.trim(), phone: form.phone.trim(), email: form.email.trim(), website: form.website.trim() || null, roomCount: lead.roomCount },
      contact: { firstName: form.firstName.trim(), middleName: form.middleName.trim(), lastName: form.lastName.trim(), email: form.email.trim() },
    } : { action };
    const response = await fetch(`/api/hq/leads/${lead.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setState(response.ok ? 'done' : 'error');
    if (response.ok) window.location.reload();
  }

  if (lead.status === 'CONVERTED') return <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">Invitation sent</span>;

  return <>
    <div className="flex justify-end gap-2">
      {lead.status === 'NEW' && <button onClick={() => update('QUALIFY')} disabled={state === 'working'} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[.06]">Qualify</button>}
      <button onClick={() => setShowConvertModal(true)} disabled={state === 'working'} className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-400">{state === 'working' ? 'Working…' : 'Convert & invite'}</button>
      {state === 'error' && <span className="self-center text-xs text-rose-400">Failed</span>}
    </div>
    {showConvertModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1628] shadow-2xl">
        <div className="border-b border-white/8 px-6 py-5 sm:px-7"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-indigo-300">HQ conversion workspace</p><h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Create customer workspace</h3><p className="mt-1 text-sm leading-6 text-slate-400">Review the lead information before creating the organisation, its first property, owner access and invitation.</p></div>
        <form onSubmit={(event) => { event.preventDefault(); if (form.organizationName.trim() && form.propertyName.trim()) update('CONVERT'); }} className="space-y-6 p-6 sm:p-7">
          <section><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Organisation</p><p className="mt-1 text-xs text-slate-500">Commercial workspace identity and defaults.</p></div><span className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-[10px] text-indigo-200">1 · Workspace</span></div><div className="grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Organisation name</span><input required className={inputClass} value={form.organizationName} onChange={(event) => setField('organizationName', event.target.value)} /></label><label><span className={labelClass}>Workspace slug <span className="normal-case tracking-normal text-slate-600">optional</span></span><input className={inputClass} placeholder="generated automatically" value={form.organizationSlug} onChange={(event) => setField('organizationSlug', event.target.value)} /></label><label><span className={labelClass}>Default currency</span><select className={inputClass} value={form.defaultCurrency} onChange={(event) => setField('defaultCurrency', event.target.value)}><option value="NGN">NGN · Nigerian naira</option><option value="USD">USD · US dollar</option><option value="GBP">GBP · Pound sterling</option><option value="EUR">EUR · Euro</option></select></label><label><span className={labelClass}>Timezone</span><input className={inputClass} value={form.defaultTimezone} onChange={(event) => setField('defaultTimezone', event.target.value)} /></label></div></section>
          <section className="border-t border-white/8 pt-6"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">First property</p><p className="mt-1 text-xs text-slate-500">This is the property created inside the new workspace.</p></div><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] text-cyan-200">2 · Property</span></div><div className="grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Property name</span><input required className={inputClass} value={form.propertyName} onChange={(event) => setField('propertyName', event.target.value)} /></label><label><span className={labelClass}>Property email</span><input type="email" className={inputClass} value={form.email} onChange={(event) => setField('email', event.target.value)} /></label><label className="sm:col-span-2"><span className={labelClass}>Address</span><input className={inputClass} value={form.address} onChange={(event) => setField('address', event.target.value)} /></label><label><span className={labelClass}>City</span><input className={inputClass} value={form.city} onChange={(event) => setField('city', event.target.value)} /></label><label><span className={labelClass}>State</span><input className={inputClass} value={form.state} onChange={(event) => setField('state', event.target.value)} /></label><label><span className={labelClass}>Country</span><input className={inputClass} value={form.country} onChange={(event) => setField('country', event.target.value)} /></label><label><span className={labelClass}>Property phone</span><input className={inputClass} value={form.phone} onChange={(event) => setField('phone', event.target.value)} /></label><label className="sm:col-span-2"><span className={labelClass}>Website <span className="normal-case tracking-normal text-slate-600">optional</span></span><input type="url" className={inputClass} placeholder="https://" value={form.website} onChange={(event) => setField('website', event.target.value)} /></label></div>{lead.roomCount !== null && <p className="mt-3 rounded-lg border border-amber-300/10 bg-amber-300/[.05] px-3 py-2 text-xs text-amber-100">Lead profile includes approximately {lead.roomCount} rooms. The property will be created with this figure retained in onboarding for the implementation team to complete room inventory.</p>}</section>
          <section className="border-t border-white/8 pt-6"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Portal owner</p><p className="mt-1 text-xs text-slate-500">This person receives the secure password setup invitation.</p></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-200">3 · Access</span></div><div className="grid gap-4 sm:grid-cols-3"><label><span className={labelClass}>First name</span><input className={inputClass} value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} /></label><label><span className={labelClass}>Middle name</span><input className={inputClass} value={form.middleName} onChange={(event) => setField('middleName', event.target.value)} /></label><label><span className={labelClass}>Last name</span><input className={inputClass} value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} /></label><label className="sm:col-span-3"><span className={labelClass}>Portal email</span><input required type="email" className={inputClass} value={form.email} onChange={(event) => setField('email', event.target.value)} /></label></div></section>
          <div className="flex justify-end gap-3 border-t border-white/8 pt-5"><button type="button" onClick={() => setShowConvertModal(false)} disabled={state === 'working'} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[.06] hover:text-white">Cancel</button><button type="submit" disabled={state === 'working' || !form.organizationName.trim() || !form.propertyName.trim()} className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-50">{state === 'working' ? 'Creating workspace…' : 'Create & send invitation'}</button></div>
        </form>
      </div>
    </div>}
  </>;
}
