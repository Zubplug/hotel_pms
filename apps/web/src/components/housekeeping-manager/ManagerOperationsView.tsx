'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BedDouble, Check, ChevronDown, CircleAlert, ClipboardCheck,
  DoorOpen, Filter, Loader2, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Wrench, X,
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { useProperty } from '@/components/PropertyProvider';
import { cn } from '@/lib/utils';
import type {
  HousekeepingTask, MaintenanceTicket, ManagerMetrics, OperationalRoom, ViewMode,
} from './types';

const taskLabels: Record<string, string> = {
  CHECKOUT: 'Checkout clean', STAYOVER: 'Stayover', DEEP_CLEAN: 'Deep clean',
  INSPECTION: 'Inspection', TURNDOWN: 'Turndown', CLEANING: 'Cleaning',
};
const statusLabels: Record<string, string> = {
  PENDING: 'Pending', ASSIGNED: 'Assigned', CLEANING: 'Cleaning', CLEAN: 'Clean',
  INSPECTED: 'Inspected', MAINTENANCE_REQUIRED: 'Maintenance required', CANCELLED: 'Cancelled',
  OPEN: 'Open', IN_PROGRESS: 'In progress', WAITING_PARTS: 'Waiting parts', RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
const taskTransitions: Record<string, string[]> = { CLEANING: ['INSPECTED', 'MAINTENANCE_REQUIRED'], MAINTENANCE_REQUIRED: ['CLEANING'] };
const ticketTransitions: Record<string, string[]> = {
  OPEN: ['ASSIGNED', 'CANCELLED'], ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'RESOLVED', 'CANCELLED'], WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
};

function tone(value: string) {
  if (['INSPECTED', 'RESOLVED', 'CLEAN'].includes(value)) return 'emerald';
  if (['MAINTENANCE_REQUIRED', 'CRITICAL', 'URGENT', 'CANCELLED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'].includes(value)) return 'rose';
  if (['CLEANING', 'IN_PROGRESS', 'ASSIGNED', 'OCCUPIED'].includes(value)) return 'cyan';
  if (['HIGH', 'WAITING_PARTS', 'MAINTENANCE', 'DIRTY'].includes(value)) return 'amber';
  return 'slate';
}

function Badge({ value, label }: { value: string; label?: string }) {
  const colors: Record<string, string> = {
    slate: 'border-white/10 bg-white/[0.05] text-slate-400', cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-300', amber: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    rose: 'border-rose-300/20 bg-rose-300/10 text-rose-300',
  };
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]', colors[tone(value)])}>{label || statusLabels[value] || value.replaceAll('_', ' ')}</span>;
}

