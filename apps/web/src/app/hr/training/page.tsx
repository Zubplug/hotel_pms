'use client';

import { FormEvent, useEffect, useState } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Employee = { id: string; firstName?: string; lastName?: string };
type Training = { id: string; staffName: string; courseName: string; provider?: string; startDate: string; endDate?: string; score: number };

export default function HrTrainingPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ staffId: '', courseName: '', provider: '', startDate: new Date().toISOString().slice(0, 10), score: '', expiresAt: '', certificateUrl: '', isMandatory: false });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [records, staff] = await Promise.all([fetch('/api/hr/performance'), fetch('/api/hr/employees?limit=200')]);
      if (records.ok) setTrainings((await records.json()).trainings || []);
      if (staff.ok) setEmployees((await staff.json()).employees || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch('/api/hr/performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'CREATE_TRAINING', ...form }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to log training');
      setOpen(false); setForm({ staffId: '', courseName: '', provider: '', startDate: new Date().toISOString().slice(0, 10), score: '', expiresAt: '', certificateUrl: '', isMandatory: false }); await load();
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to log training'); } finally { setSaving(false); }
  }

  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8"><header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><GraduationCap className="h-6 w-6 text-teal-400" />Training &amp; Skills</h1><p className="mt-1 text-sm text-slate-400">Maintain staff training, certification, and expiry records.</p></div><Button onClick={() => setOpen((value) => !value)} className="gap-2 bg-teal-600 hover:bg-teal-500"><Plus className="h-4 w-4" />Log training</Button></header>{open && <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:grid-cols-3"><select required value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Employee</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select><input required placeholder="Course title" value={form.courseName} onChange={(e) => setForm({ ...form, courseName: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><input placeholder="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><input min="0" max="100" type="number" placeholder="Score" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><input placeholder="Certificate URL" value={form.certificateUrl} onChange={(e) => setForm({ ...form, certificateUrl: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.isMandatory} onChange={(e) => setForm({ ...form, isMandatory: e.target.checked })} />Mandatory</label><div><Button disabled={saving} type="submit" className="bg-teal-600 hover:bg-teal-500">{saving ? 'Saving…' : 'Save training'}</Button></div></form>}<section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"><table className="w-full text-left text-sm"><thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase text-slate-400"><tr><th className="p-4">Employee</th><th className="p-4">Course</th><th className="p-4">Provider</th><th className="p-4">Completed</th><th className="p-4">Expires</th><th className="p-4">Score</th></tr></thead><tbody className="divide-y divide-slate-800">{loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading training records…</td></tr> : trainings.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No training records found.</td></tr> : trainings.map((training) => <tr key={training.id} className="text-slate-300"><td className="p-4 font-medium text-white">{training.staffName}</td><td className="p-4">{training.courseName}</td><td className="p-4">{training.provider || '—'}</td><td className="p-4">{new Date(training.startDate).toLocaleDateString()}</td><td className="p-4">{training.endDate ? new Date(training.endDate).toLocaleDateString() : '—'}</td><td className="p-4">{training.score ? training.score : '—'}</td></tr>)}</tbody></table></section></main>;
}
