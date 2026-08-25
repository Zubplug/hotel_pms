'use client';

import { useState, useEffect } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import {
  Loader2,
  AlertCircle,
  RefreshCcw,
  Check,
  X,
  BedDouble,
  Sparkles,
  ShieldCheck,
  Clock,
  WifiOff,
  Wifi,
  TriangleAlert,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRoomNumber } from '@/lib/format-room';

// ─── types ────────────────────────────────────────────────────────────────────
type HKStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'CLEANING'
  | 'CLEAN'
  | 'INSPECTED'
  | 'CANCELLED'
  | 'MAINTENANCE_REQUIRED';

interface HKTask {
  id: string;
  room: { number?: string; roomType?: { name?: string } };
  priority: string;
  type: string;
  status: HKStatus;
  assignedTo?: string | null;
}

// ─── status configuration ──────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  PENDING: {
    label: 'Pending',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-400',
  },
  ASSIGNED: {
    label: 'Assigned',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-400',
  },
  CLEANING: {
    label: 'Cleaning',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    dot: 'bg-indigo-400',
  },
  CLEAN: {
    label: 'Clean',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-400',
  },
  INSPECTED: {
    label: 'Inspected ✓',
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
  },
  MAINTENANCE_REQUIRED: {
    label: 'Maint. Required',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    dot: 'bg-slate-300',
  },
};

const STATUS_NEXT: Record<string, string[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['CLEANING', 'CANCELLED'],
  CLEANING: ['CLEAN', 'MAINTENANCE_REQUIRED'],
  CLEAN: ['INSPECTED', 'MAINTENANCE_REQUIRED'],
  INSPECTED: [],
  CANCELLED: [],
  MAINTENANCE_REQUIRED: ['PENDING', 'ASSIGNED'],
};

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  gradient,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: number;
  gradient: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className={cn('p-5 rounded-2xl border shadow-sm flex flex-col gap-3', gradient)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
      </div>
      <span className="text-4xl font-extrabold">{value}</span>
    </div>
  );
}

// ─── status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    dot: 'bg-slate-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        cfg.bg,
        cfg.text,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ─── priority pill ────────────────────────────────────────────────────────────
