'use client';

import { useState, useEffect } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { Loader2, AlertCircle, Calendar, RefreshCcw } from 'lucide-react';

export default function HousekeepingDashboard() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/housekeeping/tasks?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [propertyId]);

  if (!propertyId) {
    return <div className="p-8 text-center text-muted-foreground">Please select a property to view Housekeeping.</div>;
  }

  const role = (session?.user as any)?.role;
  if (role === 'HOUSEKEEPER') {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-4">Housekeeper View</h2>
        <p className="text-muted-foreground mb-6">Please navigate to your mobile-friendly My Tasks view.</p>
        <Button asChild>
          <a href="/housekeeping/my-tasks">Go to My Tasks</a>
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return 'bg-amber-100 text-amber-800';
      case 'ASSIGNED': return 'bg-blue-100 text-blue-800';
      case 'CLEANING': return 'bg-indigo-100 text-indigo-800';
      case 'CLEAN': return 'bg-emerald-100 text-emerald-800';
      case 'INSPECTED': return 'bg-green-100 text-green-800';
      case 'MAINTENANCE_REQUIRED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Housekeeping Dashboard</h1>
          <p className="text-muted-foreground">Manage room cleaning, status, and task assignments.</p>
        </div>
        <Button variant="outline" onClick={fetchTasks} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending / Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.filter(t => ['PENDING', 'ASSIGNED'].includes(t.status)).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cleaning in Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'CLEANING').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ready for Inspection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'CLEAN').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inspected (Ready)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{tasks.filter(t => t.status === 'INSPECTED').length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Room</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Priority</th>
              <th className="px-6 py-4 font-medium">Task Type</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Assigned To</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                  No housekeeping tasks for today.
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-lg">{task.room?.number || '??'}</td>
                  <td className="px-6 py-4 text-muted-foreground">{task.room?.roomType?.name}</td>
                  <td className="px-6 py-4">
                    {task.priority === 'HIGH' ? (
                      <Badge variant="destructive">HIGH</Badge>
                    ) : (
                      <Badge variant="outline">{task.priority}</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium">{task.type}</td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className={getStatusColor(task.status)}>{task.status}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    {task.assignedTo ? (
                      <span className="text-blue-600 font-medium text-xs">Staff {task.assignedTo.slice(0,5)}...</span>
                    ) : (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm">Manage</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
