'use client';

import { useState, useEffect } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Loader2, AlertCircle, RefreshCcw, Check, X } from 'lucide-react';

export default function HousekeepingDashboard() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const { provider, isDesktopMode, isOnline } = useLodgeCoreProvider();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managingTaskId, setManagingTaskId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await provider.housekeeping.list(propertyId);
      const data = Array.isArray(result) ? result : (result as any)?.data || [];
      setTasks(data.map((task: any) => ({
        ...task,
        room: task.room || { number: task.roomNumber || '??' },
        type: task.type || task.taskType || 'CLEANING',
        assignedTo: task.assignedTo || task.assignedToUserId || null,
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [propertyId, provider]);

  const statusOptions: Record<string, string[]> = {
    PENDING: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['CLEANING', 'CANCELLED'],
    CLEANING: ['CLEAN', 'MAINTENANCE_REQUIRED'],
    CLEAN: ['INSPECTED', 'MAINTENANCE_REQUIRED'],
    INSPECTED: [],
    CANCELLED: [],
    MAINTENANCE_REQUIRED: ['PENDING', 'ASSIGNED']
  };

  const saveTaskStatus = async (taskId: string) => {
    if (!selectedStatus) return;
    setSavingTaskId(taskId);
    setError(null);
    try {
      await provider.housekeeping.updateTask(taskId, selectedStatus);
      setManagingTaskId(null);
      setSelectedStatus('');
      await fetchTasks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingTaskId(null);
    }
  };

  if (!propertyId) {
    return <div className="p-8 text-center text-muted-foreground">Please select a property to view Housekeeping.</div>;
  }

  const role = String((session?.user as any)?.role || '').toUpperCase();
  const capabilities = ((session?.user as any)?.capabilities || []) as string[];
  const isReceptionist = ['RECEPTIONIST', 'FRONT_DESK'].includes(role);
  const canManage = isReceptionist || role === 'MANAGER' || role === 'ADMIN' || capabilities.includes('ACCESS_MANAGEMENT');
  if (!canManage) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-4">Housekeeping is receptionist-managed</h2>
        <p className="text-muted-foreground">Reception staff assign, update, inspect, and release rooms. Contact reception for task changes.</p>
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
          <p className="text-muted-foreground">Reception-managed room cleaning, inspection, and release control.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{isDesktopMode && !isOnline ? 'Offline — local tasks' : 'Live task list'}</Badge>
          <Button variant="outline" onClick={fetchTasks} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
          Refresh
          </Button>
        </div>
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
                    {managingTaskId === task.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={selectedStatus}
                          onChange={(event) => setSelectedStatus(event.target.value)}
                          className="h-9 rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="">Update status</option>
                          {(statusOptions[task.status] || []).map((status) => (
                            <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                          ))}
                        </select>
                        <Button size="icon" variant="outline" onClick={() => saveTaskStatus(task.id)} disabled={!selectedStatus || savingTaskId === task.id}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setManagingTaskId(null)} disabled={savingTaskId === task.id}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setManagingTaskId(task.id);
                          setSelectedStatus('');
                        }}
                        disabled={(statusOptions[task.status] || []).length === 0}
                      >
                        Manage
                      </Button>
                    )}
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
