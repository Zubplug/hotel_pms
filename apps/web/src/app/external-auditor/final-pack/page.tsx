'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FileSearch,
  Fingerprint,
  FolderCheck,
  Info,
  Loader2,
  LockKeyhole,
  PackageCheck,
  PenLine,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';

type Manifest = {
  requests: number;
  workpapers: number;
  findings: number;
  discounts?: number;
  complimentary?: number;
  generatedAt?: string;
  registers?: {
    discounts?: unknown[];
    complimentary?: unknown[];
  };
};

type Pack = {
  id: string;
  status: string;
  packageHash: string;
  createdAt: string;
  issuedAt?: string | null;
  auditorSignedAt?: string | null;
  managementSignedAt?: string | null;
  manifest: Manifest;
};

type Engagement = { id: string; name: string; propertyId: string; auditPeriodStart?: string; auditPeriodEnd?: string; status?: string };
type Modal = { kind: 'generate' | 'sign' | 'inspect'; pack?: Pack } | null;

const human = (value: string) =>
  value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());

const dateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : 'Pending');

const statusTone = (status: string) => {
  if (status === 'ISSUED') return 'bg-emerald-300/10 text-emerald-300';
  if (status === 'PENDING_SIGNOFF') return 'bg-amber-300/10 text-amber-200';
  return 'bg-slate-300/10 text-slate-400';
};

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof Archive }) {
  return <div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">{label}</p><Icon className="h-4 w-4 text-emerald-300/70" /></div><p className="mt-3 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-600">{detail}</p></div>;
}

