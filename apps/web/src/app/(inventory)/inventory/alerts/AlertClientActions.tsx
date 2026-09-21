'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AlertClientActions({ alertId, initialStatus }: { alertId: string, initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: 'acknowledge' | 'resolve') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/alerts/${alertId}/${action}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setStatus(action === 'acknowledge' ? 'ACKNOWLEDGED' : 'RESOLVED');
        if (action === 'resolve') {
          router.refresh();
        }
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Failed to update alert');
      }
    } catch (err) {
      console.error('Failed to update alert', err);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'RESOLVED') return null;

  return (
    <div className="flex gap-2">
      {status === 'OPEN' && (
        <button 
          onClick={() => handleAction('acknowledge')} 
          disabled={loading}
          className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20 disabled:opacity-50"
        >
          Acknowledge
        </button>
      )}
      <button 
        onClick={() => handleAction('resolve')} 
        disabled={loading}
        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        Resolve
      </button>
    </div>
  );
}
