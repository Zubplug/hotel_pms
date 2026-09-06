import React from 'react';
import { format } from 'date-fns';
import { NightAuditData } from '@/types/night-audit';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock3, Loader2, MoonStar, Play, RefreshCw, AlertTriangle, FileCheck2 } from 'lucide-react';

interface StatusBannerProps {
  data: NightAuditData;
  isAuditInProgress: boolean;
  onRefresh: () => void;
  onOpenWizard: () => void;
  refreshing: boolean;
}

export function StatusBanner({ data, isAuditInProgress, onRefresh, onOpenWizard, refreshing }: StatusBannerProps) {
  const businessDate = data.businessDate ? new Date(data.businessDate) : new Date();
  
  // Determine CTA text and state based on auditState and blockers
  const isReady = data.summary.blockers === 0 && !isAuditInProgress && data.auditState !== 'COMPLETED';
  
  let statusColor = 'bg-amber-500/10 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30';
  let statusIcon = <Clock3 className="h-5 w-5" />;
  let statusText = 'Audit Pending';
  let statusDescription = 'Awaiting daily close';

  if (data.auditState === 'COMPLETED') {
    statusColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30';
    statusIcon = <CheckCircle2 className="h-5 w-5" />;
    statusText = 'Audit Complete';
    statusDescription = 'Business day closed';
  } else if (isAuditInProgress) {
    statusColor = 'bg-sky-500/10 text-sky-600 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30';
    statusIcon = <Loader2 className="h-5 w-5 animate-spin" />;
    statusText = 'Audit In Progress';
    statusDescription = 'Processing charges...';
  } else if (data.auditState === 'OVERDUE') {
    statusColor = 'bg-rose-500/10 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30';
    statusIcon = <AlertTriangle className="h-5 w-5" />;
    statusText = 'Audit Overdue';
    statusDescription = 'Please close immediately';
  } else if (isReady) {
    statusColor = 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30';
    statusIcon = <FileCheck2 className="h-5 w-5" />;
    statusText = 'Audit Ready';
    statusDescription = 'All clear to run';
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-2xl md:p-8">
      {/* Background gradients for premium feel */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-between gap-8 md:flex-row md:items-center">
        {/* Left Side: Context */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-300 uppercase tracking-wider mb-2">
            <MoonStar className="h-4 w-4" /> Night Audit Workspace
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            {format(businessDate, 'EEEE, dd MMMM yyyy')}
          </h2>
          <p className="mt-2 text-sm text-slate-400 font-medium">
            {data.property.name || 'Property'} &middot; {data.auditState === 'OVERDUE' ? 'Attention required' : 'Operations online'}
          </p>
        </div>

        {/* Right Side: Status Box & CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 transition-all hover:bg-white/10">
            <div className={`rounded-full p-2.5 border ${statusColor}`}>
              {statusIcon}
            </div>
            <div className="pr-2">
              <p className="font-semibold text-slate-100">{statusText}</p>
              <p className="text-xs text-slate-400 mt-0.5">{statusDescription}</p>
            </div>
          </div>
          
          <div className="flex w-full sm:w-auto gap-3">
            <Button 
              size="lg"
              className="flex-1 sm:flex-none bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg hover:shadow-indigo-500/25 transition-all font-semibold border border-indigo-400/50"
              onClick={onOpenWizard}
              disabled={isAuditInProgress}
            >
              <Play className="mr-2 h-4 w-4 fill-current" />
              {isAuditInProgress ? 'Processing...' : data.auditState === 'COMPLETED' ? 'Review Audit' : isReady ? 'Run Audit' : 'Resolve Issues'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
