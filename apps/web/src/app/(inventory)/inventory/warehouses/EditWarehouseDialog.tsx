'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, X } from 'lucide-react';

export default function EditWarehouseDialog({ warehouse }: { warehouse: { id: string; name: string; location: string | null } }) {
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
      const res = await fetch(`/api/v1/inventory/warehouses/${warehouse.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to update warehouse');
      
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
      <button 
        onClick={() => setIsOpen(true)} 
        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        title="Edit Warehouse"
      >
        <Edit className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Edit Warehouse</h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-500 text-sm rounded-md border border-red-500/20">{error}</div>}
              
              <div className="space-y-2">
                <label htmlFor={`name-${warehouse.id}`} className="text-sm font-medium text-slate-800">Name *</label>
                <input 
                  required 
                  id={`name-${warehouse.id}`} 
                  name="name" 
                  type="text" 
                  defaultValue={warehouse.name}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor={`location-${warehouse.id}`} className="text-sm font-medium text-slate-800">Location</label>
                <input 
                  id={`location-${warehouse.id}`} 
                  name="location" 
                  type="text" 
                  defaultValue={warehouse.location || ''}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 mt-6 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                  Cancel
                </button>
                <button disabled={loading} type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-900 text-sm font-medium rounded-md transition-colors disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
