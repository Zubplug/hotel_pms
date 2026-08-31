'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Clock, Search, Filter, Download, CheckCircle2, XCircle, Loader2, Calendar, User, BedDouble, Banknote, Activity, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useProperty } from '@/components/PropertyProvider';
import { getNightAuditHistory } from '@/lib/night-audit-actions';

export default function AuditHistoryPage() {
  const { propertyId } = useProperty();
  const [history, setHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedAudit, setSelectedAudit] = useState<any>(null);

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 0) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  useEffect(() => {
    if (propertyId) {
      getNightAuditHistory(propertyId).then(setHistory);
    }
  }, [propertyId]);

  
  const filteredHistory = useMemo(() => {
    return history.filter(audit => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const auditor = (audit.runReference || 'SYSTEM').toLowerCase();
        const date = new Date(audit.businessDate).toLocaleDateString().toLowerCase();
        if (!auditor.includes(query) && !date.includes(query)) return false;
      }
      if (dateRange.from && new Date(audit.businessDate) < new Date(dateRange.from)) return false;
      if (dateRange.to && new Date(audit.businessDate) > new Date(dateRange.to)) return false;
      return true;
    });
  }, [history, searchQuery, dateRange]);

  const exportCsv = () => {
    const header = ['Date', 'Auditor', 'Status', 'Duration', 'Rooms Charged'];
    const rows = filteredHistory.map(audit => [
      new Date(audit.businessDate).toLocaleDateString(),
      audit.runReference || 'SYSTEM',
      audit.status,
      formatDuration(audit.startedAt, audit.completedAt),
      audit.roomChargesPosted || 0
    ]);
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit_history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">
            Audit History
          </h1>
          <p className="text-muted-foreground mt-1">
            Review past night audits and their generated reports.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Button variant="outline" className="gap-2" onClick={() => setShowFilter(!showFilter)}>
            <Filter className="h-4 w-4" />
            Filter
            </Button>
            {showFilter && (
              <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-900 border shadow-lg rounded-xl p-4 z-10 w-64">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium">From Date</label>
                    <Input type="date" value={dateRange.from} onChange={e => setDateRange(prev => ({...prev, from: e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">To Date</label>
                    <Input type="date" value={dateRange.to} onChange={e => setDateRange(prev => ({...prev, to: e.target.value}))} />
                  </div>
                  <Button size="sm" className="w-full" onClick={() => setShowFilter(false)}>Apply Filter</Button>
                </div>
              </div>
            )}
          </div>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export Log
          </Button>
        </div>
      </div>

      <Card className="border-indigo-100 dark:border-indigo-900/50 shadow-md">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 border-b">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Past Executions</CardTitle>
              <CardDescription>A log of all completed night audits</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search date or auditor..."
                className="pl-8 bg-background"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Run By</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.map((audit) => (
                <TableRow key={audit.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10">
                  <TableCell className="font-medium">
                    {new Date(audit.businessDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{audit.runReference || 'SYSTEM'}</TableCell>
                  <TableCell>
                    {formatDuration(audit.startedAt, audit.completedAt)}
                  </TableCell>
                  <TableCell>
                    
                    {audit.status === 'COMPLETED' ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">{audit.status}</span>
                      </div>
                    ) : audit.status === 'FAILED' ? (
                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">{audit.status}</span>
                      </div>
                    ) : audit.status === 'IN_PROGRESS' || audit.status === 'POSTING' ? (
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">{audit.status}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <span className="text-sm font-medium">{audit.status || 'UNKNOWN'}</span>
                      </div>
                    )}

                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => setSelectedAudit(audit)}>
                      View Summary
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No audits found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={!!selectedAudit} onOpenChange={(open) => !open && setSelectedAudit(null)}>
        <DialogContent className="sm:max-w-md overflow-hidden p-0">
          <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-950 p-6">
            <DialogHeader className="border-b border-indigo-100/50 dark:border-slate-800 pb-5 mb-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none text-white">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">Audit Summary</DialogTitle>
                  <CardDescription className="mt-1 flex items-center gap-1.5 text-[15px] font-medium text-indigo-600 dark:text-indigo-400">
                    <Calendar className="h-4 w-4" />
                    {selectedAudit ? new Date(selectedAudit.businessDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </CardDescription>
                </div>
              </div>
            </DialogHeader>
            
            {selectedAudit && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 transition-all hover:shadow-md">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span>Auditor</span>
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-lg">{selectedAudit.runReference || 'SYSTEM'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 transition-all hover:shadow-md">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                      <Activity className="h-4 w-4 text-slate-400" />
                      <span>Status</span>
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-lg flex items-center gap-2">
                      {selectedAudit.status === 'COMPLETED' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : selectedAudit.status === 'FAILED' ? <XCircle className="h-5 w-5 text-rose-500" /> : <Clock className="h-5 w-5 text-amber-500" />}
                      {selectedAudit.status}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 transition-all hover:shadow-md">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>Duration</span>
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-lg">{formatDuration(selectedAudit.startedAt, selectedAudit.completedAt)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 transition-all hover:shadow-md">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                      <BedDouble className="h-4 w-4 text-slate-400" />
                      <span>Rooms Charged</span>
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-lg">{selectedAudit.roomChargesPosted || 0}</div>
                  </div>
                </div>
                
                <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-indigo-100/50 p-5 shadow-sm dark:border-indigo-500/20 dark:from-indigo-950/40 dark:to-indigo-900/20">
                  <div className="absolute -right-6 -top-6 opacity-10">
                    <Banknote className="h-32 w-32" />
                  </div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-medium mb-1">
                        <Banknote className="h-5 w-5" />
                        <span>Total Revenue Posted</span>
                      </div>
                      <div className="text-sm text-indigo-600/70 dark:text-indigo-400/70">From night audit postings</div>
                    </div>
                    <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(selectedAudit.revenuePosted || 0)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter className="mt-8 border-t border-slate-200/60 dark:border-slate-800 pt-5">
              <Button size="lg" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md" onClick={() => setSelectedAudit(null)}>Close Summary</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
