'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';

export default function SyncCenterPage() {
  const { data: session } = useSession();
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const propertyId = session?.user?.propertyId;

  const fetchConflicts = async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/sync/conflicts?propertyId=${propertyId}`);
      if (res.ok) {
        const data = await res.json();
        setConflicts(data);
      } else {
        toast.error('Failed to load sync conflicts.');
      }
    } catch (err) {
      toast.error('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, [propertyId]);

  const handleResolve = async (id: string, action: string) => {
    if (!confirm('Are you sure you want to apply this resolution? No silent financial adjustments are made; this will enforce the selected state as authoritative.')) return;
    
    setResolvingId(id);
    try {
      const res = await fetch(`/api/v1/sync/conflicts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resolutionComment: 'Manual resolution via Sync Center' })
      });
      
      const result = await res.json();
      if (res.ok) {
        toast.success('Conflict resolved successfully.');
        fetchConflicts();
      } else {
        toast.error(`Resolution Failed: ${result.error}`);
      }
    } catch (err) {
      toast.error('Server error during resolution.');
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'CRITICAL': return 'bg-red-600';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  if (!propertyId) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Sync Center"
        description="Review and resolve edge synchronization conflicts requiring managerial oversight."
      />

      <div className="mt-8 space-y-6">
        {loading && <p>Loading conflicts...</p>}
        {!loading && conflicts.length === 0 && (
          <Card className="bg-gray-50 border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center p-12 text-gray-500">
              <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h3 className="text-lg font-semibold">System Healthy</h3>
              <p>There are currently no active synchronization conflicts.</p>
            </CardContent>
          </Card>
        )}

        {conflicts.map(conflict => (
          <Card key={conflict.id} className="border-l-4" style={{ borderLeftColor: conflict.severity === 'CRITICAL' ? 'red' : 'gray' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-3">
                  {conflict.edgeEvent.eventType.replace('_', ' ')}
                  <Badge className={getSeverityColor(conflict.severity)}>{conflict.severity}</Badge>
                </CardTitle>
                <CardDescription>
                  Aggregate: {conflict.aggregateType} | ID: {conflict.aggregateId}
                </CardDescription>
              </div>
              <div className="text-sm text-gray-500 text-right">
                <p>Cloud Version: {conflict.expectedVersion}</p>
                <p>Edge Version: {conflict.receivedVersion}</p>
                <p>{new Date(conflict.createdAt).toLocaleString()}</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 text-red-800 text-sm p-3 rounded-md mb-4 font-mono">
                {conflict.conflictReason}
              </div>

              {conflict.severity === 'CRITICAL' && (
                <div className="bg-yellow-50 text-yellow-800 text-sm p-3 rounded-md mb-4 font-semibold border border-yellow-200">
                  ⚠️ FINANCIAL IMPACT DETECTED. Review the payload carefully. No financial adjustment has been silently applied.
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm font-mono bg-gray-50 p-4 rounded-md overflow-auto max-h-60 mb-6 border">
                <div>
                  <h4 className="font-bold text-gray-700 mb-2 pb-1 border-b">Expected Cloud State (V{conflict.expectedVersion})</h4>
                  <p className="italic text-gray-500 text-xs mb-2">The current authoritative state in the cloud database before this event occurred.</p>
                  <pre>{conflict.cloudState ? JSON.stringify(conflict.cloudState, null, 2) : "Cloud state snapshot not available"}</pre>
                </div>
                <div>
                  <h4 className="font-bold text-gray-700 mb-2 pb-1 border-b">Received Edge State (V{conflict.receivedVersion})</h4>
                  <p className="italic text-gray-500 text-xs mb-2">The conflicting event that was generated offline on the edge node.</p>
                  <pre>{JSON.stringify(conflict.edgeEvent.payload, null, 2)}</pre>
                </div>
              </div>

              <div className="flex gap-4 items-center bg-gray-100 p-4 rounded-md">
                <p className="flex-1 text-sm font-medium">Resolution Actions:</p>
                <Button 
                   variant="outline" 
                   className="text-red-600 border-red-200 hover:bg-red-50"
                   disabled={resolvingId === conflict.id}
                   onClick={() => handleResolve(conflict.id, 'REJECT_EDGE_EVENT')}
                >
                  Discard Edge Event
                </Button>
                <Button 
                   className="bg-blue-600 hover:bg-blue-700 text-white"
                   disabled={resolvingId === conflict.id}
                   onClick={() => handleResolve(conflict.id, 'FORCE_EDGE_EVENT')}
                >
                  Force Apply Edge Event
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
