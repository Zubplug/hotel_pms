'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useProperty } from '@/components/PropertyProvider';
import { Loader2, CheckCircle2, PlayCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MyTasksMobileView() {
  const { propertyId } = useProperty();
  const { data: session } = useSession();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/housekeeping/tasks?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data.data || []);
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
                  <div className="text-4xl font-bold text-gray-900 leading-none mt-1">{task.room?.number || '??'}</div>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                    task.status === 'CLEAN' ? 'bg-emerald-100 text-emerald-700' :
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
                {['PENDING', 'ASSIGNED'].includes(task.status) && (
                  <Button 
                    className="col-span-2 h-14 text-lg bg-indigo-600 hover:bg-indigo-700" 
                    onClick={() => handleStatusUpdate(task.id, 'CLEANING')}
                  >
                    <PlayCircle className="w-6 h-6 mr-2" /> Start Cleaning
                  </Button>
                )}

                {task.status === 'CLEANING' && (
                  <>
                    <Button 
                      className="h-14 text-lg bg-emerald-600 hover:bg-emerald-700" 
                      onClick={() => handleStatusUpdate(task.id, 'CLEAN')}
                    >
                      <CheckCircle2 className="w-6 h-6 mr-2" /> Mark Clean
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-14 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => handleStatusUpdate(task.id, 'MAINTENANCE_REQUIRED')}
                    >
                      <AlertTriangle className="w-5 h-5 mr-2" /> Issue
                    </Button>
                  </>
                )}

                {task.status === 'CLEAN' && (
                  <div className="col-span-2 text-center text-emerald-600 p-2 font-medium flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 mr-2" /> Waiting for Supervisor Inspection
                  </div>
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
    </div>
  );
}