function PriorityPill({ priority }: { priority: string }) {
  if (priority === 'HIGH' || priority === 'URGENT') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600">
        <TriangleAlert className="w-3 h-3" /> {priority}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
      {priority || 'NORMAL'}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function HousekeepingDashboard() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const { provider, isDesktopMode, isOnline } = useLodgeCoreProvider();

  const [tasks, setTasks] = useState<HKTask[]>([]);
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
      setTasks(
        data.map((task: any) => ({
          ...task,
          room: task.room || { number: task.roomNumber || '??' },
          type: task.type || task.taskType || 'CLEANING',
          assignedTo: task.assignedTo || task.assignedToUserId || null,
        })),
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, provider]);

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

  // ── guard: no property ──
  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-slate-400">
        <BedDouble className="w-16 h-16 opacity-20" />
        <p className="text-lg font-medium text-slate-500">No property selected</p>
        <p className="text-sm text-slate-400">Select a property from the top navigation to view housekeeping.</p>
      </div>
    );
  }

  // ── guard: permissions ──
  const role = String((session?.user as any)?.role || '').toUpperCase();
  const capabilities = ((session?.user as any)?.capabilities || []) as string[];
  const canManage =
    ['RECEPTIONIST', 'FRONT_DESK', 'MANAGER', 'ADMIN'].includes(role) ||
    capabilities.includes('ACCESS_MANAGEMENT');

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <ShieldCheck className="w-16 h-16 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-700">Reception-Managed</h2>
        <p className="text-sm text-slate-500 max-w-sm text-center">
          Housekeeping tasks are managed exclusively by reception staff. Contact reception for task changes.
        </p>
      </div>
    );
  }

  // ── KPI data ──
  const kpis = {
    queue: tasks.filter((t) => ['PENDING', 'ASSIGNED'].includes(t.status)).length,
    inProgress: tasks.filter((t) => t.status === 'CLEANING').length,
    readyForCheck: tasks.filter((t) => t.status === 'CLEAN').length,
    inspected: tasks.filter((t) => t.status === 'INSPECTED').length,
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-emerald-100 p-2 rounded-xl">
                <BedDouble className="w-5 h-5 text-emerald-700" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Housekeeping</h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">
              Room cleaning, inspection &amp; release control
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* connectivity badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border',
                isDesktopMode && !isOnline
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700',
              )}
            >
              {isDesktopMode && !isOnline ? (
                <><WifiOff className="w-3 h-3" /> Offline — local tasks</>
              ) : (
                <><Wifi className="w-3 h-3" /> Live task list</>
              )}
            </span>

            <Button
              variant="outline"
              onClick={fetchTasks}
              disabled={loading}
              className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCcw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Queue"
            value={kpis.queue}
            gradient="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100 text-amber-950"
            icon={Clock}
            iconBg="bg-amber-200/50"
            iconColor="text-amber-700"
          />
          <KpiCard
            label="In Progress"
            value={kpis.inProgress}
            gradient="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-100 text-indigo-950"
            icon={Sparkles}
            iconBg="bg-indigo-200/50"
            iconColor="text-indigo-700"
          />
          <KpiCard
            label="Ready for Inspection"
            value={kpis.readyForCheck}
            gradient="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 text-emerald-950"
            icon={BedDouble}
            iconBg="bg-emerald-200/50"
            iconColor="text-emerald-700"
          />
          <KpiCard
            label="Inspected & Ready"
            value={kpis.inspected}
            gradient="bg-gradient-to-br from-green-50 to-green-100/50 border-green-100 text-green-950"
            icon={ShieldCheck}
            iconBg="bg-green-200/50"
            iconColor="text-green-700"
          />
        </div>

        {/* ── Task Table ── */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
          {/* table header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              Today's Tasks
            </h2>
            <span className="bg-slate-100 text-slate-600 py-1 px-3 rounded-full text-xs font-bold">
              {tasks.length} tasks
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="font-medium">Loading tasks…</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <BedDouble className="w-12 h-12 opacity-20" />
              <p className="font-medium">No housekeeping tasks for today.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/70 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Room</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Task</th>
                    <th className="px-6 py-4 font-semibold">Priority</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Assigned To</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((task) => {
                    const nextOptions = STATUS_NEXT[task.status] || [];
                    const isManaging = managingTaskId === task.id;
                    const isSaving = savingTaskId === task.id;

                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-slate-50/60 transition-colors group"
                      >
                        {/* Room number */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm group-hover:bg-slate-200 transition-colors">
                              {formatRoomNumber(task.room?.number) || '??'}
                            </div>
                          </div>
                        </td>

                        {/* Room type */}
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {task.room?.roomType?.name || '—'}
                        </td>

                        {/* Task type */}
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {task.type.replace(/_/g, ' ')}
                        </td>

                        {/* Priority */}
                        <td className="px-6 py-4">
                          <PriorityPill priority={task.priority} />
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <StatusPill status={task.status} />
                        </td>

                        {/* Assigned to */}
                        <td className="px-6 py-4">
                          {task.assignedTo ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                                {task.assignedTo.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs text-slate-600 font-medium">
                                Staff …{task.assignedTo.slice(-4)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Unassigned</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-right">
                          {isManaging ? (
                            <div className="flex items-center justify-end gap-2">
                              {/* styled native select */}
                              <div className="relative">
                                <select
                                  value={selectedStatus}
                                  onChange={(e) => setSelectedStatus(e.target.value)}
                                  className="appearance-none h-9 rounded-xl border border-slate-200 bg-white pr-8 pl-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Update status…</option>
                                  {nextOptions.map((s) => (
                                    <option key={s} value={s}>
                                      {s.replace(/_/g, ' ')}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                              </div>

                              <Button
                                size="icon"
                                className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                onClick={() => saveTaskStatus(task.id)}
                                disabled={!selectedStatus || isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                onClick={() => setManagingTaskId(null)}
                                disabled={isSaving}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'rounded-xl px-4 font-semibold text-xs border-slate-200 shadow-sm transition-all',
                                nextOptions.length === 0
                                  ? 'opacity-40 cursor-not-allowed'
                                  : 'hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 hover:-translate-y-0.5',
                              )}
                              onClick={() => {
                                setManagingTaskId(task.id);
                                setSelectedStatus('');
                              }}
                              disabled={nextOptions.length === 0}
                            >
                              {nextOptions.length === 0 ? 'Done' : 'Update'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
