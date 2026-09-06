'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Clock, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Calendar, 
  User, 
  BedDouble, 
  Banknote, 
  FileText,
  Coffee,
  Package,
  CalendarClock
} from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

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
      setLoading(true);
      getNightAuditHistory(propertyId).then(data => {
        setHistory(data);
        setLoading(false);
      });
    }
  }, [propertyId]);

  const filteredHistory = useMemo(() => {
    return history.filter(audit => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const auditor = (audit.auditorName || 'SYSTEM').toLowerCase();
        const date = new Date(audit.businessDate).toLocaleDateString().toLowerCase();
        if (!auditor.includes(query) && !date.includes(query)) return false;
      }
      if (dateRange.from && new Date(audit.businessDate) < new Date(dateRange.from)) return false;
      if (dateRange.to && new Date(audit.businessDate) > new Date(dateRange.to)) return false;
      return true;
    });
  }, [history, searchQuery, dateRange]);

  const exportCsv = () => {
    const header = ['Date', 'Auditor', 'Status', 'Duration', 'Rooms Charged', 'Total Revenue'];
    const rows = filteredHistory.map(audit => [
      new Date(audit.businessDate).toLocaleDateString(),
      audit.auditorName,
      audit.status,
      formatDuration(audit.startedAt, audit.completedAt),
      audit.roomChargesPosted || 0,
      audit.totalRevenue || 0
    ]);
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'COMPLETED':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-xs font-bold uppercase tracking-wider">{status}</span>
          </div>
        );
      case 'FAILED':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
            <XCircle className="h-3.5 w-3.5" />
            <span className="text-xs font-bold uppercase tracking-wider">{status}</span>
          </div>
        );
      case 'IN_PROGRESS':
      case 'POSTING':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider">{status}</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-bold uppercase tracking-wider">{status || 'UNKNOWN'}</span>
          </div>
        );
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <CalendarClock className="h-8 w-8 text-indigo-600" />
            Audit History
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">
            Review past night audits, generated reports, and financial snapshots.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Button 
              variant="outline" 
              className={`w-full sm:w-auto gap-2 rounded-xl border-slate-200 shadow-sm transition-all ${showFilter ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-600 hover:text-slate-900'}`} 
              onClick={() => setShowFilter(!showFilter)}
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            {showFilter && (
              <div className="absolute top-full mt-3 right-0 bg-white/80 backdrop-blur-xl border border-slate-200 shadow-xl rounded-2xl p-5 z-20 w-[300px] animate-in slide-in-from-top-2">
                <h3 className="font-bold text-slate-900 mb-4">Filter Records</h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">From Date</label>
                    <Input 
                      type="date" 
                      className="rounded-lg bg-slate-50/50"
                      value={dateRange.from} 
                      onChange={e => setDateRange(prev => ({...prev, from: e.target.value}))} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">To Date</label>
                    <Input 
                      type="date" 
                      className="rounded-lg bg-slate-50/50"
                      value={dateRange.to} 
                      onChange={e => setDateRange(prev => ({...prev, to: e.target.value}))} 
                    />
                  </div>
                  <div className="pt-2 flex gap-2">
                    <Button variant="ghost" className="flex-1 rounded-lg" onClick={() => { setDateRange({from: '', to: ''}); setShowFilter(false); }}>Clear</Button>
                    <Button className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={() => setShowFilter(false)}>Apply</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Button 
            variant="outline"
            className="gap-2 rounded-xl border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50" 
            onClick={exportCsv}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Main Card */}
      <Card className="rounded-3xl border-slate-200/60 bg-white/60 backdrop-blur-xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white/40">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900">Past Executions</CardTitle>
            <p className="text-sm font-medium text-slate-500 mt-1">A log of all completed night audits</p>
          </div>
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search date or auditor..."
              className="pl-10 h-11 rounded-xl bg-white border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="w-[140px] font-bold text-slate-500 tracking-wider">Date</TableHead>
                <TableHead className="font-bold text-slate-500 tracking-wider">Auditor</TableHead>
                <TableHead className="font-bold text-slate-500 tracking-wider">Duration</TableHead>
                <TableHead className="font-bold text-slate-500 tracking-wider text-right">Revenue</TableHead>
                <TableHead className="font-bold text-slate-500 tracking-wider">Status</TableHead>
                <TableHead className="text-right font-bold text-slate-500 tracking-wider pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-500" />
                      <p className="text-sm font-medium">Loading history...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <FileText className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm font-medium">No audit records found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((audit) => (
                  <TableRow key={audit.id} className="hover:bg-slate-50/80 transition-colors group">
                    <TableCell className="font-bold text-slate-900 py-4">
                      {new Date(audit.businessDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                          {(audit.auditorName || 'SYS').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-700">{audit.auditorName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-600">
                      {formatDuration(audit.startedAt, audit.completedAt)}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 text-right">
                      {formatCurrency(audit.totalRevenue || 0)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(audit.status)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold tracking-wide opacity-0 group-hover:opacity-100 transition-opacity" 
                        onClick={() => setSelectedAudit(audit)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Advanced Details Dialog */}
      <Dialog open={!!selectedAudit} onOpenChange={(open) => !open && setSelectedAudit(null)}>
        <DialogContent className="sm:max-w-2xl overflow-hidden p-0 rounded-[2rem] border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-8">
            
            {/* Dialog Header */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30 text-white rotate-3">
                  <FileText className="h-7 w-7 -rotate-3" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Audit Summary</DialogTitle>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-indigo-600">
                    <Calendar className="h-4 w-4" />
                    {selectedAudit ? new Date(selectedAudit.businessDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </p>
                </div>
              </div>
              {selectedAudit && getStatusBadge(selectedAudit.status)}
            </div>
            
            {selectedAudit && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Meta Information Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <User className="h-4 w-4" /> Auditor
                    </div>
                    <div className="font-black text-slate-900 text-lg truncate" title={selectedAudit.auditorName || 'SYSTEM'}>
                      {selectedAudit.auditorName || 'SYSTEM'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <Clock className="h-4 w-4" /> Duration
                    </div>
                    <div className="font-black text-slate-900 text-lg">
                      {formatDuration(selectedAudit.startedAt, selectedAudit.completedAt)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <BedDouble className="h-4 w-4" /> Rooms Billed
                    </div>
                    <div className="font-black text-slate-900 text-lg">
                      {selectedAudit.roomChargesPosted || 0}
                    </div>
                  </div>
                </div>
                
                {/* Revenue Breakdown */}
                <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Banknote className="w-40 h-40" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">Financial Snapshot</h3>
                    
                    <div className="flex flex-col gap-6">
                      {/* Total Revenue */}
                      <div className="flex items-end justify-between border-b border-slate-100 pb-6">
                        <div>
                          <div className="text-3xl font-black text-slate-900 tracking-tight">
                            {formatCurrency(Number(selectedAudit.totalRevenue) || 0)}
                          </div>
                          <div className="text-sm font-medium text-slate-500 mt-1">Total Daily Revenue</div>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <Banknote className="h-6 w-6" />
                        </div>
                      </div>

                      {/* Sub Categories */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        
                        {/* Rooms */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                          <div className="flex items-center gap-2 text-slate-600 mb-2">
                            <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600">
                              <BedDouble className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Rooms</span>
                          </div>
                          <div className="font-black text-slate-900 text-lg">
                            {formatCurrency(Number(selectedAudit.financialSnapshot?.roomRevenue ?? selectedAudit.totalRoomRevenue ?? selectedAudit.totalRevenue ?? 0))}
                          </div>
                        </div>

                        {/* F&B */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                          <div className="flex items-center gap-2 text-slate-600 mb-2">
                            <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600">
                              <Coffee className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">F&B</span>
                          </div>
                          <div className="font-black text-slate-900 text-lg">
                            {formatCurrency(Number(selectedAudit.financialSnapshot?.fnbRevenue ?? 0))}
                          </div>
                        </div>

                        {/* Other */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                          <div className="flex items-center gap-2 text-slate-600 mb-2">
                            <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                              <Package className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Other</span>
                          </div>
                          <div className="font-black text-slate-900 text-lg">
                            {formatCurrency(Number(selectedAudit.financialSnapshot?.otherRevenue ?? 0))}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-slate-200/60 flex justify-end">
              <Button 
                className="h-12 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/20 transition-all active:scale-95" 
                onClick={() => setSelectedAudit(null)}
              >
                Close Summary
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
