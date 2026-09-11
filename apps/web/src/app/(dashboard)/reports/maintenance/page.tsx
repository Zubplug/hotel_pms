'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Wrench, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function MaintenanceReportPage() {
  const { propertyId } = useProperty();
  const [stats, setStats] = useState({ total: 0, resolved: 0, critical: 0, open: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!propertyId) return;
      try {
        const res = await fetch(`/api/v1/maintenance/tickets?propertyId=${propertyId}`);
        const data = await res.json();
        if (data.success && data.data?.tickets) {
          const tickets = data.data.tickets;
          setStats({
            total: tickets.length,
            resolved: tickets.filter((t: any) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
            critical: tickets.filter((t: any) => t.priority === 'CRITICAL' && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length,
            open: tickets.filter((t: any) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'].includes(t.status)).length
          });
        }
      } catch (err) {
        console.error('Failed to load tickets for report', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [propertyId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Report</h1>
        <p className="text-muted-foreground">Monitor outstanding issues and resolution times.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Currently Open</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
              <p className="text-xs text-muted-foreground">Blocking rooms</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">Issues fixed</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resolution Time Analysis</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center bg-gray-50 border-t">
          <p className="text-muted-foreground text-sm">Chart visualization would be rendered here</p>
        </CardContent>
      </Card>
    </div>
  );
}
