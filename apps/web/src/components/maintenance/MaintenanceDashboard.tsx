'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Wrench,
  Plus,
  Search,
  Clock,
  TriangleAlert,
  CircleCheck,
  Loader2,
  WifiOff,
  Wifi,
  ChevronDown,
  AlertCircle,
  X,
  CircleDot,
  Ban,
  Hourglass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── types ────────────────────────────────────────────────────────────────────
interface Ticket {
  id: string;
  issueDescription: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  roomId: string;
  roomNumber: string;
  requiresRoomRestriction: boolean;
  createdAt: string;
  assignedTo?: string | null;
}

// ─── priority config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  URGENT: { label: 'Urgent', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  HIGH: { label: 'High', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  NORMAL: { label: 'Normal', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  LOW: { label: 'Low', bg: 'bg-slate-50', text: 'text-slate-400', border: 'border-slate-100' },
};

// ─── status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string; Icon: React.ElementType }
> = {
  OPEN: { label: 'Open', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400', Icon: CircleDot },
  ASSIGNED: { label: 'Assigned', bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400', Icon: CircleDot },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400', Icon: Loader2 },
  WAITING_PARTS: { label: 'Waiting Parts', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400', Icon: Hourglass },
  RESOLVED: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', Icon: CircleCheck },
  CLOSED: { label: 'Closed', bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-300', Icon: Ban },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-300', Icon: X },
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

// ─── priority pill ────────────────────────────────────────────────────────────
function PriorityPill({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.NORMAL;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border',
        cfg.bg,
        cfg.text,
        cfg.border,
      )}
    >
      {(priority === 'URGENT' || priority === 'HIGH') && (
        <TriangleAlert className="w-3 h-3" />
      )}
      {cfg.label}
    </span>
  );
}

// ─── status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    dot: 'bg-slate-300',
    Icon: CircleDot,
  };
  const isSpinning = status === 'IN_PROGRESS';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        cfg.bg,
        cfg.text,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot, isSpinning && 'animate-pulse')} />
      {cfg.label}
    </span>
  );
}

