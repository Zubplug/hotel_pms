'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MoonStar, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function NightAuditDashboard() {
  const { propertyId } = useProperty();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch Night Audit status');
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const handleExecute = async () => {
    if (!confirm('Are you sure you want to execute the Night Audit for this business date?')) return;
    
    setExecuting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/night-audit/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || 'Failed to execute Night Audit');
      
      setSuccessMsg(`Night Audit completed: ${result.data.tasksCreated} tasks created, ${result.data.tasksSkipped} skipped.`);
      fetchData(); // Refresh UI
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  if (!propertyId) return <div className="p-8 text-center text-muted-foreground">Please select a property.</div>;

  if (loading && !data) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const { businessDate, nextBusinessDate, audit, projectedStayovers, timezone } = data || {};

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg">
          <MoonStar className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Night Audit</h1>
          <p className="text-muted-foreground">Manage the end-of-day operational transition.</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 text-green-700 border border-green-200 p-4 rounded-md flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Engine Status</CardTitle>
            <CardDescription>Current operational date parameters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Timezone</span>
              <span className="font-medium">{timezone}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Current Business Date</span>
              <span className="font-bold text-lg">
                {businessDate ? format(new Date(businessDate), 'PPP') : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Audit Status</span>
              {audit?.status === 'COMPLETED' ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">COMPLETED</Badge>
              ) : audit?.status === 'IN_PROGRESS' ? (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">IN PROGRESS</Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500">NOT STARTED</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Housekeeping Projection</CardTitle>
            <CardDescription>Stayover task generation metrics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Target Date</span>
              <span className="font-medium">
                {nextBusinessDate ? format(new Date(nextBusinessDate), 'PPP') : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Eligible Stayovers</span>
              <span className="font-bold">{projectedStayovers}</span>
            </div>
            
            {audit?.status === 'COMPLETED' && (
              <>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Tasks Created</span>
                  <span className="text-green-600 font-bold">{audit.tasksCreated}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Already Existing (Skipped)</span>
                  <span className="text-gray-500 font-medium">{audit.tasksSkipped}</span>
                </div>
                {audit.errors > 0 && (
                  <div className="flex justify-between items-center py-2 border-b text-red-600">
                    <span>Errors Encountered</span>
                    <span className="font-bold">{audit.errors}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          size="lg" 
          disabled={executing || audit?.status === 'COMPLETED' || loading} 
          onClick={handleExecute}
          className="w-full sm:w-auto h-14 text-lg font-semibold"
        >
          {executing ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing Audit...</>
          ) : audit?.status === 'COMPLETED' ? (
            <><CheckCircle2 className="w-5 h-5 mr-2" /> Audit Completed</>
          ) : (
            <><Play className="w-5 h-5 mr-2 fill-current" /> Execute Night Audit</>
          )}
        </Button>
      </div>
      
      {audit?.status === 'COMPLETED' && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          The Night Audit for {format(new Date(businessDate), 'PPP')} has successfully completed. <br/>
          Tasks for tomorrow have been successfully generated.
        </p>
      )}
    </div>
  );
}
