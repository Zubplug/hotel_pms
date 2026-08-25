'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  CalendarDays, Search, User, BedDouble,
  ArrowRight, CheckCircle2, Clock, XCircle,
  AlertCircle, LogIn, Filter, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState, EmptyState } from '@/components/ui/EmptyState';
import { ReadCardCheckoutDialog } from '@/components/reservations/ReadCardCheckoutDialog';
import { useProperty } from '@/components/PropertyProvider';
import { formatRoomNumber } from '@/lib/format-room';
// ─── Types ────────────────────────────────────────────────────────────────────

interface Reservation {
  id: string;
  confirmationNumber: string;
  status: string;
  source: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  primaryGuest: { firstName: string; lastName: string; email?: string; phone?: string };
  property: { name: string; city: string };
  reservationRooms: Array<{
    room?: { number: string; status: string } | null;
    roomType?: { name: string } | null;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  INQUIRY:      { label: 'Inquiry',     badge: 'bg-gray-100 text-gray-700',    icon: Clock },
  PENDING:      { label: 'Pending',     badge: 'bg-yellow-100 text-yellow-700', icon: Clock },
  CONFIRMED:    { label: 'Confirmed',   badge: 'bg-blue-100 text-blue-700',    icon: CheckCircle2 },
  CHECKED_IN:   { label: 'Checked In',  badge: 'bg-emerald-100 text-emerald-700', icon: LogIn },
  CHECKED_OUT:  { label: 'Checked Out', badge: 'bg-slate-100 text-slate-600',  icon: CheckCircle2 },
  CANCELLED:    { label: 'Cancelled',   badge: 'bg-red-100 text-red-700',      icon: XCircle },
  NO_SHOW:      { label: 'No Show',     badge: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  EXPIRED:      { label: 'Expired',     badge: 'bg-gray-100 text-gray-500',    icon: Clock },
};

const ALL_STATUSES = Object.keys(STATUS_STYLES);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nightCount(checkIn: string, checkOut: string) {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.round(diff / 86400000);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const { propertyId } = useProperty();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [quickCheckoutOpen, setQuickCheckoutOpen] = useState(false);

  // Debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', 'list', { search: debouncedSearch, status: statusFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/v1/reservations?${params}`);
      if (!res.ok) throw new Error('Failed to load reservations');
      return res.json();
    },
  });

  const reservations: Reservation[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, totalPages: 1 };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage guest reservations and key card check-in
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="shrink-0 h-10 gap-1.5" 
            onClick={() => setQuickCheckoutOpen(true)}
          >
            <LogIn className="h-4 w-4" /> {/* Or a different icon */}
            Quick Checkout
          </Button>
          <Link href="/reservations/new">
            <Button className="shrink-0 h-10 gap-1.5" id="btn-new-reservation">
              <Plus className="h-4 w-4" />
              New Reservation
            </Button>
          </Link>
        </div>
      </div>

      <ReadCardCheckoutDialog 
        open={quickCheckoutOpen}
        onOpenChange={setQuickCheckoutOpen}
        propertyId={propertyId ?? ''}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search guest, confirmation #…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer transition-all"
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_STYLES[s]?.label ?? s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <LoadingState message="Loading reservations…" />
      ) : reservations.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No reservations found"
          description={search || statusFilter ? 'Try adjusting your filters.' : 'Reservations will appear here once created.'}
        />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Guest</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Confirmation</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Room</th>
                <th className="px-4 py-3 text-left">Dates</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reservations.map((res) => {
                const s = STATUS_STYLES[res.status] ?? STATUS_STYLES.PENDING;
                const StatusIcon = s.icon;
                const room = res.reservationRooms[0];
                const nights = nightCount(res.checkIn, res.checkOut);
                return (
                  <tr
                    key={res.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    {/* Guest */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {res.primaryGuest.firstName} {res.primaryGuest.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {res.primaryGuest.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Confirmation */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">
                        {res.confirmationNumber}
                      </span>
                    </td>

                    {/* Room */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {room ? (
                        <div className="flex items-center gap-1.5">
                          <BedDouble className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">
                            {formatRoomNumber(room.room?.number) || '—'}
                          </span>
                          <span className="text-xs text-muted-foreground hidden lg:inline">
                            · {room.roomType?.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">No room</span>
                      )}
                    </td>

                    {/* Dates */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">
                        {formatDate(res.checkIn)} → {formatDate(res.checkOut)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {nights} night{nights !== 1 ? 's' : ''} · {res.adults}A{res.children > 0 ? ` ${res.children}C` : ''}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
                        <StatusIcon className="h-3 w-3" />
                        {s.label}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <Link href={`/reservations/${res.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-sm text-muted-foreground">
              <span>{meta.total} reservations</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs">
                  {page} / {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
