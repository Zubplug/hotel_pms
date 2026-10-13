'use client';

import { useEffect, useState } from 'react';
import { Receipt, WalletCards } from 'lucide-react';

export default function EmployeePayPage() {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/hr/self-service/payroll').then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error); setData(json); }).catch((cause) => setError(cause.message || 'Unable to load payroll history')); }, []);
  if (error) return <main className="p-8 text-sm text-rose-300">{error}</main>;
  if (!data) return <main className="p-8 text-sm text-slate-400">Loading payroll history…</main>;
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <div><div className="flex items-center gap-3"><WalletCards className="h-6 w-6 text-teal-300" /><h1 className="text-xl font-bold text-white">My pay</h1></div><p className="mt-1 text-xs text-slate-400">Finalized payroll results and verified payment status.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{[['Gross earnings', data.yearToDate.gross], ['Deductions', data.yearToDate.deductions], ['Net pay', data.yearToDate.net]].map(([label, amount]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-[#090e17] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-lg font-bold text-white">₦{Number(amount).toLocaleString()}</p><p className="mt-1 text-[10px] text-slate-500">Loaded payroll history</p></div>)}</div>
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#090e17]"><table className="w-full text-left text-xs text-slate-300"><thead className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase text-slate-500"><tr><th className="p-4">Period</th><th className="p-4">Gross</th><th className="p-4">Deductions</th><th className="p-4">Net</th><th className="p-4">Payment</th><th className="p-4">Breakdown</th></tr></thead><tbody className="divide-y divide-slate-800">{data.payslips.map((payslip: any) => <tr key={payslip.id}><td className="p-4 font-semibold text-white">{payslip.period}</td><td className="p-4">₦{payslip.gross.toLocaleString()}</td><td className="p-4 text-amber-300">₦{payslip.deductions.toLocaleString()}</td><td className="p-4 font-semibold text-emerald-300">₦{payslip.net.toLocaleString()}</td><td className="p-4">{payslip.paymentStatus}{payslip.paymentDate ? <span className="mt-1 block text-[10px] text-slate-500">{new Date(payslip.paymentDate).toLocaleDateString()}</span> : null}</td><td className="p-4"><details><summary className="cursor-pointer text-teal-300">View</summary><div className="mt-2 space-y-1">{payslip.components.map((component: any, index: number) => <div key={`${component.name}-${index}`} className="flex justify-between gap-4"><span>{component.name}</span><span>₦{component.amount.toLocaleString()}</span></div>)}</div></details></td></tr>)}</tbody></table>{!data.payslips.length && <p className="p-8 text-center text-xs text-slate-500">No finalized payslips are available.</p>}</div>
  </main>;
}
