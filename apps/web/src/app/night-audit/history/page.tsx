'use client';

import React, { useEffect, useState } from 'react';
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
import { Clock, Search, Filter, Download, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useProperty } from '@/components/PropertyProvider';
import { getNightAuditHistory } from '@/lib/night-audit-actions';

export default function AuditHistoryPage() {
  const { propertyId } = useProperty();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (propertyId) {
      getNightAuditHistory(propertyId).then(setHistory);
    }
  }, [propertyId]);

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
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
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
              {history.map((audit) => (
                <TableRow key={audit.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10">
                  <TableCell className="font-medium">
                    {new Date(audit.businessDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{audit.runReference || 'SYSTEM'}</TableCell>
                  <TableCell>--</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">{audit.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                      View Summary
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
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
    </div>
  );
}
