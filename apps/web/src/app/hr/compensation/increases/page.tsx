'use client';

import { useEffect, useState, type FormEvent } from 'react';

const money = (value: unknown) => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

export default function CompensationIncreasesPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [permissions, setPermissions] = useState({ canManage: false, canApprove: false });
  const [form, setForm] = useState({ staffId: '', proposedBasicSalary: '', proposedHousingAllowance: '', proposedTransportAllowance: '', proposedOtherAllowances: '', effectiveDate: '', probationReviewDate: '', supportingDocumentUrl: '', reason: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [requestResponse, employeeResponse] = await Promise.all([fetch('/api/hr/compensation/increases'), fetch('/api/hr/employees')]);
    const requestData = await requestResponse.json();
    if (!requestResponse.ok) throw new Error(requestData.error || 'Unable to load compensation requests');
    setRequests(requestData.requests || []);
    setPermissions({ canManage: Boolean(requestData.canManage), canApprove: Boolean(requestData.canApprove) });
    if (employeeResponse.ok) setEmployees((await employeeResponse.json()).employees || []);
  }

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);

  async function createRequest(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const response = await fetch('/api/hr/compensation/increases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Unable to create proposal');
    setForm({ staffId: '', proposedBasicSalary: '', proposedHousingAllowance: '', proposedTransportAllowance: '', proposedOtherAllowances: '', effectiveDate: '', probationReviewDate: '', supportingDocumentUrl: '', reason: '' });
    setMessage('Compensation proposal created and routed for review.'); await load();
  }

  async function action(id: string, actionName: string) {
    const notes = actionName === 'REJECT' ? window.prompt('Reason for rejection:') || '' : actionName === 'APPLY' ? '' : window.prompt('Review notes (optional):') || '';
    const response = await fetch('/api/hr/compensation/increases', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: actionName, notes, reason: notes }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Unable to update request'); else { setMessage('Compensation request updated.'); await load(); }
  }

  return <main className="space-y-6 p-6 text-white">
    <header><h1 className="text-2xl font-bold">Compensation Changes</h1><p className="mt-1 text-sm text-slate-400">Propose, review, approve, schedule, and apply salary changes without rewriting historical payroll.</p></header>
    {error && <p className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</p>}{message && <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-300">{message}</p>}
    {permissions.canManage && <form onSubmit={createRequest} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-3">
      <h2 className="md:col-span-3 text-lg font-semibold">New compensation proposal</h2>
      <select required value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-sm"><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.employeeId || employee.department}</option>)}</select>
      <input required type="number" min="1" step="0.01" placeholder="Proposed basic salary" value={form.proposedBasicSalary} onChange={(e) => setForm({ ...form, proposedBasicSalary: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-sm" />
      <input required type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-sm" />
      <input type="date" placeholder="Review date" value={form.probationReviewDate} onChange={(e) => setForm({ ...form, probationReviewDate: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-sm" />
      <input type="number" min="0" step="0.01" placeholder="Housing allowance" value={form.proposedHousingAllowance} onChange={(e) => setForm({ ...form, proposedHousingAllowance: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-sm" />
      <input type="number" min="0" step="0.01" placeholder="Transport allowance" value={form.proposedTransportAllowance} onChange={(e) => setForm({ ...form, proposedTransportAllowance: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-sm" />
      <input type="number" min="0" step="0.01" placeholder="Other allowances" value={form.proposedOtherAllowances} onChange={(e) => setForm({ ...form, proposedOtherAllowances: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-sm" />
      <input type="url" placeholder="Supporting document URL" value={form.supportingDocumentUrl} onChange={(e) => setForm({ ...form, supportingDocumentUrl: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-sm md:col-span-2" />
      <textarea required minLength={5} placeholder="Business reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="min-h-20 rounded border border-slate-700 bg-slate-900 p-2 text-sm md:col-span-2" /><button className="rounded bg-teal-700 px-4 py-2 text-sm font-medium hover:bg-teal-600">Submit proposal</button>
    </form>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Request register</h2>{requests.map((request) => <article key={request.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex flex-col justify-between gap-3 md:flex-row"><div><h3 className="font-semibold">{request.staff?.firstName} {request.staff?.lastName} <span className="ml-2 rounded bg-slate-800 px-2 py-1 text-xs text-teal-300">{request.status}</span></h3><p className="mt-1 text-xs text-slate-400">{request.staff?.department} · Effective {new Date(request.effectiveDate).toLocaleDateString('en-NG')} · {request.reason}</p></div><div className="text-right text-sm"><p>{money(request.currentBasicSalary)} → <span className="font-semibold text-emerald-300">{money(request.proposedBasicSalary)}</span></p><p className="text-xs text-slate-500">Total change: {Number(request.increasePercentage || 0).toFixed(2)}%</p><p className="text-xs text-slate-500">Requested {new Date(request.createdAt).toLocaleDateString('en-NG')}</p></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded bg-slate-900 px-2 py-1">Housing {money(request.currentHousingAllowance)} → {money(request.proposedHousingAllowance)}</span><span className="rounded bg-slate-900 px-2 py-1">Transport {money(request.currentTransportAllowance)} → {money(request.proposedTransportAllowance)}</span>{request.payrollImpact?.budgetWarning && <span className="rounded bg-amber-950/40 px-2 py-1 text-amber-300">{request.payrollImpact.budgetWarning}</span>}{request.supportingDocumentUrl && <a href={request.supportingDocumentUrl} target="_blank" rel="noreferrer" className="rounded bg-slate-900 px-2 py-1 text-teal-300">Supporting document</a>}{request.status === 'DEPARTMENT_REVIEW' && <button onClick={() => void action(request.id, 'DEPARTMENT_APPROVE')} className="rounded bg-sky-700 px-3 py-1.5">Department approve</button>}{['HR_REVIEW', 'SUBMITTED'].includes(request.status) && permissions.canManage && <button onClick={() => void action(request.id, 'HR_APPROVE')} className="rounded bg-indigo-700 px-3 py-1.5">HR validate</button>}{request.status === 'PENDING_APPROVAL' && permissions.canApprove && <button onClick={() => void action(request.id, 'EXECUTIVE_APPROVE')} className="rounded bg-emerald-700 px-3 py-1.5">Executive approve</button>}{['APPROVED', 'SCHEDULED'].includes(request.status) && permissions.canManage && <button onClick={() => void action(request.id, 'APPLY')} className="rounded bg-teal-700 px-3 py-1.5">Apply when due</button>}{!['APPLIED', 'REJECTED', 'CANCELLED'].includes(request.status) && <button onClick={() => void action(request.id, 'REJECT')} className="rounded border border-rose-800 px-3 py-1.5 text-rose-300">Reject</button>}</div></article>)}{requests.length === 0 && <p className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">No compensation changes.</p>}</section>
  </main>;
}
