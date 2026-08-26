'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive } from 'lucide-react';

export function PostGrnButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePost() {
    if (!confirm('Are you sure you want to post this GRN to stock? This action cannot be undone.')) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/grns/${id}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: crypto.randomUUID() })
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to post GRN');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePost}
      disabled={loading}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-slate-900 px-4 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50"
    >
      <Archive className="w-4 h-4" />
      {loading ? 'Posting...' : 'Post to Stock'}
    </button>
  );
}
