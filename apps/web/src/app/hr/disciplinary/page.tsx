'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Employee = { id: string; firstName?: string; lastName?: string };
type RecordItem = { id: string; staffName: string; incidentDate: string; category: string; description: string; actionTaken: string; status: string };

export default function HrDisciplinaryPage() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ staffId: '', incidentDate: new Date().toISOString().slice(0, 10), category: 'VERBAL_WARNING', description: '', actionTaken: '' });

  async function load() {
    setLoading(true);
    try {
      const [recordsResponse, employeesResponse] = await Promise.all([fetch('/api/hr/performance'), fetch('/api/hr/employees?limit=200')]);
      if (recordsResponse.ok) setRecords((await recordsResponse.json()).disciplinaries || []);
      if (employeesResponse.ok) setEmployees((await employeesResponse.json()).employees || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch('/api/hr/performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'CREATE_DISCIPLINARY', ...form }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to create disciplinary record');
      setOpen(false); setForm({ staffId: '', incidentDate: new Date().toISOString().slice(0, 10), category: 'VERBAL_WARNING', description: '', actionTaken: '' }); await load();
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to create disciplinary record'); } finally { setSaving(false); }
  }

  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8"><header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><AlertTriangle className="h-6 w-6 text-amber-400" />Disciplinary Cases</h1><p className="mt-1 text-sm text-slate-400">Manage restricted employee incident and action records.</p></div><Button onClick={() => setOpen((value) => !value)} className="gap-2 bg-amber-600 hover:bg-amber-500"><Plus className="h-4 w-4" />New case</Button></header>{open && <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:grid-cols-3"><select required value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Employee</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select><input required type="date" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option>VERBAL_WARNING</option><option>WRITTEN_WARNING</option><option>SUSPENSION</option><option>INQUIRY</option><option>FINAL_WARNING</option><option>TERMINATION</option></select><textarea required placeholder="Incident description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-24 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white sm:col-span-2" /><input required placeholder="Action taken" value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><div><Button disabled={saving} type="submit" className="bg-amber-600 hover:bg-amber-500">{saving ? 'Saving…' : 'Save case'}</Button></div></form>}<section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"><table className="w-full text-left text-sm"><thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase text-slate-400"><tr><th className="p-4">Employee</th><th className="p-4">Date</th><th className="p-4">Type</th><th className="p-4">Description</th><th className="p-4">Action</th></tr></thead><tbody className="divide-y divide-slate-800">{loading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading disciplinary records…</td></tr> : records.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">No disciplinary records found.</td></tr> : records.map((record) => <tr key={record.id} className="text-slate-300"><td className="p-4 font-medium text-white">{record.staffName}</td><td className="p-4">{new Date(record.incidentDate).toLocaleDateString()}</td><td className="p-4">{record.category}</td><td className="max-w-md p-4">{record.description}</td><td className="p-4">{record.actionTaken}</td></tr>)}</tbody></table></section></main>;
}
