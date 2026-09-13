'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Download, RefreshCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

export default function FnbReportsPage() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = () => {
    if (!session?.user || !propertyId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/fnb/reports?propertyId=${propertyId}`)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Unable to load reports');
        return body.data.reports;
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, [session, propertyId]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-destructive/10 p-4 text-destructive font-medium border border-destructive/20">{error}</div>
      </div>
    );
  }

  const breakdown = data?.tenderBreakdown || [];
  const grossTotal = Number(data?.grossTotal || 0);
  const totalVoids = Number(data?.totalVoids || 0);
  const totalDiscounts = Number(data?.totalDiscounts || 0);
  const netTotal = grossTotal - totalVoids - totalDiscounts;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">F&B Reports (DSS)</h1>
          <p className="text-muted-foreground mt-1">Daily Sales Summaries & Night Audit Reconciliation.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={fetchReports} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Sync PMS
          </Button>
          <Button><Download className="mr-2 h-4 w-4" /> Export Report</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Tender Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breakdown.length === 0 ? (
                <div className="text-muted-foreground py-4 text-center">No tenders recorded for the active business date.</div>
              ) : (
                breakdown.map((tender: any) => (
                  <div key={tender.method} className="flex justify-between items-center border-b pb-2">
                    <span className="text-muted-foreground">{tender.method.replace(/_/g, ' ')}</span>
                    <span className="font-bold">{money(tender._sum?.amount || 0)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold">Gross Total</span>
                <span className="font-bold text-lg text-primary">{money(grossTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-destructive" />
              Adjustments & Discrepancies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Manager Discounts</span>
                <span className="font-bold text-red-500">- {money(totalDiscounts)}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Voided / Cancelled</span>
                <span className="font-bold text-red-500">- {money(totalVoids)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold">Net Total</span>
                <span className="font-bold text-lg">{money(netTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
