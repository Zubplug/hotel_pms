'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

export default function WarehouseClientActions() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      location: formData.get('location'),
    };

    try {
      const res = await fetch('/api/v1/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to create warehouse');
      
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="inline-flex items-center justify-center rounded-xl text-sm font-semibold bg-emerald-400/15 text-emerald-200 border border-emerald-400/30 hover:bg-emerald-400/25 h-10 px-4 py-2 transition-colors">
        <Plus className="mr-2 h-4 w-4" /> New Warehouse
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#111c2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-white/[0.07]">
              <h2 className="text-lg font-semibold text-white">Create New Warehouse</h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <div className="p-3 bg-rose-400/10 text-rose-300 text-sm rounded-xl border border-rose-400/20">{error}</div>}
              
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-slate-300">Name *</label>
                <input required id="name" name="name" type="text" className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" placeholder="Main Store" />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="location" className="text-sm font-medium text-slate-300">Location</label>
                <input id="location" name="location" type="text" className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" placeholder="Basement Level 1" />
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t border-white/[0.07] pt-4">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button disabled={loading} type="submit" className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-[#08111f] text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
