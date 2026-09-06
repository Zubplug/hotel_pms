import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity, AlertTriangle, Info, AlertCircle, CalendarClock, ShieldAlert, MonitorDot, Banknote, Users } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';

export function ActivityFeed({ data }: { data: NightAuditData }) {
  const events = data.activityFeed || [];

  if (events.length === 0) {
    return (
      <Card className="h-full border border-slate-200/70 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-medium text-slate-800">
            <Activity className="h-5 w-5 text-indigo-500" />
            Operational Audit Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-slate-50 p-4 mb-4 shadow-sm border border-slate-100">
            <MonitorDot className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">No significant events recorded</p>
          <p className="mt-1 text-xs text-slate-400">Activity logged today will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'FINANCIAL': return <Banknote className="h-4 w-4" />;
      case 'SECURITY': return <ShieldAlert className="h-4 w-4" />;
      case 'FRONT_DESK': return <Users className="h-4 w-4" />;
      case 'NIGHT_AUDIT': return <CalendarClock className="h-4 w-4" />;
      default: return <MonitorDot className="h-4 w-4" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'WARNING': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <AlertCircle className="h-3.5 w-3.5" />;
      case 'WARNING': return <AlertTriangle className="h-3.5 w-3.5" />;
      default: return <Info className="h-3.5 w-3.5" />;
    }
  };

  return (
    <Card className="h-full border border-slate-200/70 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)] flex flex-col max-h-[600px]">
      <CardHeader className="border-b border-slate-100 pb-4 sticky top-0 bg-white z-10 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-lg font-medium text-slate-800">
          <Activity className="h-5 w-5 text-indigo-500" />
          Operational Audit Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0">
        <div className="divide-y divide-slate-100">
          {events.map((event) => (
            <div key={event.id} className="group relative flex items-start gap-4 p-5 hover:bg-slate-50/50 transition-colors">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-sm ${getSeverityStyles(event.severity)}`}>
                {getCategoryIcon(event.category)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900 truncate">{event.title}</h4>
                  <span className="shrink-0 text-xs font-medium text-slate-500 tabular-nums">
                    {new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {event.description && (
                  <p className="mt-1.5 text-sm text-slate-600 line-clamp-2 leading-relaxed">{event.description}</p>
                )}
                
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getSeverityStyles(event.severity)}`}>
                    {getSeverityIcon(event.severity)}
                    {event.severity}
                  </span>
                  
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-slate-200/60 shadow-sm">
                    {event.category.replace('_', ' ')}
                  </span>
                  
                  {event.actorName && (
                    <span className="inline-flex items-center text-xs text-slate-500 before:mr-2 before:text-slate-300 before:content-['•']">
                      By {event.actorName}
                    </span>
                  )}
                  
                  {event.amount !== null && event.currency && (
                    <span className="ml-auto font-semibold text-slate-900 text-sm tracking-tight">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: event.currency }).format(event.amount)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
