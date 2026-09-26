'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { submitLeaseBillingSchedule } from '@/lib/events/lease-actions';
import { toast } from 'sonner';

type Schedule = { id: string; amount: unknown; usageCount: number; dueDate: Date; periodStart: Date; periodEnd: Date; corporateName: string };

export function LeasePendingSubmissions({ schedules }: { schedules: Schedule[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!schedules.length) return null;
  return <section className="rounded-2xl border border-amber-300/25 bg-amber-300/[.08] p-5"><div className="mb-4"><h2 className="font-bold text-amber-100">Pending lease billing</h2><p className="mt-1 text-xs text-slate-400">Submit a billing period to create its Event Invoice and send it to Accountant approval.</p></div><div className="space-y-2">{schedules.map((schedule) => <div key={schedule.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#101a2d] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white">{schedule.corporateName}</p><p className="mt-1 text-xs text-slate-400">{schedule.usageCount} use{schedule.usageCount === 1 ? '' : 's'} · {new Date(schedule.periodStart).toLocaleDateString()}–{new Date(schedule.periodEnd).toLocaleDateString()} · due {new Date(schedule.dueDate).toLocaleDateString()}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-sm font-bold text-white">{Number(schedule.amount).toLocaleString()}</span><Button size="sm" disabled={pending} onClick={() => startTransition(async () => { try { await submitLeaseBillingSchedule(schedule.id); toast.success('Lease invoice submitted to Accountant approval.'); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to submit lease billing.'); } })}>{pending ? 'Submitting…' : 'Submit for review'}</Button></div></div>)}</div></section>;
}
