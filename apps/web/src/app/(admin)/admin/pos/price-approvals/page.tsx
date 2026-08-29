'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function PriceApprovalsPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const role = String((session?.user as any)?.role || '').toUpperCase();
  const load = async () => { const response = await fetch('/api/v1/pos/price-approvals'); const body = await response.json(); if (response.ok) setRequests(body.data || []); else setMessage(body.error || 'Unable to load requests'); };
  useEffect(() => { void load(); }, []);
  const accountant = ['ACCOUNTANT', 'FINANCE_MANAGER'].includes(role);
  const manager = ['MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'].includes(role);
  const act = async (id: string, action: 'accountant' | 'manager') => { const url = action === 'accountant' ? `/api/v1/pos/price-approvals/${id}/accountant` : `/api/manager/approvals/${id}/approve`; const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); const body = await response.json(); setMessage(body.error || (response.ok ? 'Approval recorded' : 'Approval failed')); if (response.ok) await load(); };
  return <main className="max-w-5xl space-y-6 p-6"><div><h1 className="text-2xl font-bold">Selling Price Approvals</h1><p className="text-sm text-slate-500">Cashier requests require Accountant review, then Manager approval before the new price goes live.</p></div>{message && <div className="rounded border bg-slate-50 p-3 text-sm">{message}</div>}<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50"><tr><th className="p-3">Product</th><th className="p-3">Current</th><th className="p-3">Requested</th><th className="p-3">Stage</th><th className="p-3">Action</th></tr></thead><tbody>{requests.map((request) => { const details = request.details || {}; const stage = details.stage || 'ACCOUNTANT_REVIEW'; return <tr key={request.id} className="border-b"><td className="p-3">{details.productName}</td><td className="p-3">₦{Number(details.oldPrice || 0).toLocaleString()}</td><td className="p-3">₦{Number(details.newPrice || 0).toLocaleString()}</td><td className="p-3">{stage.replace(/_/g, ' ')}</td><td className="p-3">{stage === 'ACCOUNTANT_REVIEW' && accountant && <button onClick={() => act(request.id, 'accountant')} className="font-semibold text-indigo-700">Approve as Accountant</button>}{stage === 'MANAGER_REVIEW' && manager && <button onClick={() => act(request.id, 'manager')} className="font-semibold text-emerald-700">Approve &amp; Go Live</button>}</td></tr>; })}</tbody></table>{requests.length === 0 && <p className="p-8 text-center text-slate-500">No pending price requests.</p>}</div></main>;
}
