'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  LogOut,
  LogIn,
  Key,
  CreditCard,
  UserPlus,
  Search,
  AlertCircle,
  CheckCircle2,
  Hotel
} from 'lucide-react';
import { LoadingState } from '@/components/ui/EmptyState';
import { CheckInDialog } from '@/components/reservations/CheckInDialog';
import { CheckOutDialog } from '@/components/reservations/CheckOutDialog';

export default function ReceptionistDashboardPage() {
  const router = useRouter();
  const [selectedPropertyId] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('selectedPropertyId') : null
  );

  const [checkInReservation, setCheckInReservation] = useState<any | null>(null);
  const [checkOutReservation, setCheckOutReservation] = useState<any | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['frontdesk', 'dashboard', selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return null;
      const response = await fetch(`/api/v1/frontdesk/dashboard?propertyId=${selectedPropertyId}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    enabled: !!selectedPropertyId,
    refetchInterval: 10000, // Refetch every 10s for live feel
  });

  if (!selectedPropertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Hotel className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Property Selected</h2>
        <p className="text-muted-foreground">Please select a property from the top navigation bar to view the Front Desk.</p>
      </div>
    );
  }

  if (isLoading || !res?.data) {
    return <LoadingState message="Loading operational dashboard..." />;
  }

  const { kpis, hardware, arrivals, departures } = res.data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Front Desk</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Operational Dashboard • Business Date: {new Date(res.data.businessDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center">
          <Badge variant={hardware.status === 'ONLINE' ? 'default' : 'destructive'} className="px-3 py-1 shadow-sm gap-2">
            {hardware.status === 'ONLINE' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {hardware.status === 'ONLINE' ? 'Keycard Encoder Online' : 'Encoder Offline'}
          </Badge>
        </div>
      </div>

      {hardware.status !== 'ONLINE' && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3 border border-red-200 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Hardware Alert: Encoder Disconnected</p>
            <p className="mt-1 opacity-90">{hardware.message}</p>
            <p className="mt-1 opacity-90 font-medium">Physical keycard issuance is currently unavailable.</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today's Arrivals</p>
              <p className="text-3xl font-bold mt-1 text-blue-600">{kpis.arrivals}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
              <LogIn className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today's Departures</p>
              <p className="text-3xl font-bold mt-1 text-orange-600">{kpis.departures}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
              <LogOut className="h-5 w-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">In-House Guests</p>
              <p className="text-3xl font-bold mt-1 text-emerald-600">{kpis.inHouse}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Available Rooms</p>
              <p className="text-3xl font-bold mt-1 text-slate-800">{kpis.roomsAvailable} <span className="text-lg text-slate-400 font-normal">/ {kpis.roomsTotal}</span></p>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Key className="h-5 w-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Row */}
      <div className="bg-slate-50 p-4 rounded-xl border flex flex-wrap gap-3">
        <Button onClick={() => router.push('/reservations/new')} className="h-12 px-6 shadow-sm" variant="default">
          <UserPlus className="w-4 h-4 mr-2" /> Walk-In
        </Button>
        <Button onClick={() => router.push('/reservations/new')} className="h-12 px-6 bg-white shadow-sm hover:bg-slate-50 border" variant="outline">
          <CheckCircle2 className="w-4 h-4 mr-2" /> New Reservation
        </Button>
        <Button className="h-12 px-6 bg-white shadow-sm hover:bg-slate-50 border" variant="outline">
          <Search className="w-4 h-4 mr-2" /> Search Guest
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Arrivals Table */}
        <Card className="border-slate-200 shadow-sm flex flex-col h-[500px]">
          <CardHeader className="py-4 border-b bg-slate-50/50">
            <CardTitle className="text-lg font-semibold flex items-center">
              <LogIn className="mr-2 h-5 w-5 text-blue-600" />
              Arrivals ({arrivals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {arrivals.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No arrivals left today.</td></tr>
                ) : (
                  arrivals.map((arr: any) => (
                    <tr key={arr.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{arr.guestName}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{arr.confirmationNumber.slice(0,8)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{arr.roomName}</p>
                        <p className="text-xs text-slate-500">{arr.roomTypeName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge 
                          variant="outline" 
                          className="text-xs px-2 shadow-sm"
                          style={{
                            color: arr.arrivalState.color === 'yellow' ? '#ca8a04' : arr.arrivalState.color === 'green' ? '#16a34a' : arr.arrivalState.color === 'blue' ? '#2563eb' : '#dc2626',
                            borderColor: arr.arrivalState.color === 'yellow' ? '#fef08a' : arr.arrivalState.color === 'green' ? '#bbf7d0' : arr.arrivalState.color === 'blue' ? '#bfdbfe' : '#fecaca',
                            backgroundColor: arr.arrivalState.color === 'yellow' ? '#fefce8' : arr.arrivalState.color === 'green' ? '#f0fdf4' : arr.arrivalState.color === 'blue' ? '#eff6ff' : '#fef2f2'
                          }}
                        >
                          {arr.arrivalState.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {arr.status === 'CONFIRMED' && (
                          <Button size="sm" onClick={() => setCheckInReservation({ id: arr.id, folios: [{ balance: arr.balance }] })}>
                            Check In
                          </Button>
                        )}
                        {arr.status === 'CHECKED_IN' && (
                          <Button size="sm" variant="secondary" onClick={() => router.push(`/reservations/${arr.id}`)}>
                            View
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Departures Table */}
        <Card className="border-slate-200 shadow-sm flex flex-col h-[500px]">
          <CardHeader className="py-4 border-b bg-slate-50/50">
            <CardTitle className="text-lg font-semibold flex items-center">
              <LogOut className="mr-2 h-5 w-5 text-orange-600" />
              Departures ({departures.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departures.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No departures left today.</td></tr>
                ) : (
                  departures.map((dep: any) => (
                    <tr key={dep.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{dep.guestName}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{dep.confirmationNumber.slice(0,8)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{dep.roomName}</p>
                        <p className="text-xs text-slate-500">{dep.roomTypeName}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {dep.balance > 0 ? (
                          <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm border border-red-100">
                            <CreditCard className="w-3.5 h-3.5" />
                            {formatCurrency(dep.balance)}
                          </div>
                        ) : (
                          <span className="text-emerald-600 font-medium">Settled</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {dep.status === 'CHECKED_IN' && (
                          <Button size="sm" variant={dep.balance > 0 ? "outline" : "default"} onClick={() => setCheckOutReservation({ id: dep.id, folios: [{ balance: dep.balance }] })}>
                            Check Out
                          </Button>
                        )}
                        {dep.status === 'CHECKED_OUT' && (
                          <Badge variant="secondary" className="px-3 py-1 font-normal">Departed</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {checkInReservation && (
        <CheckInDialog
          open={!!checkInReservation}
          onOpenChange={(open) => !open && setCheckInReservation(null)}
          reservation={checkInReservation}
        />
      )}
      
      {checkOutReservation && (
        <CheckOutDialog
          open={!!checkOutReservation}
          onOpenChange={(open) => !open && setCheckOutReservation(null)}
          reservation={checkOutReservation}
          folio={checkOutReservation.folios[0]}
        />
      )}
    </div>
  );
}
