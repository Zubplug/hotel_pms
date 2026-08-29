'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ReceiptText, Power } from 'lucide-react';

type Property = { id: string; name: string };
type Category = { id: string; propertyId: string; code: string; name: string; debitAccount: string; isActive: boolean };
type CostCenter = { id: string; propertyId: string; code: string; name: string; isActive: boolean };

export function ExpenseConfigurationSettings({ properties, categories: initialCategories, costCenters: initialCostCenters }: { properties: Property[]; categories: Category[]; costCenters: CostCenter[] }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [categories, setCategories] = useState(initialCategories);
  const [costCenters, setCostCenters] = useState(initialCostCenters);
  const [categoryForm, setCategoryForm] = useState({ code: '', name: '', debitAccount: '' });
  const [costCenterForm, setCostCenterForm] = useState({ code: '', name: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const visibleCategories = useMemo(() => categories.filter(item => item.propertyId === propertyId), [categories, propertyId]);
  const visibleCostCenters = useMemo(() => costCenters.filter(item => item.propertyId === propertyId), [costCenters, propertyId]);

  const create = async (type: 'CATEGORY' | 'COST_CENTER') => {
    setBusy(true); setMessage('');
    const payload = type === 'CATEGORY' ? { propertyId, type, ...categoryForm } : { propertyId, type, ...costCenterForm };
    try {
      const response = await fetch('/api/v1/financial-control/expense-configuration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save configuration');
      if (type === 'CATEGORY') { setCategories(items => [...items, body.data]); setCategoryForm({ code: '', name: '', debitAccount: '' }); } else { setCostCenters(items => [...items, body.data]); setCostCenterForm({ code: '', name: '' }); }
      setMessage(`${type === 'CATEGORY' ? 'Expense category' : 'Cost centre'} added successfully.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save configuration'); } finally { setBusy(false); }
  };

  const toggle = async (id: string, active: boolean, type: 'CATEGORY' | 'COST_CENTER') => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/financial-control/expense-configuration/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: active }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update configuration');
      if (type === 'CATEGORY') setCategories(items => items.map(item => item.id === id ? { ...item, isActive: active } : item)); else setCostCenters(items => items.map(item => item.id === id ? { ...item, isActive: active } : item));
      setMessage('Configuration status updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update configuration'); } finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-7xl space-y-6 p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><ReceiptText className="h-5 w-5" /></div><div><h1 className="text-3xl font-bold tracking-tight">Expense Configuration</h1><p className="mt-1 text-sm text-muted-foreground">Accountants and super admins define the controlled expense categories and cost centres available to cashiers.</p></div></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="text-sm font-semibold text-slate-700" htmlFor="expense-property">Property</label><select id="expense-property" value={propertyId} onChange={event => setPropertyId(event.target.value)} className="mt-2 h-10 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm">{properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div>{message && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</div>}<div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Expense categories</h2><p className="mt-1 text-xs text-slate-500">Each category maps to the debit account used in the future general ledger.</p></div><div className="space-y-2 p-5">{visibleCategories.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-semibold">{item.name} <span className="font-mono text-xs text-slate-400">{item.code}</span></p><p className="text-xs text-slate-500">Debit: {item.debitAccount}</p></div><Button size="sm" variant="outline" disabled={busy} onClick={() => toggle(item.id, !item.isActive, 'CATEGORY')}><Power className="mr-1 h-3.5 w-3.5" />{item.isActive ? 'Deactivate' : 'Activate'}</Button></div>)}<div className="grid gap-2 border-t pt-4 sm:grid-cols-3"><Input placeholder="Code" value={categoryForm.code} onChange={event => setCategoryForm({ ...categoryForm, code: event.target.value })} /><Input placeholder="Name" value={categoryForm.name} onChange={event => setCategoryForm({ ...categoryForm, name: event.target.value })} /><Input placeholder="Debit account" value={categoryForm.debitAccount} onChange={event => setCategoryForm({ ...categoryForm, debitAccount: event.target.value })} /><Button className="sm:col-span-3" disabled={busy || !propertyId} onClick={() => create('CATEGORY')}>Add expense category</Button></div></div></section><section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Cost centres</h2><p className="mt-1 text-xs text-slate-500">Assign expenses to departments such as Rooms, F&amp;B, or Administration.</p></div><div className="space-y-2 p-5">{visibleCostCenters.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-semibold">{item.name} <span className="font-mono text-xs text-slate-400">{item.code}</span></p></div><Button size="sm" variant="outline" disabled={busy} onClick={() => toggle(item.id, !item.isActive, 'COST_CENTER')}><Power className="mr-1 h-3.5 w-3.5" />{item.isActive ? 'Deactivate' : 'Activate'}</Button></div>)}<div className="grid gap-2 border-t pt-4 sm:grid-cols-2"><Input placeholder="Code" value={costCenterForm.code} onChange={event => setCostCenterForm({ ...costCenterForm, code: event.target.value })} /><Input placeholder="Name" value={costCenterForm.name} onChange={event => setCostCenterForm({ ...costCenterForm, name: event.target.value })} /><Button className="sm:col-span-2" disabled={busy || !propertyId} onClick={() => create('COST_CENTER')}>Add cost centre</Button></div></div></section></div></div>;
}
