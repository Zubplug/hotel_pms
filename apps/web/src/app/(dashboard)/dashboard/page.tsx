'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Banknote,
  Users,
  Activity,
  CalendarCheck,
  AlertCircle,
  Building,
  Wrench
} from 'lucide-react';
import { LoadingState } from '@/components/ui/EmptyState';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Bar, ComposedChart
, Tooltip} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface DashboardAnalytics {
  kpis: {
    netCollected30d: number;
    occupancy: number;
    activeGuests: number;
    receivables: number;
    operationalHealth: {
      available: number;
      occupied: number;
      cleaning: number;
      outOfOrder: number;
    };
  };
  trend: Array<{
    date: string;
    revenue: number;
    occupancyPct: number;
    roomNights: number;
  }>;
  properties: Array<{
    id: string;
    name: string;
    occupancy: number;
    netCollected: number;
    adr: number;
    outOfOrder: number;
  }>;
  activity: Array<{
    id: string;
    action: string;
    property: string;
    timeAgo: string;
    details: any;
  }>;
}

const formatCompactCurrency = (value: number) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', notation: 'compact', maximumFractionDigits: 1 }).format(value);
};

export default function CEODashboardPage() {
  const { data: session } = useLodgeCoreSession();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');

  const { data: propertiesList, isLoading: loadingProps } = useQuery({
    queryKey: ['properties', 'list'],
    queryFn: async () => {
      const res = await fetch('/api/v1/properties?pageSize=50');
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  const { data: analyticsRes, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['dashboard', 'analytics', selectedPropertyId],
    queryFn: async () => {
      const url = selectedPropertyId === 'ALL' 
        ? '/api/v1/dashboard/analytics' 
        : `/api/v1/dashboard/analytics?propertyId=${selectedPropertyId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  const analytics: DashboardAnalytics | undefined = analyticsRes?.data;
  const properties = propertiesList?.data || [];
  const isLoading = loadingProps || loadingAnalytics;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'Executive';

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-10">
      {/* Header & Property Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Portfolio:</span>
          <Select value={selectedPropertyId} onValueChange={(val: any) => val && setSelectedPropertyId(val)}>
            <SelectTrigger className="w-[240px] bg-background">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Properties</SelectItem>
              {properties.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading || !analytics ? (
        <LoadingState message="Aggregating financial & operational data..." />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="border-muted/60 bg-gradient-to-br from-card to-muted/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">Net Collected (30d)</p>
                  <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{formatCompactCurrency(analytics.kpis.netCollected30d)}</p>
                <p className="text-xs text-muted-foreground mt-1">Gross payments minus refunds</p>
              </CardContent>
            </Card>

            <Card className="border-muted/60 bg-gradient-to-br from-card to-muted/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">Occupancy (Today)</p>
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <CalendarCheck className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{analytics.kpis.occupancy.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">Sellable rooms occupied</p>
              </CardContent>
            </Card>

            <Card className="border-muted/60 bg-gradient-to-br from-card to-muted/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">Active Guests</p>
                  <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{analytics.kpis.activeGuests}</p>
                <p className="text-xs text-muted-foreground mt-1">Currently checked in</p>
              </CardContent>
            </Card>

            <Card className="border-muted/60 bg-gradient-to-br from-card to-muted/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">Receivables</p>
                  <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{formatCompactCurrency(analytics.kpis.receivables)}</p>
                <p className="text-xs text-muted-foreground mt-1">Outstanding folio balances</p>
              </CardContent>
            </Card>

            <Card className="border-muted/60 bg-gradient-to-br from-card to-muted/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Operational Health</p>
                  <div className="h-8 w-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-cyan-600" />
                  </div>
                </div>
                <div className="space-y-1 mt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Available</span>
                    <span className="font-medium text-emerald-600">{analytics.kpis.operationalHealth.available.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cleaning</span>
                    <span className="font-medium text-yellow-600">{analytics.kpis.operationalHealth.cleaning.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Out of Order</span>
                    <span className="font-medium text-red-600">{analytics.kpis.operationalHealth.outOfOrder.toFixed(0)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main Chart */}
            <Card className="xl:col-span-2 border-muted/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                  Revenue & Occupancy Trend (14 Days)
                </CardTitle>
                <CardDescription>
                  Historical comparison of net collected revenue vs room occupancy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analytics.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        dy={10}
                      />
                      <YAxis 
                        yAxisId="left" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(val) => val > 1000 ? formatCurrency(val/1000000) + 'M' : formatCurrency(val)}
                        dx={-10}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(val) => `${val}%`}
                        dx={10}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: any, name: any) => {
                          if (name === 'Revenue') return [formatCurrency(value), 'Net Collected'];
                          if (name === 'Occupancy %') return [`${value}%`, 'Occupancy'];
                          if (name === 'Room Nights') return [value, 'Room Nights'];
                          return [value, name];
                        }}
                        labelFormatter={(label: any) => new Date(label).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      />
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="revenue" 
                        name="Revenue"
                        stroke="#10b981" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="occupancyPct" 
                        name="Occupancy %"
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Live Activity Feed */}
            <Card className="border-muted/60 shadow-sm flex flex-col">
              <CardHeader className="pb-3 border-b border-muted/50">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <Activity className="mr-2 h-5 w-5 text-primary" />
                  Live Activity
                </CardTitle>
                <CardDescription>Recent portfolio-wide events</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex-1 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                {analytics.activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center mt-10">No recent activity found.</p>
                ) : (
                  <div className="space-y-5">
                    {analytics.activity.map((event, idx) => {
                      let icon = <Activity className="h-4 w-4 text-gray-500" />;
                      let bgColor = "bg-gray-500/10";
                      let title = "System Event";
                      let details = "";

                      if (event.action === 'GUEST_CHECK_IN') {
                        icon = <Users className="h-4 w-4 text-blue-500" />;
                        bgColor = "bg-blue-500/10";
                        title = "Guest Checked In";
                        details = `Reservation ${event.details?.reservationId?.substring(0, 8) || ''}`;
                      } else if (event.action === 'PAYMENT_RECEIVED') {
                        icon = <Banknote className="h-4 w-4 text-emerald-500" />;
                        bgColor = "bg-emerald-500/10";
                        title = "Payment Received";
                        details = event.details?.amount ? formatCurrency(Number(event.details.amount)) : '';
                      } else if (event.action === 'MAINTENANCE_TICKET_CREATED') {
                        icon = <Wrench className="h-4 w-4 text-orange-500" />;
                        bgColor = "bg-orange-500/10";
                        title = "Maintenance Issue";
                        details = `Priority: ${event.details?.priority || 'Normal'}`;
                      } else if (event.action === 'ROOM_STATUS_UPDATED') {
                        icon = <Building className="h-4 w-4 text-purple-500" />;
                        bgColor = "bg-purple-500/10";
                        title = "Room Status Changed";
                        details = `${event.details?.oldStatus || ''} → ${event.details?.newStatus || ''}`;
                      }

                      return (
                        <div key={event.id} className="flex gap-3 relative">
                          {idx !== analytics.activity.length - 1 && (
                            <div className="absolute left-[15px] top-8 bottom-[-16px] w-[2px] bg-muted" />
                          )}
                          <div className={`h-8 w-8 rounded-full ${bgColor} flex items-center justify-center shrink-0 z-10`}>
                            {icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium">{event.property}</span>
                              <span>•</span>
                              <span>
                                {(() => {
                                  const diff = Date.now() - new Date(event.timeAgo).getTime();
                                  const mins = Math.floor(diff / 60000);
                                  const hours = Math.floor(mins / 60);
                                  if (mins < 60) return `${mins} min ago`;
                                  if (hours < 24) return `${hours} hrs ago`;
                                  return '1 day ago';
                                })()}
                              </span>
                            </div>
                            {details && <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">{details}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Property Performance Table */}
          <Card className="border-muted/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center">
                <Building className="mr-2 h-5 w-5 text-primary" />
                Property Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg font-medium">Property</th>
                      <th className="px-4 py-3 font-medium text-right">Occupancy</th>
                      <th className="px-4 py-3 font-medium text-right">Net Collected (30d)</th>
                      <th className="px-4 py-3 font-medium text-right">ADR</th>
                      <th className="px-4 py-3 font-medium text-right rounded-r-lg">Out of Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.properties.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-muted-foreground">No properties available</td>
                      </tr>
                    ) : (
                      analytics.properties.sort((a,b) => b.netCollected - a.netCollected).map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${p.occupancy}%` }} />
                              </div>
                              <span className="w-9">{p.occupancy.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCompactCurrency(p.netCollected)}
                          </td>
                          <td className="px-4 py-3 text-right">{formatCompactCurrency(p.adr)}</td>
                          <td className="px-4 py-3 text-right">
                            {p.outOfOrder > 0 ? (
                              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30">
                                {p.outOfOrder} rooms
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
