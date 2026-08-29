'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown, TrendingUp, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { getExceptions } from '@/lib/night-audit-actions';

export default function ExceptionsPage() {
  const { propertyId } = useProperty();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propertyId) {
      setLoading(true);
      getExceptions(propertyId).then(res => {
        setData(res);
        setLoading(false);
      });
    }
  }, [propertyId]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">
            Exceptions & Variances
          </h1>
          <p className="text-muted-foreground mt-1">
            Resolve unposted charges, room discrepancies, and cashier variances.
          </p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700">
          Acknowledge All
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-amber-200 dark:border-amber-900/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              Cash Overages
            </CardTitle>
            <CardDescription>Shift drops greater than expected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data?.cashOverages?.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground mt-1">Calculated from un-deposited drops</p>
          </CardContent>
        </Card>
        
        <Card className="border-rose-200 dark:border-rose-900/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-rose-500" />
              Cash Shortages
            </CardTitle>
            <CardDescription>Shift drops less than expected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">-${data?.cashShortages?.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires supervisor override</p>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 dark:border-indigo-900/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-indigo-500" />
              Room Rate Variances
            </CardTitle>
            <CardDescription>Guests paying different than base rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.rateVariances || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires manager review</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Action Required</CardTitle>
          <CardDescription>The following exceptions must be reviewed before concluding the audit.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border divide-y">
            {data?.syncConflicts > 0 && (
              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Unsynced Financial Postings</p>
                    <p className="text-sm text-muted-foreground">{data.syncConflicts} transactions stuck in offline queue.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">Investigate</Button>
                </div>
              </div>
            )}
            
            {data?.openPosSessions > 0 && (
              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Open POS Sessions</p>
                    <p className="text-sm text-muted-foreground">{data.openPosSessions} registers have not been closed yet.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">Investigate</Button>
                </div>
              </div>
            )}

            {data?.highBalances > 0 && (
              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">High Balance Folios</p>
                    <p className="text-sm text-muted-foreground">{data.highBalances} folios have exceeded the house credit limit.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">Investigate</Button>
                </div>
              </div>
            )}
            
            {(!data || (data.syncConflicts === 0 && data.openPosSessions === 0 && data.highBalances === 0)) && (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                No pending exceptions blocking the audit.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
