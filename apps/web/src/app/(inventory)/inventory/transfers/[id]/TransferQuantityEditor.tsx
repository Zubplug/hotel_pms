'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';

type TransferLine = { id: string; name: string; quantity: number; unit: string };

export default function TransferQuantityEditor({ transferId, items }: { transferId: string; items: TransferLine[] }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.id, String(item.quantity)])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/inventory/transfers/${transferId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((item) => ({ id: item.id, quantity: Number(quantities[item.id]) })) }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Could not update request');
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not update request');
    } finally {
      setSaving(false);
    }
  }

  return <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] px-5 py-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-amber-200">Adjust requested quantities</p><p className="mt-1 text-xs text-slate-500">Stock control may reduce quantities before approval or issue. Items cannot be added or increased.</p></div><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save reduction</button></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{items.map((item) => <label key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-300"><span className="min-w-0 truncate">{item.name} <span className="text-slate-600">({item.unit})</span></span><input type="number" min="0.0001" max={item.quantity} step="0.0001" value={quantities[item.id]} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} className="w-24 rounded-md border border-white/10 bg-[#08111f] px-2 py-1.5 text-right text-xs text-white outline-none focus:border-amber-400/50" /></label>)}</div>
    {message && <p className="mt-3 text-xs text-rose-300">{message}</p>}
  </div>;
}
