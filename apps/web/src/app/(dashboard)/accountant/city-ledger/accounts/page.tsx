import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Building2, FileText } from 'lucide-react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const money = (value: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const classify = (value: number, type: string) => {
  const isLiability = type === 'REFUND_PAYABLE';
  if (value > .01) return isLiability ? ['CREDIT', 'Owed by property', 'text-emerald-300'] : ['DEBIT', 'Owed to property', 'text-rose-300'];
  if (value < -.01) return isLiability ? ['DEBIT', 'Owed to property', 'text-rose-300'] : ['CREDIT', 'Owed to account', 'text-emerald-300'];
  return ['SETTLED', 'Zero balance', 'text-slate-500'];
};

export default async function CityLedgerAccountsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Fcity-ledger%2Faccounts');
  const propertyId = session.user.propertyId;
  if (!propertyId) return <EmptyState title="No property assigned" />;
  const [property, accounts] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
    prisma.cityLedgerAccount.findMany({ where: { propertyId }, orderBy: { name: 'asc' } }),
  ]);
  const currency = property?.baseCurrency || accounts[0]?.currency || 'NGN';
  return <main className="min-h-screen bg-[#07111f] p-5 text-slate-100 md:p-8"><div className="mx-auto max-w-[1400px] space-y-6"><Link href="/accountant/city-ledger" className="inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200"><ArrowLeft className="h-3.5 w-3.5" />Back to city ledger</Link><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-cyan-300"><Building2 className="h-4 w-4" />Account portfolio</div><h1 className="text-3xl font-semibold text-white">All city-ledger accounts</h1><p className="mt-2 text-sm text-slate-400">Complete account directory for {property?.name || 'this property'}, including AR debit, account credit, hotel liability, and zero-balance accounts.</p></div><section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Classification</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/[.07]">{accounts.map(account => { const amount = Number(account.balance); const isLiability = account.type === 'REFUND_PAYABLE'; const [label, detail, color] = classify(amount, account.type); return <tr key={account.id} className="hover:bg-white/[.025]"><td className="px-5 py-4"><Link href={`/accountant/city-ledger/${account.id}`} className="font-medium text-cyan-300 hover:text-cyan-200">{account.name}</Link><span className="mt-1 block font-mono text-[10px] text-slate-600">{account.id.slice(0, 8)}</span></td><td className="px-5 py-4 text-slate-400">{account.type}</td><td className="px-5 py-4 text-slate-400">{account.status}</td><td className={`px-5 py-4 ${color}`}><span className="font-semibold">{label}</span><span className="ml-2 text-xs text-slate-500">{detail}</span></td><td className="px-5 py-4 text-right font-semibold text-slate-200">{money(Math.abs(amount), account.currency || currency)}{amount > .01 ? (isLiability ? ' CR' : ' DR') : amount < -.01 ? (isLiability ? ' DR' : ' CR') : ''}</td><td className="px-5 py-4 text-right"><Link href={`/accountant/city-ledger/${account.id}`} className="text-xs text-cyan-300 hover:text-cyan-200">Open ledger <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link></td></tr>; })}</tbody></table></div></section></div></main>;
}
function EmptyState({ title }: { title: string }) { return <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-slate-300"><div><FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" /><h1 className="text-xl font-semibold text-white">{title}</h1></div></div>; }