// ─── ticket age helper ────────────────────────────────────────────────────────
function ticketAge(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── main component ───────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const { propertyId } = useProperty();
  const { provider, isDesktopMode, isOnline } = useLodgeCoreProvider();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    roomId: '',
    roomNumber: '',
    issueDescription: '',
    priority: 'NORMAL',
    requiresRoomRestriction: false,
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);

  const loadData = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const [ticketsResult, roomsResult] = await Promise.all([
        provider.maintenance.list(propertyId),
        provider.rooms.list(propertyId)
      ]);
      
      const ticketsData = Array.isArray(ticketsResult) ? ticketsResult : (ticketsResult as any)?.data || [];
      setTickets(
        ticketsData.map((ticket: any) => ({
          ...ticket,
          issueDescription:
            ticket.issueDescription || ticket.description || ticket.title || 'Maintenance issue',
          roomNumber: ticket.roomNumber || ticket.room?.number || '',
          priority: ticket.priority || 'NORMAL',
          status: ticket.status || 'OPEN',
          requiresRoomRestriction: Boolean(ticket.requiresRoomRestriction),
        })),
      );

      const roomsData = Array.isArray(roomsResult) ? roomsResult : (roomsResult as any)?.data || [];
      setRooms(roomsData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, provider]);

  const createTicket = async () => {
    if (!newTicket.issueDescription.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await provider.maintenance.createTicket({ ...newTicket, propertyId });
      setNewTicket({
        roomId: '',
        roomNumber: '',
        issueDescription: '',
        priority: 'NORMAL',
        requiresRoomRestriction: false,
      });
      setShowNewTicket(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  const resolveTicket = async (id: string) => {
    setResolving(id);
    try {
      await provider.maintenance.resolveTicket(id);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update ticket');
    } finally {
      setResolving(null);
    }
  };

  // ── derived ──
  const filtered = tickets.filter(
    (t) =>
      t.issueDescription.toLowerCase().includes(search.toLowerCase()) ||
      t.roomNumber.toLowerCase().includes(search.toLowerCase()),
  );

  const kpis = {
    open: tickets.filter((t) => t.status === 'OPEN').length,
    inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
    resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
    urgent: tickets.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH').length,
  };

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-slate-400">
        <Wrench className="w-16 h-16 opacity-20" />
        <p className="text-lg font-medium text-slate-500">No property selected</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-orange-100 p-2 rounded-xl">
                <Wrench className="w-5 h-5 text-orange-700" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Maintenance</h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">
              Property issues, repair tickets &amp; room restrictions
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
                <><WifiOff className="w-3 h-3" /> Offline</>
              ) : (
                <><Wifi className="w-3 h-3" /> Live</>
              )}
            </span>

            <DialogTrigger
              render={<Button className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all font-semibold" />}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </DialogTrigger>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Open"
            value={kpis.open}
            gradient="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100 text-blue-950"
            icon={CircleDot}
            iconBg="bg-blue-200/50"
            iconColor="text-blue-700"
          />
          <KpiCard
            label="In Progress"
            value={kpis.inProgress}
            gradient="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100 text-amber-950"
            icon={Loader2}
            iconBg="bg-amber-200/50"
            iconColor="text-amber-700"
          />
          <KpiCard
            label="Resolved"
            value={kpis.resolved}
            gradient="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 text-emerald-950"
            icon={CircleCheck}
            iconBg="bg-emerald-200/50"
            iconColor="text-emerald-700"
          />
          <KpiCard
            label="High Priority"
            value={kpis.urgent}
            gradient="bg-gradient-to-br from-red-50 to-red-100/50 border-red-100 text-red-950"
            icon={TriangleAlert}
            iconBg="bg-red-200/50"
            iconColor="text-red-700"
          />
        </div>

        {/* ── New Ticket Form ── */}
        <DialogContent className="max-w-2xl rounded-2xl p-0">
            <DialogHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-600" />
                New Maintenance Ticket
              </DialogTitle>
            </DialogHeader>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Room <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none h-10 rounded-xl border border-slate-200 bg-white pr-9 pl-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={newTicket.roomId}
                    onChange={(e) => {
                      const selectedRoom = rooms.find(r => r.id === e.target.value);
                      setNewTicket({ 
                        ...newTicket, 
                        roomId: e.target.value,
                        roomNumber: selectedRoom?.number || ''
                      });
                    }}
                  >
                    <option value="">General (No Room)</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.number} {room.roomType?.name ? `(${room.roomType.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Priority
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none h-10 rounded-xl border border-slate-200 bg-white pr-9 pl-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Issue Description <span className="text-red-400">*</span>
                </label>
                <Input
                  placeholder="Describe the maintenance issue in detail…"
                  value={newTicket.issueDescription}
                  onChange={(e) =>
                    setNewTicket({ ...newTicket, issueDescription: e.target.value })
                  }
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <div
                    onClick={() =>
                      setNewTicket({
                        ...newTicket,
                        requiresRoomRestriction: !newTicket.requiresRoomRestriction,
                      })
                    }
                    className={cn(
                      'w-10 h-6 rounded-full transition-colors relative cursor-pointer',
                      newTicket.requiresRoomRestriction ? 'bg-orange-500' : 'bg-slate-200',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        newTicket.requiresRoomRestriction ? 'translate-x-5' : 'translate-x-1',
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Restrict Room</p>
                    <p className="text-xs text-slate-400">Mark room as out-of-order during maintenance</p>
                  </div>
                </label>

                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    className="rounded-xl text-slate-500"
                    onClick={() => setShowNewTicket(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 font-semibold shadow-sm"
                    onClick={createTicket}
                    disabled={saving || !newTicket.issueDescription.trim()}
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</>
                    ) : (
                      'Create Ticket'
                    )}
                  </Button>
                </div>
              </div>
            </div>
        </DialogContent>

        {/* ── Ticket Table ── */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
          {/* table header + search */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-600" />
              Active Tickets
            </h2>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search by room or issue…"
                  className="pl-9 rounded-xl border-slate-200 bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <span className="bg-slate-100 text-slate-600 py-1 px-3 rounded-full text-xs font-bold shrink-0">
                {filtered.length} tickets
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="font-medium">Loading tickets…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Wrench className="w-12 h-12 opacity-20" />
              <p className="font-medium">
                {search ? 'No tickets match your search.' : 'No maintenance tickets found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/70 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Room</th>
                    <th className="px-6 py-4 font-semibold">Issue</th>
                    <th className="px-6 py-4 font-semibold">Priority</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Assigned</th>
                    <th className="px-6 py-4 font-semibold">Age</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Room */}
                      <td className="px-6 py-4">
                        {t.roomNumber ? (
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm group-hover:bg-slate-200 transition-colors">
                              {t.roomNumber}
                            </div>
                            {t.requiresRoomRestriction && (
                              <span className="text-xs font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">
                                OOO
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">General</span>
                        )}
                      </td>

                      {/* Issue */}
                      <td className="px-6 py-4 max-w-[240px]">
                        <p className="font-medium text-slate-800 line-clamp-2 text-sm leading-snug">
                          {t.issueDescription}
                        </p>
                      </td>

                      {/* Priority */}
                      <td className="px-6 py-4">
                        <PriorityPill priority={t.priority} />
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <StatusPill status={t.status} />
                      </td>

                      {/* Assigned */}
                      <td className="px-6 py-4">
                        {(t as any).assignedTo ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                              {String((t as any).assignedTo).slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-600 font-medium">Assigned</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Unassigned</span>
                        )}
                      </td>

                      {/* Age */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                          <Clock className="w-3.5 h-3.5" />
                          {ticketAge(t.createdAt)}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        {t.status !== 'RESOLVED' && t.status !== 'CLOSED' && t.status !== 'CANCELLED' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl px-4 font-semibold text-xs border-slate-200 shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:-translate-y-0.5 transition-all"
                            onClick={() => resolveTicket(t.id)}
                            disabled={resolving === t.id}
                          >
                            {resolving === t.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <><CircleCheck className="w-3.5 h-3.5 mr-1.5" /> Resolve</>
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium italic">
                            {STATUS_CONFIG[t.status]?.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </Dialog>
    </div>
  );
}
