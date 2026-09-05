'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, BedDouble, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function RoomStatusReportPage() {
  const { propertyId } = useProperty();
  const [stats, setStats] = useState({ total: 0, available: 0, occupied: 0, outOfOrder: 0, dirty: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!propertyId) return;
      try {
        const res = await fetch(`/api/v1/rooms?propertyId=${propertyId}`);
        const data = await res.json();
        if (data.success && data.data) {
          const rooms = data.data;
          setStats({
            total: rooms.length,
            available: rooms.filter((r: any) => r.status === 'AVAILABLE').length,
            occupied: rooms.filter((r: any) => r.status === 'OCCUPIED').length,
            outOfOrder: rooms.filter((r: any) => r.status === 'OUT_OF_ORDER').length,
            dirty: rooms.filter((r: any) => r.status === 'DIRTY').length
          });
        }
      } catch (err) {
        console.error('Failed to load rooms for report', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [propertyId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Room Status Report</h1>
        <p className="text-muted-foreground">Real-time overview of room availability and condition.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
              <BedDouble className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
              <p className="text-xs text-muted-foreground">Clean and ready</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupied</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.occupied}</div>
              <p className="text-xs text-muted-foreground">Currently checked in</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Order</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.outOfOrder}</div>
              <p className="text-xs text-muted-foreground">Maintenance required</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Room Status Matrix</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center bg-gray-50 border-t">
          <p className="text-muted-foreground text-sm">Detailed matrix showing FO Status vs Housekeeping Status</p>
        </CardContent>
      </Card>
    </div>
  );
}
