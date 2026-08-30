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
import { Clock, Search, Filter, Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
      audit.startedAt && audit.completedAt ? Math.round((new Date(audit.completedAt).getTime() - new Date(audit.startedAt).getTime()) / 60000) + ' min' : '-',
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
                    {audit.startedAt && audit.completedAt ? Math.round((new Date(audit.completedAt).getTime() - new Date(audit.startedAt).getTime()) / 60000) + ' min' : '—'}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit Summary</DialogTitle>
          </DialogHeader>
          {selectedAudit && (
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2"><span>Date:</span> <span className="font-medium">{new Date(selectedAudit.businessDate).toLocaleDateString()}</span></div>
              <div className="flex justify-between border-b pb-2"><span>Auditor:</span> <span className="font-medium">{selectedAudit.runReference || 'SYSTEM'}</span></div>
              <div className="flex justify-between border-b pb-2"><span>Status:</span> <span className="font-medium">{selectedAudit.status}</span></div>
              <div className="flex justify-between border-b pb-2"><span>Rooms Charged:</span> <span className="font-medium">{selectedAudit.roomChargesPosted || 0}</span></div>
              <div className="flex justify-between border-b pb-2"><span>Revenue Posted:</span> <span className="font-medium">{selectedAudit.revenuePosted || 0}</span></div>
              <div className="flex justify-between border-b pb-2"><span>Duration:</span> <span className="font-medium">{selectedAudit.startedAt && selectedAudit.completedAt ? Math.round((new Date(selectedAudit.completedAt).getTime() - new Date(selectedAudit.startedAt).getTime()) / 60000) + ' min' : '—'}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelectedAudit(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
