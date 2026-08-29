'use client';

import React, { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, AlertTriangle, XCircle, Play, 
  Building, MonitorSmartphone, DollarSign, Wallet, 
  Receipt, FileCheck, Rocket, Loader2, ChevronDown, 
  ShieldCheck, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';

export default function NightAuditWizard() {
  const { propertyId } = useProperty();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const fetchData = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch Night Audit status');
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const handleExecute = async () => {
    if (!confirm('Are you sure you want to execute the Night Audit? This action cannot be undone.')) return;
    
    setExecuting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/night-audit/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || 'Failed to execute Night Audit');
      
      setSuccessMsg(`Night Audit completed successfully. ${result.data?.tasksCreated || 0} tasks created.`);
      fetchData(); // Refresh UI
      setActiveStep(0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  if (!propertyId) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-4">
          <Building className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-xl font-semibold text-slate-600">No Property Selected</h2>
          <p className="text-slate-500">Please select a property to run the Night Audit.</p>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  const blockers = data?.summary?.blockers || 0;
  const warnings = data?.summary?.warnings || 0;
  const readinessScore = Math.max(0, 100 - (blockers * 20) - (warnings * 5));
  
  let scoreColor = 'text-emerald-400';
  let badgeColor = 'bg-emerald-500/20 text-emerald-300';
  if (readinessScore < 100 && readinessScore >= 80) {
    scoreColor = 'text-amber-400';
    badgeColor = 'bg-amber-500/20 text-amber-300';
  } else if (readinessScore < 80) {
    scoreColor = 'text-rose-400';
    badgeColor = 'bg-rose-500/20 text-rose-300';
  }

  const steps = [
    { id: 'operational', title: 'Operational Audit', icon: Building, desc: 'Arrivals, Departures & Rooms' },
    { id: 'system', title: 'System Integrity', icon: MonitorSmartphone, desc: 'POS Sessions & Sync' },
    { id: 'financial', title: 'Financial Audit', icon: DollarSign, desc: 'High Balances & Open Folios' },
    { id: 'cash', title: 'Cash Reconciliation', icon: Wallet, desc: 'Cash Handovers & Deposits' },
    { id: 'room_charges', title: 'Room Charge Preview', icon: Receipt, desc: 'Preview tonight\'s postings' },
    { id: 'validation', title: 'Final Validation', icon: FileCheck, desc: 'System pre-flight check' },
    { id: 'execute', title: 'Execution', icon: Rocket, desc: 'Run the Night Audit' },
  ];

  const renderList = (title: string, items: any[], type: 'blocker' | 'warning' = 'blocker') => {
    const isBlocker = type === 'blocker';
    if (!items || items.length === 0) {
      return (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 transition-all">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm">{title} - Clear</span>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {isBlocker ? <XCircle className="w-5 h-5 text-rose-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{title} ({items.length})</h4>
        </div>
        <div className="grid gap-2">
          {items.map((item, idx) => (
            <div key={idx} className={`p-3 rounded-lg border text-sm flex items-center justify-between shadow-sm transition-all
              ${isBlocker ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300' 
                          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'}`}>
              <span className="font-medium">
                {item?.name || item?.id || (typeof item === 'string' ? item : JSON.stringify(item))}
              </span>
              <Button size="sm" variant="ghost" className={isBlocker ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-100' : 'text-amber-600 hover:text-amber-700 hover:bg-amber-100'}>
                Resolve
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStepContent = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderList('Pending Arrivals', data?.operational?.arrivals, 'blocker')}
            {renderList('Pending Departures', data?.operational?.departures, 'blocker')}
            <div className="md:col-span-2">
              {renderList('Room Reconciliation', data?.operational?.roomReconciliation, 'warning')}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid grid-cols-1 gap-4">
            {renderList('Open POS Sessions', data?.system?.openPosSessions, 'blocker')}
            {renderList('Financial Sync Conflicts', data?.system?.financialSyncConflicts, 'blocker')}
            {renderList('Hardware Agents offline', data?.system?.hardwareAgents, 'warning')}
          </div>
        );
      case 2:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderList('High Balance Folios', data?.financial?.highBalances, 'warning')}
            {renderList('Open Temporary Folios', data?.financial?.openFolios, 'blocker')}
          </div>
        );
      case 3:
        return (
          <div className="grid grid-cols-1 gap-4">
            {renderList('Pending Cash Handovers', data?.cash?.cashHandovers, 'blocker')}
            {renderList('Pending Bank Deposits', data?.cash?.bankDeposits, 'warning')}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Cash Tolerance Threshold</span>
              <Badge variant="secondary" className="font-mono text-sm">${data?.cash?.tolerance || 0}</Badge>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="p-6 text-center space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <Receipt className="w-12 h-12 mx-auto text-indigo-400" />
            <h3 className="text-lg font-semibold">Ready to Post Room Charges</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              The system is prepared to automatically post nightly room charges and packages for all in-house guests upon execution.
            </p>
          </div>
        );
      case 5:
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-1">
              <span className="text-3xl font-bold text-rose-500">{blockers}</span>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Blockers</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-1">
              <span className="text-3xl font-bold text-amber-500">{warnings}</span>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Warnings</p>
            </div>
            <div className="col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-3">
               {blockers === 0 ? (
                 <div className="flex items-center gap-2 text-emerald-600">
                    <ShieldCheck className="w-8 h-8" />
                    <span className="font-semibold">Ready for Execution</span>
                 </div>
               ) : (
                 <div className="flex items-center gap-2 text-rose-600">
                    <XCircle className="w-8 h-8" />
                    <span className="font-semibold">Resolve Blockers First</span>
                 </div>
               )}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">Execute Night Audit</h3>
              <p className="text-slate-500">Initiate the end-of-day sequence and roll the business date.</p>
            </div>
            
            <Button 
              size="lg" 
              onClick={handleExecute} 
              disabled={blockers > 0 || executing}
              className={`h-16 px-12 text-lg rounded-full shadow-lg transition-all ${
                blockers > 0 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500 hover:bg-slate-100' 
                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/25 hover:scale-105'
              }`}
            >
              {executing ? (
                <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> Processing Sequence...</>
              ) : (
                <><Play className="w-6 h-6 mr-3 fill-current" /> Initialize Sequence</>
              )}
            </Button>
            
            {blockers > 0 && (
              <p className="text-sm font-medium text-rose-500 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Cannot execute while blockers exist.
              </p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 font-sans pb-24">
      {/* Header Widget */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border border-slate-800 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl mix-blend-screen pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-2 text-center md:text-left flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Night Audit</h1>
            <p className="text-slate-400 font-medium">Business Date: <span className="text-white">{data?.businessDate ? format(new Date(data.businessDate), 'PPP') : 'Loading...'}</span></p>
          </div>

          <div className="flex flex-col items-center md:items-end space-y-3 bg-white/5 p-5 rounded-2xl backdrop-blur-md border border-white/10 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-300 uppercase tracking-widest">Readiness Score</span>
              <Badge className={`${badgeColor} border-0 rounded-full px-3 py-1 font-bold text-sm shadow-inner`}>
                {readinessScore}% Ready
              </Badge>
            </div>
            <div className="flex gap-6 mt-1">
              <div className="text-center">
                <div className="text-2xl font-bold text-rose-400">{blockers}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Blockers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">{warnings}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{10 - (blockers + warnings)}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Passed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <XCircle className="w-5 h-5 shrink-0" /> <span className="font-medium">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Vertical Stepper */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isActive = activeStep === index;
          const isPast = activeStep > index;
          const Icon = step.icon;

          return (
            <Card 
              key={step.id} 
              className={`overflow-hidden transition-all duration-300 border-2 shadow-sm ${
                isActive 
                  ? 'border-indigo-500 shadow-indigo-100 dark:shadow-indigo-900/20' 
                  : isPast 
                    ? 'border-emerald-500/30' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div 
                className={`flex items-center gap-4 p-4 md:p-6 cursor-pointer select-none ${isActive ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : ''}`}
                onClick={() => setActiveStep(index)}
              >
                <div className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 transition-colors ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' 
                    : isPast 
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}>
                  {isPast ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`text-lg font-semibold truncate ${isActive ? 'text-indigo-900 dark:text-indigo-100' : isPast ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    Step {index + 1}: {step.title}
                  </h3>
                  <p className="text-sm text-slate-500 truncate">{step.desc}</p>
                </div>

                <div className="shrink-0 text-slate-400">
                  <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {isActive && (
                <div className="px-4 pb-6 md:px-6 md:pb-6 pt-2 animate-in slide-in-from-top-4 fade-in duration-300">
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    {renderStepContent(index)}
                    
                    {index < steps.length - 1 && (
                      <div className="flex justify-end mt-8">
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveStep(index + 1);
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                          Continue to Next Step <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
