'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown, TrendingUp, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { getExceptions } from '@/lib/night-audit-actions';
import { useRouter } from 'next/navigation';

export default function ExceptionsPage() {
  const { propertyId } = useProperty();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acking, setAcking] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (propertyId) {
      setLoading(true);
      try {
        getExceptions(propertyId).then(res => {
          setData(res);
          setLoading(false);
        }).catch(err => {
          alert("Failed to load exceptions: " + err.message);
          setLoading(false);
        });
      } catch (err: any) {
        alert(err.message);
        setLoading(false);
      }
    }
  }, [propertyId]);

  
  const handleAckAll = async () => {
    setAcking(true);
    try {
      const statusRes = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`);
      const statusData = await statusRes.json();
      const nightAuditId = statusData.data?.pendingRun?.id;
      
      const promises = [];
      if (data?.syncConflicts > 0) promises.push(fetch('/api/v1/night-audit/acknowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, nightAuditId, warningType: 'HARDWARE_OFFLINE', reason: 'Bulk ack', comment: '' }) }));
      if (data?.openPosSessions > 0) promises.push(fetch('/api/v1/night-audit/acknowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, nightAuditId, warningType: 'OPEN_POS', reason: 'Bulk ack', comment: '' }) }));
      if (data?.highBalances > 0) promises.push(fetch('/api/v1/night-audit/acknowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, nightAuditId, warningType: 'HIGH_BALANCE', reason: 'Bulk ack', comment: '' }) }));
      
      await Promise.all(promises);
      
      const res = await getExceptions(propertyId);
      setData(res);
    } catch (err: any) {
      alert("Failed to acknowledge all: " + err.message);
    } finally {
      setAcking(false);
    }
  };

  const handleVerifyBypass = async (bypassId: string, action: 'VERIFY' | 'REJECT') => {
    try {
      const res = await fetch('/api/v1/night-audit/verify-checkin-bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bypassId, action, notes: 'Reviewed during night audit', propertyId })
      });
      if (!res.ok) throw new Error(await res.text());
      const updatedData = await getExceptions(propertyId);
      setData(updatedData);
    } catch (err: any) {
      alert("Failed to verify bypass: " + err.message);
    }
  };

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
        <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleAckAll} disabled={acking}>
          {acking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
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
            <div className="text-2xl font-bold">₦{data?.cashOverages?.toFixed(2) || '0.00'}</div>
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
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">-₦{data?.cashShortages?.toFixed(2) || '0.00'}</div>
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
                  <Button variant="outline" size="sm" onClick={() => router.push('/frontdesk')}>Investigate</Button>
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
                  <Button variant="outline" size="sm" onClick={() => router.push('/pos')}>Investigate</Button>
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
                    <p className="text-sm text-muted-foreground">{data.highBalances} open folios have an outstanding debit balance requiring review.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push('/reservations')}>Investigate</Button>
                </div>
              </div>
            )}
            
            {data?.pendingCheckInBypasses?.length > 0 && data.pendingCheckInBypasses.map((bypass: any) => (
              <div key={bypass.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Check-In Deposit Bypass: {bypass.reservation.confirmationNumber}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Guest: {bypass.reservation.primaryGuest.firstName} {bypass.reservation.primaryGuest.lastName} • 
                      Balance: ₦{Number(bypass.reservation.folios[0]?.balance || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reason: "{bypass.reason}"
                      <br/>
                      Operator: {bypass.operator.firstName} {bypass.operator.lastName} • 
                      Acknowledged by: {bypass.acknowledgedByStaff.firstName} {bypass.acknowledgedByStaff.lastName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                  <Button variant="outline" size="sm" onClick={() => handleVerifyBypass(bypass.id, 'REJECT')} className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/20">Reject (Keep Blocked)</Button>
                  <Button variant="default" size="sm" onClick={() => handleVerifyBypass(bypass.id, 'VERIFY')} className="bg-emerald-600 hover:bg-emerald-700">Verify</Button>
                </div>
              </div>
            ))}

            {(!data || (data.syncConflicts === 0 && data.openPosSessions === 0 && data.highBalances === 0 && (!data.pendingCheckInBypasses || data.pendingCheckInBypasses.length === 0))) && (
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
