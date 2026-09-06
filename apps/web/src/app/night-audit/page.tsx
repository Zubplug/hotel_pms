'use client';

import React, { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import { Loader2, MoonStar, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { StatusBanner } from '@/components/night-audit/dashboard/status-banner';
import { MetricCards } from '@/components/night-audit/dashboard/metric-cards';
import { AuditReadiness } from '@/components/night-audit/dashboard/audit-readiness';
import { OccupancyChart } from '@/components/night-audit/dashboard/occupancy-chart';
import { RevenueTrendChart } from '@/components/night-audit/dashboard/revenue-trend-chart';
import { AttentionQueue } from '@/components/night-audit/dashboard/attention-queue';
import { AuditWizard } from '@/components/night-audit/audit-wizard';
import { ResolutionManager, ResolutionAction } from '@/components/night-audit/resolution-manager';

export default function NightAuditDashboard() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [wizardOpen, setWizardOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // Resolution action for items clicked directly from the Attention Queue (not in wizard)
  const [resolutionAction, setResolutionAction] = useState<ResolutionAction>(null);

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const response = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Unable to load audit status');
      
      setData(result.data);
      
      // Auto-open wizard if overdue
      if (result.data.auditState === 'OVERDUE' && !quiet) {
        setWizardOpen(true);
      }
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
      setRefreshing(false); 
    }
  };

  useEffect(() => { 
    load(); 
  }, [propertyId]);

  const execute = async () => {
    setExecuting(true); 
    setError(null);
    try {
      const response = await fetch('/api/v1/night-audit/execute', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ propertyId }) 
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Audit execution failed');
      
      setWizardOpen(false); 
      setMessage(`Audit completed. ${result.data?.roomChargesPosted || 0} room charges posted.`); 
      await load(true);
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setExecuting(false); 
    }
  };

  const handleQueueResolve = (actionType: string, payload: any) => {
    setResolutionAction({ type: actionType as any, item: payload });
  };

  const handleResolutionSuccess = () => {
    setResolutionAction(null);
    load(true);
  };

  // Loading States
  if (propertyLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }
  
  if (!propertyId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <div>
          <MoonStar className="mx-auto h-10 w-10 text-indigo-500" />
          <h2 className="mt-4 text-xl font-semibold">Select a property</h2>
          <p className="mt-1 text-muted-foreground">Choose a property to open the audit workspace.</p>
        </div>
      </div>
    );
  }
  
  if (loading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const isAuditInProgress = (data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING');

  return (
    <div className="space-y-8 pb-12">
      {/* Global Alerts */}
      <div className="space-y-4">
        {data.auditState === 'FAILED' && (
          <div className="flex items-center justify-between rounded-xl bg-rose-50 p-4 border border-rose-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="font-medium text-sm">Last audit failed &mdash; review audit logs and retry.</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => load(true)} className="bg-white hover:bg-rose-50 text-rose-700 border-rose-200">
              Retry
            </Button>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 shadow-sm">
            <XCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}
        {message && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 shadow-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {message}
          </div>
        )}
      </div>

      {/* Hero / Status Banner */}
      <StatusBanner 
        data={data} 
        isAuditInProgress={isAuditInProgress}
        onRefresh={() => load(true)}
        onOpenWizard={() => setWizardOpen(true)}
        refreshing={refreshing}
      />

      {/* Primary Metrics */}
      <MetricCards data={data} />

      {/* Readiness & Attention Queue Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AuditReadiness data={data} />
        <AttentionQueue data={data} onResolveItem={handleQueueResolve} />
      </div>

      {/* Charts Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <OccupancyChart rooms={data.analytics.rooms} />
        <RevenueTrendChart trend={data.analytics.trend} baseCurrency={data.property.baseCurrency} />
      </div>

      {/* Audit Wizard Modal */}
      <AuditWizard 
        open={wizardOpen} 
        onOpenChange={setWizardOpen} 
        data={data}
        onExecute={execute}
        executing={executing}
        onRefresh={() => load(true)}
      />

      {/* Global Resolution Manager for direct queue clicks */}
      <ResolutionManager 
        action={resolutionAction} 
        onClose={() => setResolutionAction(null)} 
        onSuccess={handleResolutionSuccess} 
      />
    </div>
  );
}
