'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Brush, CheckCircle, Clock } from 'lucide-react';

export default function HousekeepingReportPage() {
  const { propertyId } = useProperty();
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, cleaning: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!propertyId) return;
      try {
        const res = await fetch(`/api/v1/housekeeping/tasks?propertyId=${propertyId}`);
        const data = await res.json();
        if (data.success && data.data) {
          const tasks = data.data;
          setStats({
            total: tasks.length,
            completed: tasks.filter((t: any) => t.status === 'CLEAN' || t.status === 'INSPECTED').length,
            pending: tasks.filter((t: any) => t.status === 'PENDING' || t.status === 'ASSIGNED').length,
            cleaning: tasks.filter((t: any) => t.status === 'CLEANING').length
          });
        }
      } catch (err) {
        console.error('Failed to load tasks for report', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [propertyId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Housekeeping Performance Report</h1>
        <p className="text-muted-foreground">Monitor daily cleaning progress and staff efficiency.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
              <Brush className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Rooms today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">Clean or Inspected</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.cleaning}</div>
              <p className="text-xs text-muted-foreground">Currently cleaning</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting start</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* A detailed chart could go here, or table of housekeeper performance */}
      <Card>
        <CardHeader>
          <CardTitle>Completion over time (Today)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center bg-gray-50 border-t">
          <p className="text-muted-foreground text-sm">Chart visualization would be rendered here</p>
        </CardContent>
      </Card>
    </div>
  );
}
