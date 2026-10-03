'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Archive, CheckCircle2, FileCheck2, Loader2, LockKeyhole, PackageCheck, PenLine } from 'lucide-react';

type Pack = { id: string; status: string; packageHash: string; createdAt: string; auditorSignedAt?: string | null; managementSignedAt?: string | null; manifest: { requests: number; workpapers: number; findings: number; discounts?: number; complimentary?: number } };
type Engagement = { id: string; name: string; propertyId: string };
const human = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, match => match.toUpperCase());

export default function FinalPackPage() {
  const [propertyId, setPropertyId] = useState('');
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [signing, setSigning] = useState('');
  const [error, setError] = useState('');

  const load = async (id: string) => {
    const e = await fetch(`/api/v1/external-auditor/management?resource=engagements&propertyId=${id}`).then(r => r.json());
    const active = e.items?.[0];
    setEngagement(active || null);
    if (active) {
      const value = await fetch(`/api/v1/external-auditor/management?resource=final-packs&propertyId=${id}&engagementId=${active.id}`).then(r => r.json());
      setPacks(value.items || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetch('/api/v1/external-auditor/context').then(r => r.json()).then(v => {
      const scope = v.scopes?.[0];
      if (!scope) throw new Error(v.error || 'No active engagement');
      setPropertyId(scope.propertyId);
      return load(scope.propertyId);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const generate = async () => {
    if (!engagement) { setError('No active audit engagement is available for this property.'); return; }
    setGenerating(true); setError('');
    const response = await fetch('/api/v1/external-auditor/management', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'final-pack', propertyId, engagementId: engagement.id }) });
    const value = await response.json();
    if (!response.ok) setError(value.error || 'Unable to generate final pack'); else await load(propertyId);
    setGenerating(false);
  };

  const sign = async (id: string) => {
    setSigning(id); setError('');
    const response = await fetch('/api/v1/external-auditor/final-pack', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, signer: 'auditor' }) });
    const value = await response.json();
    if (!response.ok) setError(value.error || 'Unable to record auditor sign-off'); else await load(propertyId);
    setSigning('');
  };

  if (error && !engagement && !packs.length) return <div className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-6 text-red-200">{error}</div>;
  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading final-pack register…</div>;
  return <div className="space-y-6 pb-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300"><Archive className="h-4 w-4" /> Controlled deliverable</div><h1 className="text-3xl font-semibold tracking-tight text-white">Final audit pack</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Create a hash-identified snapshot, review its manifest, and record the auditor sign-off.</p></div><button type="button" onClick={() => void generate()} disabled={generating} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 disabled:cursor-wait disabled:opacity-50">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Generate pack</button></div>
    {error && <div className="rounded-xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm text-red-200">{error}</div>}
    {engagement && <div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5"><p className="text-xs text-slate-500">Engagement</p><h2 className="mt-1 text-lg font-semibold text-white">{engagement.name}</h2><p className="mt-2 text-xs text-slate-500">The immutable manifest includes the complete discount and complimentary registers for the engagement period.</p></div>}
    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.035]"><div className="border-b border-white/[.07] px-5 py-4"><h2 className="font-semibold text-white">Issued pack register</h2></div><div className="divide-y divide-white/[.06]">{packs.map(pack => <div key={pack.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><span className="font-medium text-white">{human(pack.status)} pack</span></div><p className="mt-2 font-mono text-xs text-slate-500">SHA-256 {pack.packageHash}</p><p className="mt-1 text-xs text-slate-600">Generated {new Date(pack.createdAt).toLocaleString()} · {pack.manifest.requests} requests · {pack.manifest.workpapers} workpapers · {pack.manifest.findings} findings</p><p className="mt-1 text-xs text-amber-200/70">{pack.manifest.discounts ?? 0} discounts · {pack.manifest.complimentary ?? 0} complimentary records included</p><div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className={`rounded-full px-2 py-1 ${pack.auditorSignedAt ? 'bg-emerald-300/10 text-emerald-300' : 'bg-amber-300/10 text-amber-300'}`}>{pack.auditorSignedAt ? 'Auditor signed' : 'Auditor sign-off pending'}</span><span className={`rounded-full px-2 py-1 ${pack.managementSignedAt ? 'bg-emerald-300/10 text-emerald-300' : 'bg-slate-300/10 text-slate-400'}`}>{pack.managementSignedAt ? 'Management signed' : 'Management sign-off pending'}</span></div></div><div className="flex flex-wrap gap-2"><Link href={`/external-auditor/reports?propertyId=${propertyId}`} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"><FileCheck2 className="h-3.5 w-3.5" /> Reports</Link>{!pack.auditorSignedAt && <button onClick={() => void sign(pack.id)} disabled={signing === pack.id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{signing === pack.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />} Sign as auditor</button>}<span className="inline-flex items-center gap-2 rounded-lg bg-white/[.05] px-3 py-2 text-xs text-slate-500"><LockKeyhole className="h-3.5 w-3.5" /> Immutable snapshot</span></div></div>)}{!packs.length && <div className="p-14 text-center"><Archive className="mx-auto mb-2 h-7 w-7 text-slate-700" /><p className="text-sm text-slate-500">No final audit pack has been generated.</p></div>}</div></section>
  </div>;
}
