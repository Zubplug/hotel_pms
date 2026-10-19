'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, Waves } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';

type Facility = { id: string; name: string; code: string; capacity: number; status: string; passTypes: PassType[] };
type PassType = { id: string; name: string; code: string; guestClass: string; price: number | string; currency: string; productId?: string | null; isComplimentary: boolean };
type Product = { id: string; name: string; price: number | string };

const inputClass = 'w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300/50';
export default function GeneralManagerPoolPage() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', code: '', capacity: 1, status: 'OPEN' });

  const load = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError('');
    try {
      const [poolRes, productsRes] = await Promise.all([
        fetch(`/api/v1/pos/swimming-pool?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' }),
        fetch(`/api/v1/pos/products?all=true&propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' }),
      ]);
      const poolJson = await poolRes.json();
      const productsJson = await productsRes.json();
      if (!poolRes.ok) throw new Error(poolJson.error || 'Pool configuration could not be loaded');
      setFacility(poolJson.data?.facility || null);
      setProducts(productsJson.data || []);
      if (poolJson.data?.facility) {
        const current = poolJson.data.facility;
        setForm({ name: current.name, code: current.code, capacity: current.capacity, status: current.status });
      }
    } catch (err: any) {
      setError(err.message || 'Pool configuration could not be loaded');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!propertyLoading) void load(); }, [propertyId, propertyLoading]);

  const saveFacility = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('facility'); setError(''); setMessage('');
    try {
      const body = facility
        ? { action: 'update_facility', propertyId, facilityId: facility.id, ...form }
        : { action: 'setup', propertyId, ...form };
      const res = await fetch('/api/v1/pos/swimming-pool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Facility could not be saved');
      setMessage(facility ? 'Pool facility updated.' : 'Pool facility created.');
      await load();
    } catch (err: any) { setError(err.message || 'Facility could not be saved'); }
    finally { setBusy(''); }
  };

  const savePass = async (pass: PassType, productId: string) => {
    setBusy(pass.id); setError(''); setMessage('');
    const product = products.find((item) => item.id === productId);
    try {
      const res = await fetch('/api/v1/pos/swimming-pool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'configure_pass', propertyId, passTypeId: pass.id, productId: productId || null, price: product?.price ?? pass.price, isComplimentary: !productId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Pass mapping could not be saved');
      setMessage(`${pass.name} mapping saved.`);
      await load();
    } catch (err: any) { setError(err.message || 'Pass mapping could not be saved'); }
    finally { setBusy(''); }
  };

  return <main className="min-h-screen bg-[#07111f] px-5 py-8 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10"><Waves className="text-cyan-300" /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Operations configuration</p><h1 className="mt-1 text-2xl font-semibold">Swimming pool</h1><p className="mt-1 text-sm text-slate-400">Configure the facility and connect pool passes to active POS products.</p></div></div>
      {error && <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}
      {loading || propertyLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-300" /></div> : <>
        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6">
          <div className="mb-5"><h2 className="font-semibold">Facility settings</h2><p className="mt-1 text-xs text-slate-500">These values control admission capacity and whether the pool accepts new entries.</p></div>
          <form onSubmit={saveFacility} className="grid gap-4 md:grid-cols-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 md:col-span-2">Facility name<input required className={`${inputClass} mt-2`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main swimming pool" /></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Code<input required className={`${inputClass} mt-2`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="POOL" /></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Capacity<input required min={1} type="number" className={`${inputClass} mt-2`} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Operating status<select className={`${inputClass} mt-2`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="MAINTENANCE">Maintenance</option><option value="WEATHER_HOLD">Weather hold</option></select></label>
            <div className="flex items-end md:col-span-3"><button disabled={busy === 'facility'} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"><Save size={16} />{busy === 'facility' ? 'Saving…' : facility ? 'Save facility settings' : 'Create pool facility'}</button></div>
          </form>
        </section>
        {facility && <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6"><div className="mb-5"><h2 className="font-semibold">Pool pass and POS mapping</h2><p className="mt-1 text-xs text-slate-500">Unlinked passes remain complimentary. Linked passes use the POS product price at sale time.</p></div><div className="divide-y divide-white/[0.06]">{facility.passTypes.map((pass) => <PassRow key={pass.id} pass={pass} products={products} busy={busy === pass.id} onSave={savePass} />)}</div></section>}
      </>}
    </div>
  </main>;
}

function PassRow({ pass, products, busy, onSave }: { pass: PassType; products: Product[]; busy: boolean; onSave: (pass: PassType, productId: string) => Promise<void> }) {
  const [productId, setProductId] = useState(pass.productId || '');
  useEffect(() => setProductId(pass.productId || ''), [pass.productId]);
  return <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"><div><div className="text-sm font-medium">{pass.name}</div><div className="mt-1 text-xs text-slate-500">{pass.code} · {pass.guestClass} · {pass.isComplimentary ? 'Complimentary' : 'Paid'}</div></div><div className="flex w-full gap-2 md:w-[28rem]"><select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Complimentary / no sale</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {Number(product.price).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })}</option>)}</select><button disabled={busy} onClick={() => void onSave(pass, productId)} className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-3 text-xs font-bold text-slate-950 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : 'Save'}</button></div></div>;
}
