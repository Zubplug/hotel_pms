'use client';

import React, { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import { Loader2, MoonStar, XCircle, AlertTriangle, CheckCircle2, CalendarDays, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { StatusBanner } from '@/components/night-audit/dashboard/status-banner';
import { MetricCards } from '@/components/night-audit/dashboard/metric-cards';
import { AuditReadiness } from '@/components/night-audit/dashboard/audit-readiness';
import { OccupancyChart } from '@/components/night-audit/dashboard/occupancy-chart';
import { RevenueTrendChart } from '@/components/night-audit/dashboard/revenue-trend-chart';
import { ActivityFeed } from '@/components/night-audit/dashboard/activity-feed';
import { AttentionQueue } from '@/components/night-audit/dashboard/attention-queue';
import { AuditPulse } from '@/components/night-audit/dashboard/audit-pulse';
import { AuditWizard } from '@/components/night-audit/audit-wizard';
import { ResolutionManager, ResolutionAction } from '@/components/night-audit/resolution-manager';

export default function NightAuditDashboard({ managerMode = false }: { managerMode?: boolean }) {
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
      if (result.data.auditState === 'OVERDUE' && !quiet && !managerMode) {
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
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.07),transparent_28rem)] px-5 pb-12 pt-6 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-[1540px] space-y-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Night audit / Control center</div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Good evening, keep the close moving.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A clear view of financial controls, room movement, and the next actions required to close today confidently.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5 shadow-sm backdrop-blur-sm lg:self-auto">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><CalendarDays className="h-4 w-4" /></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Business date</p><p className="text-sm font-semibold text-slate-800">{new Date(data.businessDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
          <span className="ml-2 flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"><Radio className="h-3 w-3" /> Synced</span>
        </div>
      </header>

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
        managerMode={managerMode}
      />

      <AuditPulse data={data} />

      {/* Primary Metrics */}
      <MetricCards data={data} />

      {/* Charts Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <OccupancyChart rooms={data.analytics.rooms} managerMode={managerMode} />
        <RevenueTrendChart trend={data.analytics.trend} baseCurrency={data.property.baseCurrency} />
      </div>

      {/* Readiness & Attention Queue Layout */}
      {data.auditState !== 'COMPLETED' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AuditReadiness data={data} />
          <AttentionQueue data={data} onResolveItem={managerMode ? undefined : handleQueueResolve} />
        </div>
      )}

      {/* Activity Feed */}
      <div className="mt-8">
        <ActivityFeed data={data} />
      </div>

      {/* Audit Wizard Modal */}
      {!managerMode && <AuditWizard
        open={wizardOpen} 
        onOpenChange={setWizardOpen} 
        data={data}
        onExecute={execute}
        executing={executing}
        onRefresh={() => load(true)}
      />}

      {/* Global Resolution Manager for direct queue clicks */}
      {!managerMode && <ResolutionManager
        action={resolutionAction} 
        onClose={() => setResolutionAction(null)} 
        onSuccess={handleResolutionSuccess} 
      />}
      </div>
    </div>
  );
}