function Button({ children, variant = 'secondary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button className={cn('inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-cyan-300 text-[#06202a] shadow-lg shadow-cyan-950/30 hover:bg-cyan-200', variant === 'secondary' && 'border border-white/10 bg-white/[0.05] text-slate-300 hover:border-cyan-300/25 hover:bg-white/[0.08] hover:text-white', variant === 'quiet' && 'text-slate-500 hover:bg-white/[0.05] hover:text-white', className)} {...props}>{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-400"><span className="mb-2 block uppercase tracking-[0.12em] text-slate-600">{label}</span>{children}</label>;
}

function EmptyState({ title, detail, icon: Icon = ClipboardCheck }: { title: string; detail: string; icon?: React.ElementType }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-600"><Icon className="h-5 w-5" /></span><p className="mt-4 text-sm font-semibold text-slate-300">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-600">{detail}</p></div>;
}

export default function ManagerOperationsView({ mode }: { mode: ViewMode }) {
  const { data: session } = useLodgeCoreSession();
  const { propertyId: selectedPropertyId } = useProperty();
  // This workspace is property-scoped by the manager's role. Do not let the
  // organization-wide property selector replace the property assigned to the
  // authenticated housekeeping manager.
  const propertyId = session?.user?.propertyId || selectedPropertyId;
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [rooms, setRooms] = useState<OperationalRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [selected, setSelected] = useState<HousekeepingTask | MaintenanceTicket | null>(null);
  const [dialog, setDialog] = useState<'task' | 'ticket' | 'new-task' | 'new-ticket' | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!propertyId) return;
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [taskResponse, ticketResponse, roomResponse] = await Promise.all([
        fetch(`/api/v1/housekeeping/tasks?propertyId=${propertyId}`, { cache: 'no-store' }),
        fetch(`/api/v1/maintenance/tickets?propertyId=${propertyId}`, { cache: 'no-store' }),
        fetch(`/api/v1/rooms?propertyId=${propertyId}&pageSize=100&sortBy=number&sortOrder=asc`, { cache: 'no-store' }),
      ]);
      const [taskJson, ticketJson, roomJson] = await Promise.all([taskResponse.json(), ticketResponse.json(), roomResponse.json()]);
      if (!taskResponse.ok) throw new Error(taskJson.error?.message || taskJson.error || 'Unable to load housekeeping tasks');
      if (!ticketResponse.ok) throw new Error(ticketJson.error?.message || ticketJson.error || 'Unable to load maintenance tickets');
      if (!roomResponse.ok) throw new Error(roomJson.error?.message || roomJson.error || 'Unable to load rooms');
      const firstRoomPage = Array.isArray(roomJson.data) ? roomJson.data : roomJson.data?.data || [];
      const totalRoomPages = Number(roomJson.meta?.totalPages || 1);
      const additionalRoomResponses = totalRoomPages > 1
        ? await Promise.all(Array.from({ length: totalRoomPages - 1 }, (_, index) => fetch(`/api/v1/rooms?propertyId=${propertyId}&page=${index + 2}&pageSize=100&sortBy=number&sortOrder=asc`, { cache: 'no-store' })))
        : [];
      const additionalRoomPayloads = await Promise.all(additionalRoomResponses.map(async (response) => {
        if (!response.ok) throw new Error('Unable to load all property rooms');
        return response.json();
      }));
      const allRooms = [
        ...firstRoomPage,
        ...additionalRoomPayloads.flatMap((payload) => Array.isArray(payload.data) ? payload.data : payload.data?.data || []),
      ];
      setTasks(Array.isArray(taskJson.data) ? taskJson.data : []);
      setTickets(Array.isArray(ticketJson.data) ? ticketJson.data : ticketJson.data?.tickets || []);
      setRooms(allRooms);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Unable to load operational data'); } finally { setLoading(false); setRefreshing(false); }
  }, [propertyId]);

  // The loader is an async synchronization with the selected property.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo<ManagerMetrics>(() => ({
    totalRooms: rooms.length,
    readyRooms: rooms.filter((room) => ['AVAILABLE', 'INSPECTED', 'CLEAN'].includes(room.status) && room.housekeepingStatus === 'INSPECTED').length,
    cleaningRooms: rooms.filter((room) => ['CLEANING', 'DIRTY'].includes(room.status) || room.housekeepingStatus === 'CLEANING').length,
    blockedRooms: rooms.filter((room) => ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'].includes(room.status)).length,
    cleaningQueue: tasks.filter((task) => !['INSPECTED', 'CANCELLED'].includes(task.status)).length,
    inspected: tasks.filter((task) => task.status === 'INSPECTED').length,
    openTickets: tickets.filter((ticket) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)).length,
    criticalTickets: tickets.filter((ticket) => ticket.priority === 'CRITICAL' && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)).length,
  }), [rooms, tasks, tickets]);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const haystack = `${task.room?.number || ''} ${task.room?.roomType?.name || ''} ${task.type} ${task.notes || ''}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (statusFilter === 'ALL' || task.status === statusFilter) && (priorityFilter === 'ALL' || task.priority === priorityFilter);
  }), [priorityFilter, query, statusFilter, tasks]);
  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    const haystack = `${ticket.title} ${ticket.description} ${ticket.roomNumber || ''} ${ticket.location || ''}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (statusFilter === 'ALL' || ticket.status === statusFilter) && (priorityFilter === 'ALL' || ticket.priority === priorityFilter);
  }), [priorityFilter, query, statusFilter, tickets]);

  async function updateRecord(record: HousekeepingTask | MaintenanceTicket, nextStatus: string, type: 'task' | 'ticket') {
    setSaving(true); setError('');
    try {
      const endpoint = type === 'task' ? `/api/v1/housekeeping/tasks/${record.id}/status` : `/api/v1/maintenance/tickets/${record.id}/status`;
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || json.error || 'Unable to update record');
      setDialog(null); setSelected(null); await load(true);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Unable to update record'); } finally { setSaving(false); }
  }

  async function createRecord(type: 'task' | 'ticket', values: Record<string, string | boolean>) {
    if (!propertyId) return;
    setSaving(true); setError('');
    try {
      const endpoint = type === 'task' ? '/api/v1/housekeeping/tasks' : '/api/v1/maintenance/tickets';
      const body = type === 'task' ? { ...values, propertyId } : { ...values, propertyId, description: values.description || values.title };
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || json.error || `Unable to create ${type}`);
      setDialog(null); await load(true);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : `Unable to create ${type}`); } finally { setSaving(false); }
  }

  if (!propertyId) return <div className="flex min-h-[70vh] items-center justify-center p-8 text-center text-slate-500">No property is assigned to this account.</div>;
  if (loading) return <div className="flex min-h-[70vh] items-center justify-center text-slate-500"><Loader2 className="mr-3 h-5 w-5 animate-spin text-cyan-300" />Loading your operations desk…</div>;

  const title = mode === 'overview' ? 'Operations command center' : mode === 'tasks' ? 'Housekeeping control' : mode === 'maintenance' ? 'Engineering control' : mode === 'rooms' ? 'Room readiness' : 'Performance intelligence';
  const subtitle = mode === 'overview' ? 'Protect the guest journey by keeping every room clean, inspected, and sellable.' : mode === 'tasks' ? 'Coordinate room turns, inspections, and service standards across the property.' : mode === 'maintenance' ? 'Resolve engineering risk before it becomes a guest experience issue.' : mode === 'rooms' ? 'A live inventory view of room availability, cleaning progress, and operational blockers.' : 'Measure service throughput, readiness, and unresolved property risk.';

  return <div className="mx-auto max-w-[1540px] space-y-7 px-4 py-7 sm:px-8 sm:py-9">
    <PageHeader title={title} subtitle={subtitle} mode={mode} refreshing={refreshing} onRefresh={() => load(true)} onNewTask={() => setDialog('new-task')} onNewTicket={() => setDialog('new-ticket')} />
    {error && <div className="flex items-center justify-between rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"><span className="flex items-center gap-2"><CircleAlert className="h-4 w-4" />{error}</span><button onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}
    <MetricStrip metrics={metrics} />
    {mode === 'overview' && <Overview tasks={tasks} tickets={tickets} metrics={metrics} onTask={(task) => { setSelected(task); setDialog('task'); }} onTicket={(ticket) => { setSelected(ticket); setDialog('ticket'); }} />}
    {mode === 'tasks' && <RecordRegister type="task" records={visibleTasks} query={query} status={statusFilter} priority={priorityFilter} setQuery={setQuery} setStatus={setStatusFilter} setPriority={setPriorityFilter} onCreate={() => setDialog('new-task')} onSelect={(record) => { setSelected(record); setDialog('task'); }} />}
    {mode === 'maintenance' && <RecordRegister type="ticket" records={visibleTickets} query={query} status={statusFilter} priority={priorityFilter} setQuery={setQuery} setStatus={setStatusFilter} setPriority={setPriorityFilter} onCreate={() => setDialog('new-ticket')} onSelect={(record) => { setSelected(record); setDialog('ticket'); }} />}
    {mode === 'rooms' && <RoomBoard rooms={rooms} tasks={tasks} tickets={tickets} query={query} setQuery={setQuery} />}
    {mode === 'reports' && <Reports tasks={tasks} tickets={tickets} metrics={metrics} />}
    {dialog === 'task' && selected && <RecordDialog type="task" record={selected as HousekeepingTask} saving={saving} onClose={() => { setDialog(null); setSelected(null); }} onStatus={(status) => updateRecord(selected, status, 'task')} />}
    {dialog === 'ticket' && selected && <RecordDialog type="ticket" record={selected as MaintenanceTicket} saving={saving} onClose={() => { setDialog(null); setSelected(null); }} onStatus={(status) => updateRecord(selected, status, 'ticket')} />}
    {dialog === 'new-task' && <CreateTaskDialog rooms={rooms} saving={saving} onClose={() => setDialog(null)} onSave={(values) => createRecord('task', values)} />}
    {dialog === 'new-ticket' && <CreateTicketDialog rooms={rooms} saving={saving} onClose={() => setDialog(null)} onSave={(values) => createRecord('ticket', values)} />}
  </div>;
}

