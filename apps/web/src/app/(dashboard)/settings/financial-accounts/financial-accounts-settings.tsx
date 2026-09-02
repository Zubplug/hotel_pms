'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Landmark, Plus, Star, Power, CheckCircle2 } from 'lucide-react';

type Property = { id: string; name: string };
type Account = { id: string; propertyId: string; name: string; bankName?: string | null; accountNumber?: string | null; isDefault: boolean; isActive: boolean; balance: number };

export function FinancialAccountsSettings({ properties, accounts: initialAccounts }: { properties: Property[]; accounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [form, setForm] = useState({ name: '', bankName: '', accountNumber: '', isDefault: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const visibleAccounts = useMemo(() => accounts.filter(account => account.propertyId === propertyId), [accounts, propertyId]);

  const create = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/financial-control/bank-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, ...form }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to create account');
      setAccounts(current => [...current.map(account => form.isDefault && account.propertyId === propertyId ? { ...account, isDefault: false } : account), { ...body.data, balance: Number(body.data.balance) }]);
      setForm({ name: '', bankName: '', accountNumber: '', isDefault: false }); setMessage('Bank account added successfully.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create account'); } finally { setBusy(false); }
  };

  const update = async (id: string, data: { isDefault?: boolean; isActive?: boolean }) => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/financial-control/bank-accounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update account');
      setAccounts(current => current.map(account => data.isDefault ? (account.id === id ? { ...account, isDefault: true } : account.propertyId === propertyId ? { ...account, isDefault: false } : account) : account.id === id ? { ...account, ...data } : account)); setMessage(data.isDefault ? 'Default deposit account updated.' : 'Bank account status updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update account'); } finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8"><div><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Landmark className="h-5 w-5" /></div><div><h1 className="text-3xl font-bold tracking-tight">Property Bank Accounts</h1><p className="mt-1 text-sm text-muted-foreground">Configure the active bank accounts available to General Cashier during deposit submission.</p></div></div></div><div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"><label className="text-sm font-semibold text-slate-700" htmlFor="property">Property</label><select id="property" value={propertyId} onChange={event => setPropertyId(event.target.value)} className="h-9 max-w-md rounded-lg border border-input bg-background px-3 text-sm">{properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div>{message && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</div>}<div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4"><p className="text-sm font-semibold text-slate-800">Configured accounts</p><p className="mt-0.5 text-xs text-slate-500">Only active accounts appear in deposit submission.</p></div>{visibleAccounts.length === 0 ? <div className="px-6 py-16 text-center text-sm text-slate-400">No bank accounts configured for this property.</div> : <div className="divide-y divide-slate-100">{visibleAccounts.map(account => <div key={account.id} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-800">{account.name}</p>{account.isDefault && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Default</span>}</div><p className="mt-1 text-xs text-slate-500">{account.bankName} · {account.accountNumber}</p><p className="mt-1 text-xs text-slate-400">Balance: ₦{account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div><div className="flex shrink-0 items-center gap-2">{!account.isDefault && account.isActive && <Button size="sm" variant="outline" disabled={busy} onClick={() => update(account.id, { isDefault: true })}><Star className="mr-1 h-3.5 w-3.5" />Make default</Button>}{account.isActive ? <Button size="sm" variant="outline" disabled={busy} onClick={() => update(account.id, { isActive: false })}><Power className="mr-1 h-3.5 w-3.5" />Deactivate</Button> : <Button size="sm" variant="outline" disabled={busy} onClick={() => update(account.id, { isActive: true })}>Activate</Button>}</div></div>)}</div>}</div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-semibold text-slate-900">Add bank account</h2><p className="mt-1 text-xs text-slate-500">Use a stable display name that staff can recognize on deposit forms.</p></div><div className="space-y-3"><Input placeholder="Account name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><Input placeholder="Bank name" value={form.bankName} onChange={event => setForm({ ...form, bankName: event.target.value })} /><Input placeholder="Account number" value={form.accountNumber} onChange={event => setForm({ ...form, accountNumber: event.target.value })} /><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isDefault} onChange={event => setForm({ ...form, isDefault: event.target.checked })} /> Set as default deposit account</label><Button className="w-full gap-2" disabled={busy || !propertyId} onClick={create}><Plus className="h-4 w-4" />{busy ? 'Saving…' : 'Add account'}</Button></div></div></div></div>;
}
