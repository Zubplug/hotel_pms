'use client';

import { useState, useEffect } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { useProperty } from '@/components/PropertyProvider';
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRoomNumber } from '@/lib/format-room';

export default function MyTasksMobileView() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [issueTask, setIssueTask] = useState<any>(null);
  const [issueForm, setIssueForm] = useState({ title: '', description: '', priority: 'NORMAL' });
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const fetchTasks = async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/housekeeping/tasks?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks((data.data || []).map((task: any) => ({
        ...task,
        status: ['PENDING', 'ASSIGNED', 'CLEAN'].includes(String(task.status).toUpperCase())
          ? 'CLEANING'
          : String(task.status).toUpperCase(),
      })));
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [propertyId]);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/v1/housekeeping/tasks/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (err) {
      console.error('Error updating task', err);
    }
  };

  const submitIssue = async () => {
    if (!issueTask || !propertyId) return;
    setSubmittingIssue(true);
    try {
      const res = await fetch('/api/v1/maintenance/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomId: issueTask.roomId || null,
          title: issueForm.title,
          description: issueForm.description,
          priority: issueForm.priority
        })
      });
      if (res.ok) {
        await handleStatusUpdate(issueTask.id, 'MAINTENANCE_REQUIRED');
        setIssueTask(null);
        setIssueForm({ title: '', description: '', priority: 'NORMAL' });
      }
    } catch (err) {
      console.error('Failed to submit issue', err);
    } finally {
      setSubmittingIssue(false);
    }
  };

  if (!propertyId) return <div className="p-4 text-center">Loading property...</div>;
  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Cleaning Route</h1>
        <p className="text-sm text-gray-500">Today's assigned rooms.</p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-gray-50 border rounded-xl p-8 text-center text-gray-500">
          <CheckCircle2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-lg text-gray-700">All caught up!</p>
          <p className="text-sm">You have no pending assignments right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="bg-white border shadow-sm rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{task.type}</div>
                  <div className="text-4xl font-bold text-gray-900 leading-none mt-1">{formatRoomNumber(task.room?.number) || '??'}</div>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                    task.status === 'CLEANING' ? 'bg-indigo-100 text-indigo-700' :
                    task.status === 'INSPECTED' ? 'bg-green-100 text-green-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {task.status}
                  </div>
                  {task.priority === 'HIGH' && (
                    <div className="mt-2 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">URGENT</div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-white grid grid-cols-2 gap-3">
                {task.status === 'CLEANING' && (
                  <>
                    <div className="col-span-2 text-center text-indigo-600 p-2 font-medium flex items-center justify-center">
                      <Sparkles className="w-5 h-5 mr-2" /> Cleaning in progress — supervisor inspection follows
                    </div>
                    <Button 
                      variant="outline" 
                      className="h-14 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setIssueTask(task)}
                    >
                      <AlertTriangle className="w-5 h-5 mr-2" /> Issue
                    </Button>
                  </>
                )}

                {task.status === 'INSPECTED' && (
                  <div className="col-span-2 text-center text-green-600 p-2 font-medium flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 mr-2" /> Inspected & Ready
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!issueTask} onOpenChange={(open) => !open && setIssueTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Maintenance Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Issue Title</Label>
              <Input 
                placeholder="e.g. Broken AC, Leaking Tap" 
                value={issueForm.title}
                onChange={e => setIssueForm({...issueForm, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={issueForm.priority} onValueChange={val => setIssueForm({...issueForm, priority: val || 'NORMAL'})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical (Locks Room)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Details about the issue..." 
                value={issueForm.description}
                onChange={e => setIssueForm({...issueForm, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueTask(null)}>Cancel</Button>
            <Button variant="destructive" onClick={submitIssue} disabled={submittingIssue || !issueForm.title}>
              {submittingIssue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Issue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
