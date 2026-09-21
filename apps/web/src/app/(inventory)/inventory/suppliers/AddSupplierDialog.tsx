'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

export function AddSupplierDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      ...Object.fromEntries(formData.entries()),
      contactName: formData.get('contactName'),
      taxIdentifier: formData.get('taxIdentifier'),
    };

    try {
      const res = await fetch('/api/v1/inventory/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      } else {
        alert('Failed to add supplier');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/25"
      >
        <Plus className="w-4 h-4" />
        Add Supplier
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020817]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111c2e] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-gradient-to-br from-emerald-400/[0.12] to-transparent px-6 py-5">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Supplier master</p><h2 className="mt-1 text-lg font-semibold text-white">Add supplier</h2></div>
              <button onClick={() => setIsOpen(false)} className="text-xl text-slate-500 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Legal or trading name</label>
                <input required name="name" type="text" className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Primary contact</label>
                <input name="contactName" type="text" className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Email</label>
                  <input name="email" type="email" className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Phone</label>
                  <input name="phone" type="text" className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Tax identifier</label>
                <input name="taxIdentifier" type="text" className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Address</label>
                <textarea name="address" rows={2} className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"></textarea>
              </div>
              <div className="flex justify-end gap-3 border-t border-white/[0.08] pt-4">
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