export default function FinalPackPage() {
  const [propertyId, setPropertyId] = useState('');
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'generate' | string | null>(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<Modal>(null);

  const load = async (id: string) => {
    setLoading(true);
    try {
      const engagementResponse = await fetch(`/api/v1/external-auditor/management?resource=engagements&propertyId=${id}`);
      const engagementValue = await engagementResponse.json();
      if (!engagementResponse.ok) throw new Error(engagementValue.error || 'Unable to load engagement');
      const active = engagementValue.items?.[0] as Engagement | undefined;
      setEngagement(active || null);
      if (!active) {
        setPacks([]);
        return;
      }
      const packsResponse = await fetch(`/api/v1/external-auditor/management?resource=final-packs&propertyId=${id}&engagementId=${active.id}`);
      const packsValue = await packsResponse.json();
      if (!packsResponse.ok) throw new Error(packsValue.error || 'Unable to load final-pack register');
      setPacks((packsValue.items || []) as Pack[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetch('/api/v1/external-auditor/context')
      .then(async (response) => {
        const value = await response.json();
        const scope = value.scopes?.[0];
        if (!response.ok || !scope) throw new Error(value.error || 'No active engagement');
        setPropertyId(scope.propertyId);
        return load(scope.propertyId);
      })
      .catch((value: unknown) => setError(value instanceof Error ? value.message : 'Unable to load final-pack context'));
    // Context is intentionally loaded once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issuedCount = packs.filter((pack) => pack.status === 'ISSUED').length;
  const pendingCount = packs.length - issuedCount;
  const latest = packs[0];
  const manifestTotals = useMemo(() => packs.reduce((total, pack) => ({
    requests: total.requests + Number(pack.manifest?.requests || 0),
    workpapers: total.workpapers + Number(pack.manifest?.workpapers || 0),
    findings: total.findings + Number(pack.manifest?.findings || 0),
  }), { requests: 0, workpapers: 0, findings: 0 }), [packs]);

  const generate = async () => {
    if (!engagement) return;
    setBusy('generate');
    setError('');
    try {
      const response = await fetch('/api/v1/external-auditor/management', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'final-pack', propertyId, engagementId: engagement.id }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Unable to generate final pack');
      setModal(null);
      await load(propertyId);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to generate final pack');
    } finally {
      setBusy(null);
    }
  };

  const sign = async (pack: Pack) => {
    setBusy(pack.id);
    setError('');
    try {
      const response = await fetch('/api/v1/external-auditor/final-pack', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pack.id, signer: 'auditor' }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Unable to record auditor sign-off');
      setModal(null);
      await load(propertyId);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to record auditor sign-off');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !engagement) return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading final-pack register…</div>;
  if (error && !engagement && !packs.length) return <div className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-6 text-red-200">{error}</div>;

  return <div className="space-y-6 pb-10">
    <header className="relative overflow-hidden rounded-3xl border border-white/[.09] bg-gradient-to-br from-[#173b39] via-[#172c3a] to-[#0b1422] p-6 shadow-2xl shadow-black/20 sm:p-8"><div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[42px] border-emerald-300/[.06]" /><div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-emerald-300"><Archive className="h-4 w-4" /> Controlled deliverable</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Final audit pack</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Issue a period-scoped, hash-identified snapshot of the audit evidence and review registers. Sign-off creates a controlled handover; it does not rewrite source records.</p></div><button type="button" onClick={() => setModal({ kind: 'generate' })} disabled={!engagement || busy !== null} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"><PackageCheck className="h-4 w-4" /> Generate pack</button></div></header>

    {engagement && <section className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:flex-row sm:items-center sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300"><FolderCheck className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Authorized engagement</p><h2 className="mt-1 font-semibold text-white">{engagement.name}</h2><p className="mt-1 text-sm text-slate-500">{engagement.auditPeriodStart && engagement.auditPeriodEnd ? `${new Date(engagement.auditPeriodStart).toLocaleDateString()} — ${new Date(engagement.auditPeriodEnd).toLocaleDateString()}` : 'Period controlled by engagement scope'}</p></div></div><span className="w-fit rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">{human(engagement.status || 'ACTIVE')}</span></section>}
    {error && <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm text-red-200"><Info className="mt-0.5 h-4 w-4" />{error}</div>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Archive} label="Issued packs" value={issuedCount} detail="Both parties signed" /><Metric icon={PenLine} label="Awaiting sign-off" value={pendingCount} detail="Controlled but incomplete" /><Metric icon={ClipboardList} label="Register coverage" value={manifestTotals.requests + manifestTotals.workpapers + manifestTotals.findings} detail="Requests, workpapers, findings" /><Metric icon={Fingerprint} label="Latest integrity" value={latest ? latest.packageHash.slice(0, 12) : '—'} detail={latest ? 'SHA-256 package identifier' : 'No pack generated'} /></section>

    <section className="rounded-2xl border border-sky-300/15 bg-sky-300/[.045] p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-300"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-semibold text-white">What this register controls</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Each pack is a point-in-time manifest for the authorized engagement. Once issued, keep it as the handover reference; later corrections or added evidence should produce a new pack and remain traceable to the earlier hash.</p></div></div></section>

    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.035]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] px-5 py-4 sm:px-6"><div><h2 className="font-semibold text-white">Pack register</h2><p className="mt-1 text-xs text-slate-500">Inspect the manifest, download the controlled snapshot, or record auditor sign-off.</p></div>{loading && <RefreshCw className="h-4 w-4 animate-spin text-emerald-300" />}</div><div className="divide-y divide-white/[.06]">{packs.map((pack) => <div key={pack.id} className="p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusTone(pack.status)}`}>{pack.status === 'ISSUED' ? <CheckCircle2 className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}{human(pack.status)}</span><span className="text-xs text-slate-600">Created {dateTime(pack.createdAt)}</span></div><p className="mt-3 break-all font-mono text-xs text-emerald-300/80">SHA-256 {pack.packageHash}</p><p className="mt-2 text-xs text-slate-500">{pack.manifest.requests} requests · {pack.manifest.workpapers} workpapers · {pack.manifest.findings} findings · {pack.manifest.discounts || 0} discounts · {pack.manifest.complimentary || 0} complimentary records</p><div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className={`rounded-full px-2 py-1 ${pack.auditorSignedAt ? 'bg-emerald-300/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}>{pack.auditorSignedAt ? `Auditor signed · ${dateTime(pack.auditorSignedAt)}` : 'Auditor sign-off pending'}</span><span className={`rounded-full px-2 py-1 ${pack.managementSignedAt ? 'bg-emerald-300/10 text-emerald-300' : 'bg-slate-300/10 text-slate-400'}`}>{pack.managementSignedAt ? `Management signed · ${dateTime(pack.managementSignedAt)}` : 'Management sign-off pending'}</span></div></div><div className="flex flex-wrap gap-2 xl:justify-end"><button type="button" onClick={() => setModal({ kind: 'inspect', pack })} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[.05]"><FileSearch className="h-3.5 w-3.5" /> Inspect pack</button>{!pack.auditorSignedAt && <button type="button" onClick={() => setModal({ kind: 'sign', pack })} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"><PenLine className="h-3.5 w-3.5" /> Sign as auditor</button>}</div></div></div>)}{!packs.length && <div className="p-16 text-center"><Archive className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-3 text-sm text-slate-400">No final audit pack has been generated.</p><p className="mt-1 text-xs text-slate-600">Generate one after the engagement evidence and review registers are ready.</p></div>}</div></section>

    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><div><p className="text-sm font-semibold text-white">Supporting workspaces</p><p className="mt-1 text-xs text-slate-500">Review source evidence and reports before issuing a pack.</p></div><div className="flex flex-wrap gap-2"><Link href={`/external-auditor/evidence?propertyId=${propertyId}`} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[.05]"><FileSearch className="h-3.5 w-3.5" /> Evidence <ArrowUpRight className="h-3 w-3 text-slate-600" /></Link><Link href={`/external-auditor/reports?propertyId=${propertyId}`} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[.05]"><FileCheck2 className="h-3.5 w-3.5" /> Reports <ArrowUpRight className="h-3 w-3 text-slate-600" /></Link></div></section>

    {modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101b2c] shadow-2xl sm:rounded-3xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[.08] bg-[#101b2c]/95 p-5 backdrop-blur sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300">{modal.kind === 'inspect' ? 'Pack dossier' : 'Controlled action'}</p><h2 className="mt-2 text-xl font-semibold text-white">{modal.kind === 'generate' ? 'Generate final audit pack' : modal.kind === 'sign' ? 'Confirm auditor sign-off' : 'Inspect final audit pack'}</h2></div><button type="button" onClick={() => setModal(null)} className="rounded-lg p-2 text-slate-500 hover:bg-white/[.06] hover:text-white" aria-label="Close modal"><X className="h-5 w-5" /></button></div><div className="space-y-5 p-5 sm:p-6">{modal.kind === 'generate' && <><div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.05] p-4"><div className="flex items-start gap-3"><PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="font-semibold text-white">Create an immutable point-in-time snapshot?</p><p className="mt-1 text-sm leading-6 text-slate-400">The pack will capture the current engagement registers, including requests, workpapers, findings, discounts, and complimentary records. Generate again if the source set changes materially.</p></div></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/[.07] bg-white/[.025] p-4"><p className="text-xs text-slate-500">Engagement</p><p className="mt-1 text-sm font-medium text-white">{engagement?.name}</p></div><div className="rounded-xl border border-white/[.07] bg-white/[.025] p-4"><p className="text-xs text-slate-500">Scope</p><p className="mt-1 text-sm font-medium text-white">Authorized property records</p></div></div><button type="button" onClick={() => void generate()} disabled={busy === 'generate'} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Generate controlled pack</button></>}{modal.kind === 'sign' && modal.pack && <><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.05] p-4"><div className="flex items-start gap-3"><PenLine className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div><p className="font-semibold text-white">Record your auditor sign-off?</p><p className="mt-1 text-sm leading-6 text-slate-400">This records that you reviewed this exact hash-identified pack. It does not approve management actions or alter the underlying PMS records.</p></div></div></div><p className="break-all rounded-xl border border-white/[.07] bg-slate-950/30 p-4 font-mono text-xs text-emerald-300/80">{modal.pack.packageHash}</p><button type="button" onClick={() => void sign(modal.pack!)} disabled={busy === modal.pack.id} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy === modal.pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />} Confirm auditor sign-off</button></>}{modal.kind === 'inspect' && modal.pack && <><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusTone(modal.pack.status)}`}>{human(modal.pack.status)}</span><span className="text-xs text-slate-500">Created {dateTime(modal.pack.createdAt)}</span></div><div className="rounded-xl border border-white/[.07] bg-slate-950/30 p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-600">Package fingerprint</p><p className="mt-2 break-all font-mono text-xs leading-5 text-emerald-300/80">{modal.pack.packageHash}</p></div><div className="grid gap-3 sm:grid-cols-2"><Metric icon={ClipboardList} label="Requests" value={modal.pack.manifest.requests} detail="Evidence requests" /><Metric icon={FileCheck2} label="Workpapers" value={modal.pack.manifest.workpapers} detail="Prepared audit files" /><Metric icon={BadgeCheck} label="Findings" value={modal.pack.manifest.findings} detail="Control findings" /><Metric icon={Archive} label="Concessions" value={`${modal.pack.manifest.discounts || 0} / ${modal.pack.manifest.complimentary || 0}`} detail="Discounts / complimentary" /></div><div className="space-y-3 rounded-xl border border-white/[.07] bg-white/[.025] p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Auditor sign-off</span><span className="text-right text-slate-200">{dateTime(modal.pack.auditorSignedAt)}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Management sign-off</span><span className="text-right text-slate-200">{dateTime(modal.pack.managementSignedAt)}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Issued at</span><span className="text-right text-slate-200">{dateTime(modal.pack.issuedAt)}</span></div></div><div className="flex flex-wrap gap-2"><a href={`/api/v1/external-auditor/final-pack?id=${modal.pack.id}&format=zip`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950"><Download className="h-3.5 w-3.5" /> Download ZIP</a><a href={`/api/v1/external-auditor/final-pack?id=${modal.pack.id}&format=pdf`} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"><Download className="h-3.5 w-3.5" /> Download PDF</a></div></>}</div></div></div>}
  </div>;
}
