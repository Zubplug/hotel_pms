import Link from 'next/link';
import { prisma } from '@hotel-pms/db';
import { requireEventContext } from '@/lib/events/access';
import { createLeaseContract } from '@/lib/events/lease-actions';
import { Button } from '@/components/ui/button';

export default async function HallUseContractsPage() {
  const { propertyId } = await requireEventContext();
  const [property, halls, corporates, contracts] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
    prisma.hall.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.corporateAccount.findMany({ where: { propertyId, isActive: true, cityLedgerAccount: { is: { status: 'ACTIVE' } } }, orderBy: { name: 'asc' } }),
    prisma.leaseContract.findMany({ where: { propertyId }, include: { hall: true, corporateAccount: true, schedules: { select: { status: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  async function saveContract(formData: FormData) {
    'use server';
    const days = formData.getAll('usageDays').map((day) => Number(day));
    await createLeaseContract({
      propertyId,
      corporateAccountId: String(formData.get('corporateAccountId')),
      hallId: String(formData.get('hallId')),
      startDate: new Date(`${String(formData.get('startDate'))}T00:00:00Z`),
      endDate: new Date(`${String(formData.get('endDate'))}T00:00:00Z`),
      usageFrequency: String(formData.get('usageFrequency')) as 'PER_USE' | 'DAILY' | 'WEEKLY',
      billingFrequency: String(formData.get('billingFrequency')) as 'PER_USE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM',
      customBillingDates: String(formData.get('customBillingDates') || '').split(',').map((date) => date.trim()).filter(Boolean).map((date) => new Date(`${date}T00:00:00Z`)),
      usageDays: days,
      startTime: String(formData.get('startTime') || '09:00'),
      endTime: String(formData.get('endTime') || '17:00'),
      rate: Number(formData.get('rate')),
      depositAmount: Number(formData.get('depositAmount') || 0),
      contactName: String(formData.get('contactName') || '').trim(),
      contactEmail: String(formData.get('contactEmail') || '').trim() || undefined,
    });
  }

  return <main className="min-h-full bg-[#fbf8f6] p-6 text-[#24130d] sm:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-3xl bg-[#24130d] p-7 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Events · commercial use</p><h1 className="mt-2 text-3xl font-bold">Recurring hall-use contracts</h1><p className="mt-2 max-w-3xl text-sm text-orange-100/75">Reserve a hall on a repeating schedule and bill the organisation through its City Ledger. Create one contract per hall when an organisation uses different halls or time windows.</p></header>
      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <form action={saveContract} className="space-y-4 rounded-3xl border border-[#eadfd8] bg-white p-6 shadow-sm">
          <div><h2 className="text-lg font-bold">New hall-use contract</h2><p className="mt-1 text-xs text-[#947d72]">Only organisations with an active City Ledger account are available.</p></div>
          <label className="grid gap-1 text-sm font-semibold">Organisation<select name="corporateAccountId" required className="h-10 rounded-xl border px-3 font-normal">{corporates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-semibold">Hall<select name="hallId" required className="h-10 rounded-xl border px-3 font-normal">{halls.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Start date<input name="startDate" type="date" required className="h-10 rounded-xl border px-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">End date<input name="endDate" type="date" required className="h-10 rounded-xl border px-3 font-normal" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Usage pattern<select name="usageFrequency" className="h-10 rounded-xl border px-3 font-normal"><option value="WEEKLY">Weekly</option><option value="DAILY">Daily</option><option value="PER_USE">Single / per use</option></select></label><label className="grid gap-1 text-sm font-semibold">Billing cycle<select name="billingFrequency" className="h-10 rounded-xl border px-3 font-normal"><option value="PER_USE">Per use</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option><option value="CUSTOM">Custom dates</option></select></label></div>
          <label className="grid gap-1 text-sm font-semibold">Custom billing dates <input name="customBillingDates" placeholder="2027-01-15, 2027-02-28, 2027-03-31" className="h-10 rounded-xl border px-3 font-normal" /><span className="text-xs font-normal text-[#947d72]">Required only for Custom dates; separate dates with commas.</span></label>
          <div><p className="mb-2 text-sm font-semibold">Weekly usage days</p><div className="grid grid-cols-4 gap-2 text-xs">{[['0','Sun'],['1','Mon'],['2','Tue'],['3','Wed'],['4','Thu'],['5','Fri'],['6','Sat']].map(([value, label]) => <label key={value} className="flex items-center gap-1 rounded-lg bg-slate-50 p-2"><input type="checkbox" name="usageDays" value={value} />{label}</label>)}</div></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Start time<input name="startTime" type="time" defaultValue="09:00" required className="h-10 rounded-xl border px-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">End time<input name="endTime" type="time" defaultValue="17:00" required className="h-10 rounded-xl border px-3 font-normal" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Rate per use ({property?.baseCurrency || 'NGN'})<input name="rate" type="number" min="0.01" step="0.01" required className="h-10 rounded-xl border px-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Deposit ({property?.baseCurrency || 'NGN'})<input name="depositAmount" type="number" min="0" step="0.01" defaultValue="0" className="h-10 rounded-xl border px-3 font-normal" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Event contact<input name="contactName" required minLength={2} className="h-10 rounded-xl border px-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Contact email<input name="contactEmail" type="email" className="h-10 rounded-xl border px-3 font-normal" /></label></div>
          <Button type="submit" className="w-full rounded-xl bg-orange-700 font-bold hover:bg-orange-800">Create contract and reserve schedule</Button>
        </form>
        <section className="rounded-3xl border border-[#eadfd8] bg-white shadow-sm"><div className="flex items-center justify-between border-b p-6"><div><h2 className="text-lg font-bold">Active and recent contracts</h2><p className="mt-1 text-xs text-[#947d72]">Invoices are submitted for accounting review when each billing period becomes due.</p></div><Link href="/fnb/events/accounting" className="text-xs font-bold text-orange-700">Open invoice control</Link></div><div className="divide-y">{contracts.length === 0 ? <p className="p-10 text-center text-sm text-[#947d72]">No recurring hall-use contracts yet.</p> : contracts.map((contract) => <div key={contract.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{contract.corporateAccount?.name || contract.contactName}</p><p className="mt-1 text-sm text-[#6f5d53]">{contract.hall.name} · {contract.usageFrequency} use · {contract.billingFrequency} billing</p><p className="mt-1 text-xs text-[#947d72]">{contract.startDate.toISOString().slice(0, 10)} → {contract.endDate.toISOString().slice(0, 10)} · {contract.schedules.filter((schedule) => schedule.status === 'PAID').length}/{contract.schedules.length} periods paid</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${contract.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{contract.isActive ? 'ACTIVE' : 'INACTIVE'}</span></div>)}</div></section>
      </section>
    </div>
  </main>;
}