function PageHeader({ title, subtitle, mode, refreshing, onRefresh, onNewTask, onNewTicket }: { title: string; subtitle: string; mode: ViewMode; refreshing: boolean; onRefresh: () => void; onNewTask: () => void; onNewTicket: () => void }) {
  return <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300"><Sparkles className="h-3.5 w-3.5" />LodgeCore operations</div><h1 className="text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p></div><div className="flex flex-wrap items-center gap-2"><Button onClick={onRefresh} aria-label="Refresh operations"><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />Refresh</Button>{mode === 'tasks' || mode === 'overview' ? <Button variant="primary" onClick={onNewTask}><Plus className="h-4 w-4" />New room task</Button> : null}{mode === 'maintenance' || mode === 'overview' ? <Button variant={mode === 'maintenance' ? 'primary' : 'secondary'} onClick={onNewTicket}><Wrench className="h-4 w-4" />Report issue</Button> : null}</div></div>;
}

function MetricStrip({ metrics }: { metrics: ManagerMetrics }) {
  const items = [{ label: 'Ready to sell', value: metrics.readyRooms, detail: `${metrics.totalRooms ? Math.round((metrics.readyRooms / metrics.totalRooms) * 100) : 0}% of inventory`, icon: DoorOpen, color: 'emerald' }, { label: 'Cleaning queue', value: metrics.cleaningQueue, detail: 'Tasks requiring movement', icon: Sparkles, color: 'cyan' }, { label: 'Open engineering', value: metrics.openTickets, detail: `${metrics.criticalTickets} critical exposure`, icon: Wrench, color: 'amber' }, { label: 'Blocked rooms', value: metrics.blockedRooms, detail: 'Out of order or service', icon: CircleAlert, color: 'rose' }];
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(({ label, value, detail, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><Icon className={cn('h-4 w-4', color === 'emerald' && 'text-emerald-300', color === 'cyan' && 'text-cyan-300', color === 'amber' && 'text-amber-300', color === 'rose' && 'text-rose-300')} /></div><p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-600">{detail}</p></div>)}</div>;
}

function Overview({ tasks, tickets, metrics, onTask, onTicket }: { tasks: HousekeepingTask[]; tickets: MaintenanceTicket[]; metrics: ManagerMetrics; onTask: (task: HousekeepingTask) => void; onTicket: (ticket: MaintenanceTicket) => void }) {
  const priorities = [...tickets].filter((ticket) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)).sort((a, b) => (a.priority === 'CRITICAL' ? -1 : 1) - (b.priority === 'CRITICAL' ? -1 : 1)).slice(0, 5);
  return <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5"><div className="mb-5 flex items-start justify-between"><div><h2 className="font-semibold text-white">Today&apos;s operating pulse</h2><p className="mt-1 text-xs text-slate-500">The queues most likely to affect room readiness.</p></div><Badge value="LIVE" label="Live feed" /></div><div className="grid gap-3 lg:grid-cols-2">{tasks.slice(0, 6).map((task) => <button key={task.id} onClick={() => onTask(task)} className="rounded-xl border border-white/[0.06] bg-[#0a1728] p-4 text-left transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04]"><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><BedDouble className="h-4 w-4" /></span><Badge value={task.status} /></div><p className="mt-4 text-sm font-semibold text-slate-200">Room {task.room?.number || '—'} <span className="font-normal text-slate-500">· {taskLabels[task.type] || task.type}</span></p><p className="mt-1 truncate text-xs text-slate-600">{task.room?.roomType?.name || 'Guest room'} · {task.notes || 'No manager note'}</p></button>)}{!tasks.length && <div className="lg:col-span-2"><EmptyState title="No active room tasks" detail="The property has no housekeeping tasks in today&apos;s operating feed." /></div>}</div></section><div className="space-y-5"><section className="rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.12] to-emerald-300/[0.04] p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">Manager brief</p><h2 className="mt-2 text-xl font-semibold text-white">Protect the arrival window</h2></div><ShieldCheck className="h-5 w-5 text-cyan-200" /></div><p className="mt-4 text-sm leading-6 text-slate-400">Prioritise blocked rooms, then move clean rooms through inspection. Only inspected rooms should return to the front desk inventory.</p><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#07111f]/50 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-600">Inspected today</p><p className="mt-1 text-xl font-semibold text-white">{metrics.inspected}</p></div><div className="rounded-xl bg-[#07111f]/50 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-600">At risk</p><p className="mt-1 text-xl font-semibold text-rose-300">{metrics.blockedRooms + metrics.criticalTickets}</p></div></div></section><section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Engineering watchlist</h2><p className="mt-1 text-xs text-slate-500">Open issues requiring ownership.</p></div><Link href="/housekeeping-manager/maintenance" className="text-xs font-semibold text-cyan-300">View all</Link></div><div className="space-y-2">{priorities.map((ticket) => <button key={ticket.id} onClick={() => onTicket(ticket)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.04]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-300/10 text-amber-300"><Wrench className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-300">{ticket.title}</span><span className="block text-[11px] text-slate-600">Room {ticket.roomNumber || ticket.location || '—'}</span></span><Badge value={ticket.priority} /></button>)}{!priorities.length && <p className="py-5 text-center text-xs text-slate-600">No open engineering issues.</p>}</div></section></div></div>;
}

function RecordRegister({ type, records, query, status, priority, setQuery, setStatus, setPriority, onCreate, onSelect }: { type: 'task' | 'ticket'; records: (HousekeepingTask | MaintenanceTicket)[]; query: string; status: string; priority: string; setQuery: (value: string) => void; setStatus: (value: string) => void; setPriority: (value: string) => void; onCreate: () => void; onSelect: (record: HousekeepingTask | MaintenanceTicket) => void }) {
  const isTask = type === 'task';
  return <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]"><div className="border-b border-white/[0.07] p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><h2 className="font-semibold text-white">{isTask ? 'Room task register' : 'Maintenance ticket register'}</h2><p className="mt-1 text-xs text-slate-500">{records.length} records in the current operating view.</p></div><Button variant="primary" onClick={onCreate}><Plus className="h-4 w-4" />{isTask ? 'Create task' : 'Report issue'}</Button></div><div className="mt-5 grid gap-2 md:grid-cols-[1fr_180px_180px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isTask ? 'Search room, type, or notes…' : 'Search issue, room, or location…'} className="w-full rounded-xl border border-white/10 bg-[#07111f] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-700 focus:border-cyan-300/40" /></div><Select value={status} onChange={setStatus} options={['ALL', ...(isTask ? ['CLEANING', 'INSPECTED', 'MAINTENANCE_REQUIRED'] : ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED'])]} /><Select value={priority} onChange={setPriority} options={['ALL', 'LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']} /></div></div><div className="divide-y divide-white/[0.06]">{records.map((record) => isTask ? <TaskRow key={record.id} task={record as HousekeepingTask} onSelect={() => onSelect(record)} /> : <TicketRow key={record.id} ticket={record as MaintenanceTicket} onSelect={() => onSelect(record)} />)}{!records.length && <div className="p-10"><EmptyState title="Nothing matches this view" detail="Try clearing a filter or create a new operational record." icon={Filter} /></div>}</div></section>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <div className="relative"><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none rounded-xl border border-white/10 bg-[#07111f] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 outline-none focus:border-cyan-300/40">{options.map((option) => <option key={option} value={option}>{option === 'ALL' ? 'All records' : option.replaceAll('_', ' ')}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /></div>; }
function TaskRow({ task, onSelect }: { task: HousekeepingTask; onSelect: () => void }) { return <button onClick={onSelect} className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white/[0.025] sm:px-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><BedDouble className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-200">Room {task.room?.number || '—'} <span className="font-normal text-slate-500">· {taskLabels[task.type] || task.type}</span></span><span className="mt-1 block truncate text-xs text-slate-600">{task.room?.roomType?.name || 'Guest room'} · {task.notes || 'No notes recorded'}</span></span><span className="hidden items-center gap-2 sm:flex"><Badge value={task.priority} /><Badge value={task.status} /></span><ArrowRight className="h-4 w-4 shrink-0 text-slate-700" /></button>; }
function TicketRow({ ticket, onSelect }: { ticket: MaintenanceTicket; onSelect: () => void }) { return <button onClick={onSelect} className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white/[0.025] sm:px-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300"><Wrench className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-200">{ticket.title}</span><span className="mt-1 block truncate text-xs text-slate-600">Room {ticket.roomNumber || ticket.location || '—'} · {ticket.description}</span></span><span className="hidden items-center gap-2 sm:flex"><Badge value={ticket.priority} /><Badge value={ticket.status} /></span><ArrowRight className="h-4 w-4 shrink-0 text-slate-700" /></button>; }

function RoomBoard({ rooms, tasks, tickets, query, setQuery }: { rooms: OperationalRoom[]; tasks: HousekeepingTask[]; tickets: MaintenanceTicket[]; query: string; setQuery: (value: string) => void }) { const filtered = rooms.filter((room) => `${room.number} ${room.roomType?.name || ''} ${room.floor?.name || ''}`.toLowerCase().includes(query.toLowerCase())); return <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-white">Live room readiness board</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} rooms · readiness combines PMS, housekeeping, and engineering signals.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search room or type…" className="w-full rounded-xl border border-white/10 bg-[#07111f] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-700 focus:border-cyan-300/40" /></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((room) => { const task = tasks.find((candidate) => candidate.roomId === room.id); const blocked = ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'].includes(room.status) || tickets.some((ticket) => ticket.roomId === room.id && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)); const state = blocked ? 'BLOCKED' : room.housekeepingStatus || room.status; return <div key={room.id} className="rounded-2xl border border-white/[0.07] bg-[#0a1728] p-4"><div className="flex items-start justify-between"><div><p className="text-2xl font-semibold tracking-tight text-white">{room.number}</p><p className="mt-1 text-xs text-slate-500">{room.roomType?.name || 'Guest room'} · {room.floor?.name || 'Floor —'}</p></div><Badge value={state} label={blocked ? 'Blocked' : statusLabels[state] || state.replaceAll('_', ' ')} /></div><div className="mt-5 space-y-2 border-t border-white/[0.06] pt-3 text-xs"><div className="flex justify-between"><span className="text-slate-600">PMS status</span><span className="text-slate-300">{room.status}</span></div><div className="flex justify-between"><span className="text-slate-600">Current task</span><span className="max-w-[140px] truncate text-right text-slate-300">{task ? taskLabels[task.type] || task.type : 'No active task'}</span></div></div></div>; })}{!filtered.length && <div className="col-span-full"><EmptyState title="No rooms found" detail="Try another room number, floor, or room type." icon={DoorOpen} /></div>}</div></section>; }

function Reports({ tasks, tickets, metrics }: { tasks: HousekeepingTask[]; tickets: MaintenanceTicket[]; metrics: ManagerMetrics }) { const inspectedRate = tasks.length ? Math.round((metrics.inspected / tasks.length) * 100) : 0; const resolutionRate = tickets.length ? Math.round((tickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length / tickets.length) * 100) : 0; const cards = [{ label: 'Inspection completion', value: `${inspectedRate}%`, detail: `${metrics.inspected} of ${tasks.length} tracked tasks inspected`, icon: ClipboardCheck, color: 'emerald' }, { label: 'Engineering resolution', value: `${resolutionRate}%`, detail: `${tickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length} of ${tickets.length} tickets resolved`, icon: Wrench, color: 'cyan' }, { label: 'Room readiness', value: `${metrics.totalRooms ? Math.round((metrics.readyRooms / metrics.totalRooms) * 100) : 0}%`, detail: `${metrics.readyRooms} rooms currently sellable`, icon: DoorOpen, color: 'amber' }]; return <div className="space-y-5"><div className="grid gap-4 lg:grid-cols-3">{cards.map(({ label, value, detail, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><Icon className={cn('h-5 w-5', color === 'emerald' ? 'text-emerald-300' : color === 'cyan' ? 'text-cyan-300' : 'text-amber-300')} /></div><p className="mt-5 text-4xl font-semibold text-white">{value}</p><p className="mt-2 text-sm text-slate-500">{detail}</p></div>)}</div><section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Operational health</h2><p className="mt-1 text-xs text-slate-500">A manager&apos;s view of where attention is accumulating.</p></div><Badge value="REPORT" label="Live calculation" /></div><div className="mt-6 space-y-5"><Progress label="Room readiness" value={metrics.totalRooms ? (metrics.readyRooms / metrics.totalRooms) * 100 : 0} detail={`${metrics.readyRooms} ready of ${metrics.totalRooms} rooms`} color="bg-emerald-300" /><Progress label="Inspection completion" value={inspectedRate} detail={`${metrics.inspected} inspections completed`} color="bg-cyan-300" /><Progress label="Engineering resolution" value={resolutionRate} detail={`${metrics.openTickets} issues remain open`} color="bg-amber-300" /></div></section></div>; }
function Progress({ label, value, detail, color }: { label: string; value: number; detail: string; color: string }) { return <div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-slate-300">{label}</span><span className="text-xs text-slate-500">{detail}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div></div>; }

function RecordDialog({ type, record, saving, onClose, onStatus }: { type: 'task' | 'ticket'; record: HousekeepingTask | MaintenanceTicket; saving: boolean; onClose: () => void; onStatus: (status: string) => void }) { const isTask = type === 'task'; const task = record as HousekeepingTask; const ticket = record as MaintenanceTicket; const currentStatus = record.status; const nextStatuses = isTask ? (taskTransitions[currentStatus] || []) : (ticketTransitions[currentStatus] || []); return <Modal title={isTask ? `Room ${task.room?.number || '—'} task` : ticket.title} eyebrow={isTask ? 'Housekeeping review' : 'Engineering review'} onClose={onClose}><div className="space-y-5"><div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"><span className="text-sm text-slate-500">Current status</span><Badge value={currentStatus} /></div>{!isTask && currentStatus === 'OPEN' && <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">New engineering task</p><p className="mt-1 text-sm leading-6 text-slate-300">A room was restricted by Front Desk. Acknowledge it to take ownership and move the work into active engineering control.</p></div>}<div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-[#07111f] p-4 text-xs"><div><p className="text-slate-600">{isTask ? 'Room type' : 'Location'}</p><p className="mt-1 font-semibold text-slate-300">{isTask ? task.room?.roomType?.name || 'Guest room' : ticket.roomNumber || ticket.location || 'General area'}</p></div><div><p className="text-slate-600">Priority</p><p className="mt-1 font-semibold text-slate-300">{record.priority}</p></div></div><p className="text-sm leading-6 text-slate-400">{isTask ? task.notes || 'No additional operational notes have been recorded.' : ticket.description}</p><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">Move workflow forward</p><div className="grid gap-2 sm:grid-cols-2">{nextStatuses.map((status) => <Button key={status} disabled={saving} onClick={() => onStatus(status)} variant="secondary"><Check className="h-4 w-4 text-cyan-300" />{saving ? 'Saving…' : !isTask && currentStatus === 'OPEN' && status === 'ASSIGNED' ? 'Acknowledge issue' : statusLabels[status] || status.replaceAll('_', ' ')}</Button>)}{!nextStatuses.length && <p className="text-sm text-slate-600">No further actions are available for this record.</p>}</div></div></div></Modal>; }

function CreateTaskDialog({ rooms, saving, onClose, onSave }: { rooms: OperationalRoom[]; saving: boolean; onClose: () => void; onSave: (values: Record<string, string | boolean>) => void }) { const [values, setValues] = useState({ roomId: '', type: 'CHECKOUT', priority: 'NORMAL', notes: '' }); return <Modal title="Create room task" eyebrow="Housekeeping control" onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(values); }}><Field label="Room"><select required value={values.roomId} onChange={(event) => setValues({ ...values, roomId: event.target.value })} className="field"><option value="">Select a room</option>{rooms.map((room) => <option key={room.id} value={room.id}>Room {room.number} · {room.roomType?.name || 'Guest room'}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Task type"><select value={values.type} onChange={(event) => setValues({ ...values, type: event.target.value })} className="field">{['CHECKOUT', 'STAYOVER', 'DEEP_CLEAN', 'INSPECTION', 'TURNDOWN'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></Field><Field label="Priority"><select value={values.priority} onChange={(event) => setValues({ ...values, priority: event.target.value })} className="field">{['LOW', 'NORMAL', 'HIGH', 'VIP', 'EARLY_ARRIVAL'].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field></div><Field label="Manager note"><textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} className="field min-h-24" placeholder="Add arrival, VIP, or service context…" /></Field><DialogActions saving={saving} submitLabel="Create task" /></form></Modal>; }

function CreateTicketDialog({ rooms, saving, onClose, onSave }: { rooms: OperationalRoom[]; saving: boolean; onClose: () => void; onSave: (values: Record<string, string | boolean>) => void }) { const [values, setValues] = useState({ roomId: '', title: '', description: '', priority: 'NORMAL', location: '' }); return <Modal title="Report engineering issue" eyebrow="Maintenance control" onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(values); }}><Field label="Issue title"><input required value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} className="field" placeholder="e.g. Air conditioning not cooling" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Room"><select value={values.roomId} onChange={(event) => setValues({ ...values, roomId: event.target.value })} className="field"><option value="">Common area / select room</option>{rooms.map((room) => <option key={room.id} value={room.id}>Room {room.number}</option>)}</select></Field><Field label="Priority"><select value={values.priority} onChange={(event) => setValues({ ...values, priority: event.target.value })} className="field">{['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map((value) => <option key={value}>{value}</option>)}</select></Field></div><Field label="Location (if not a room)"><input value={values.location} onChange={(event) => setValues({ ...values, location: event.target.value })} className="field" placeholder="e.g. Pool deck, lobby, service corridor" /></Field><Field label="Description"><textarea required value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} className="field min-h-24" placeholder="Describe the issue and guest impact…" /></Field><DialogActions saving={saving} submitLabel="Create issue" /></form></Modal>; }

function DialogActions({ saving, submitLabel }: { saving: boolean; submitLabel: string }) { return <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-4"><Button type="submit" disabled={saving} variant="primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}</Button></div>; }
function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1b2d] shadow-2xl"><div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p><h2 className="mt-2 text-xl font-semibold text-white">{title}</h2></div><button onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close dialog"><X className="h-5 w-5" /></button></div><div className="px-6 py-6">{children}</div></div></div>; }
