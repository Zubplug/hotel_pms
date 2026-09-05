'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, DollarSign, Utensils, TableProperties, Clock, AlertTriangle } from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function FnbDashboardClient() {
  const { data: session } = useLodgeCoreSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Implement the 30 second refresh interval as requested
  useEffect(() => {
    if (!session?.user) return;
    
    const fetchDashboardData = () => {
      fetch('/api/v1/fnb/dashboard')
        .then(res => res.json())
        .then(resData => {
          if (resData.success) {
            setData(resData.data);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [session]);

  const kpis = data?.kpis || {};
  const salesBreakdown = data?.salesBreakdown || [];
  const topSellingItems = data?.topSellingItems || [];
  const alerts = data?.alerts || [];

  const grossSales = kpis.grossSales || 0;
  const activeOrders = kpis.activeOrders || 0;
  const covers = kpis.covers || 0;
  const avgCheck = kpis.averageCheck || 0;
  
  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">F&B Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time overview of outlet performance and operations.</p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Sales (Today)</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(grossSales)}</div>
                <p className="text-xs text-muted-foreground">Live from POS payments</p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{activeOrders}</div>
                <p className="text-xs text-muted-foreground">Submitted & In Service</p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Covers</CardTitle>
            <TableProperties className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{covers} guests</div>
                <p className="text-xs text-muted-foreground">Served today</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Avg. Check / Guest</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loading ? (
              <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(avgCheck)}</div>
                <p className="text-xs text-muted-foreground">Per cover metric</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Revenue Breakdown */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Sales Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              {loading ? (
                <div className="h-full w-full bg-slate-100 dark:bg-slate-900 animate-pulse rounded-md" />
              ) : salesBreakdown.length === 0 ? (
                <span className="text-muted-foreground">No sales data for today yet.</span>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="amount"
                      nameKey="method"
                      label={({ name, percent }: any) => percent !== undefined ? `${name} ${(percent * 100).toFixed(0)}%` : name}
                    >
                      {salesBreakdown.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Operational Alerts */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Operational Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                 <div className="space-y-3">
                   <div className="h-16 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-md" />
                   <div className="h-16 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-md" />
                 </div>
              ) : alerts.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-md">
                  All operations normal. No alerts.
                </div>
              ) : (
                alerts.map((alert: any, idx: number) => {
                  let borderClass = 'border-blue-500';
                  let bgClass = 'bg-blue-50/50 dark:bg-blue-900/10';
                  let textClass = 'text-blue-500';
                  
                  if (alert.severity === 'destructive') {
                    borderClass = 'border-red-500';
                    bgClass = 'bg-red-50/50 dark:bg-red-900/10';
                    textClass = 'text-red-500';
                  } else if (alert.severity === 'warning') {
                    borderClass = 'border-yellow-500';
                    bgClass = 'bg-yellow-50/50 dark:bg-yellow-900/10';
                    textClass = 'text-yellow-500';
                  }

                  const Icon = alert.type === 'SLOW_KOT' ? Clock : AlertTriangle;

                  return (
                    <div key={idx} className={`flex items-start space-x-4 border-l-4 pl-4 py-2 rounded-r-md ${borderClass} ${bgClass}`}>
                      <Icon className={`w-5 h-5 mt-0.5 ${textClass}`} />
                      <div>
                        <h4 className="text-sm font-semibold">{alert.title}</h4>
                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Popular Items */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between animate-pulse">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                      </div>
                    </div>
                  </div>
                ))
              ) : topSellingItems.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No items sold today yet.
                </div>
              ) : (
                topSellingItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Utensils className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{item.productName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.categoryName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(item.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{item.quantitySold} ordered</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
