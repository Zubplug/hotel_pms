'use client';

import { useEffect, useState } from 'react';

export default function HrRemittancesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => fetch('/api/hr/remittances').then((r) => r.json()).then((d) => setRows(d.remittances || []));
  useEffect(() => { void load(); }, []);
  async function update(id: string, status: string) { const response = await fetch('/api/hr/remittances', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) }); if (!response.ok) alert((await response.json()).error || 'Unable to update remittance'); else load(); }
  return <main className="p-6 max-w-6xl mx-auto space-y-6 text-white"><div><h1 className="text-2xl font-bold">Statutory Remittances</h1><p className="text-sm text-slate-400">Record and approve PAYE, pension, NHF, NSITF, and ITF remittance evidence.</p></div><div className="overflow-auto rounded-xl border border-slate-800"><table className="w-full text-sm"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-3 text-left">Type</th><th className="p-3 text-left">Period</th><th className="p-3 text-right">Remitted</th><th className="p-3 text-left">Reference</th><th className="p-3 text-left">Status</th><th className="p-3"/></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-800"><td className="p-3">{row.taxType}</td><td className="p-3">{new Date(row.periodStart).toLocaleDateString()} – {new Date(row.periodEnd).toLocaleDateString()}</td><td className="p-3 text-right">₦{Number(row.remittedAmount).toLocaleString('en-NG')}</td><td className="p-3">{row.remittanceRef || '—'}</td><td className="p-3">{row.status}</td><td className="p-3">{row.status === 'DRAFT' && <button onClick={() => update(row.id, 'SUBMITTED')} className="text-teal-400">Submit</button>}{row.status === 'SUBMITTED' && <button onClick={() => update(row.id, 'APPROVED')} className="text-teal-400">Approve</button>}{row.status === 'APPROVED' && <button onClick={() => update(row.id, 'REMITTED')} className="text-teal-400">Mark remitted</button>}</td></tr>)}</tbody></table></div></main>;
}
