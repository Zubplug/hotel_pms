'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ExternalAuditorEvidence() {
  const params = useSearchParams();
  const [propertyId, setPropertyId] = useState(params.get('propertyId') || '');
  const [q, setQ] = useState(params.get('q') || '');
  const [items, setItems] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => { if (!propertyId) void fetch('/api/v1/external-auditor/context').then(r => r.json()).then(v => setPropertyId(v.scopes?.[0]?.propertyId || '')); }, [propertyId]);
  useEffect(() => { if (propertyId) void fetch(`/api/v1/external-auditor/evidence?propertyId=${propertyId}&q=${encodeURIComponent(q)}`).then(r => r.json()).then(v => setItems(v.items || [])); }, [propertyId, q]);
  const openTrail = (item: any) => { if (item.source !== 'FOLIO') return; void fetch(`/api/v1/external-auditor/evidence?propertyId=${propertyId}&source=FOLIO&id=${item.id}`).then(r => r.json()).then(v => setDetail(v.evidence)); };

  return <div className="space-y-6"><div><h2 className="text-2xl font-bold">Audit Evidence & Trail</h2><p className="text-slate-400">Source transactions, GL entries, and immutable audit events.</p></div>
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search reference, type, or description" className="w-full rounded-md border border-slate-800 bg-slate-900 px-4 py-3" />
    <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-900"><table className="min-w-full text-left text-sm"><thead><tr>{['Reference', 'Date', 'Type', 'Amount', 'Actor', 'Status', 'Evidence'].map(h => <th key={h} className="border-b border-slate-700 px-4 py-3 text-slate-400">{h}</th>)}</tr></thead><tbody>{items.map(item => <tr key={`${item.source}-${item.id}`}><td className="px-4 py-3 font-mono text-emerald-400">{item.reference || item.id}</td><td className="px-4 py-3">{new Date(item.date).toLocaleDateString()}</td><td className="px-4 py-3">{item.type}</td><td className="px-4 py-3">{item.amount == null ? '—' : `${item.currency || ''} ${item.amount}`}</td><td className="px-4 py-3 text-slate-400">{item.actor}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3"><button onClick={() => openTrail(item)} disabled={item.source !== 'FOLIO'} className="text-blue-400 disabled:text-slate-600">View trail</button></td></tr>)}</tbody></table>{!items.length && <p className="p-8 text-center text-slate-500">No evidence found for this authorized period.</p>}</div>
    {detail && <div className="rounded-xl border border-slate-700 bg-slate-900 p-5"><div className="flex justify-between"><h3 className="font-semibold">Immutable source trail</h3><button onClick={() => setDetail(null)} className="text-slate-400">Close</button></div><p className="mt-3 text-sm text-slate-400">Folio {detail.item.folio.folioNumber} · {detail.item.description}</p><div className="mt-4 space-y-2 text-sm">{[...detail.financialLogs, ...detail.auditLogs].map((event: any, index: number) => <div key={event.id || index} className="rounded border border-slate-800 p-3"><span className="text-slate-400">{new Date(event.createdAt).toLocaleString()}</span> · <span>{event.operationType || event.action || 'AUDIT_EVENT'}</span> · <span className="text-slate-400">{event.reason || event.userEmail || event.userRole || 'SYSTEM'}</span></div>)}</div></div>}
  </div>;
}
