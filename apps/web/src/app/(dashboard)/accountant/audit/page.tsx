'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileWarning, FileCheck, FileSearch, ShieldAlert, ArrowRight, DollarSign, Clock, AlertTriangle } from 'lucide-react';

// Hardcoded data
const auditStatus = {
  status: 'In Progress',
  progress: 65,
  lastCompleted: '2026-09-09 23:55:00',
  currentStep: 'Trial Balance Verification',
};

const trialBalanceExceptions = [
  { id: 'EX-001', description: 'Unbalanced Folio #1024', amount: 15.50, severity: 'High' },
  { id: 'EX-002', description: 'Pending Credit Card Batch #88', amount: 1250.00, severity: 'Medium' },
  { id: 'EX-003', description: 'Guest Ledger vs AR Mismatch', amount: 0.05, severity: 'Low' },
];

const folioBalances = [
  { room: '101', guest: 'Alice Smith', balance: 450.00, status: 'Checked In' },
  { room: '205', guest: 'Bob Johnson', balance: 1200.00, status: 'Due Out' },
  { room: '310', guest: 'Charlie Davis', balance: 0.00, status: 'Checked Out' },
  { room: '402', guest: 'Diana Evans', balance: -50.00, status: 'Checked In' },
];

export default function NightAuditPage() {
  return (
    <div className="p-6 space-y-6 bg-slate-950 text-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-400">Night Audit</h1>
          <p className="text-slate-400 mt-1">Audit status, trial balance exceptions, and folio balances.</p>
        </div>
        <Button className="mt-4 md:mt-0 bg-emerald-600 hover:bg-emerald-500 text-white">
          Run Night Audit <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Audit Status</CardTitle>
            <Clock className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{auditStatus.status}</div>
            <p className="text-xs text-slate-400 mt-1">Step: {auditStatus.currentStep}</p>
            <div className="w-full bg-slate-800 rounded-full h-2 mt-4">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${auditStatus.progress}%` }}></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Exceptions</CardTitle>
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{trialBalanceExceptions.length}</div>
            <p className="text-xs text-slate-400 mt-1">Requires resolution before closing</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Last Completed</CardTitle>
            <FileCheck className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-white">{new Date(auditStatus.lastCompleted).toLocaleDateString()}</div>
            <p className="text-xs text-slate-400 mt-1">{new Date(auditStatus.lastCompleted).toLocaleTimeString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center text-emerald-400">
              <AlertTriangle className="mr-2 h-5 w-5" /> Trial Balance Exceptions
            </CardTitle>
            <CardDescription className="text-slate-400">Discrepancies found during the current audit.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/10 hover:bg-white/5">
                  <TableHead className="text-slate-300">ID</TableHead>
                  <TableHead className="text-slate-300">Description</TableHead>
                  <TableHead className="text-slate-300 text-right">Amount</TableHead>
                  <TableHead className="text-slate-300">Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialBalanceExceptions.map((exception) => (
                  <TableRow key={exception.id} className="border-b border-white/5 hover:bg-white/5">
                    <TableCell className="font-medium text-slate-300">{exception.id}</TableCell>
                    <TableCell className="text-slate-300">{exception.description}</TableCell>
                    <TableCell className="text-right text-slate-300">${exception.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`
                        ${exception.severity === 'High' ? 'text-rose-400 border-rose-400/50' : 
                          exception.severity === 'Medium' ? 'text-amber-400 border-amber-400/50' : 
                          'text-emerald-400 border-emerald-400/50'}
                      `}>
                        {exception.severity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center text-emerald-400">
              <DollarSign className="mr-2 h-5 w-5" /> Open Folio Balances
            </CardTitle>
            <CardDescription className="text-slate-400">Current balances for in-house and due-out guests.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/10 hover:bg-white/5">
                  <TableHead className="text-slate-300">Room</TableHead>
                  <TableHead className="text-slate-300">Guest</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300 text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folioBalances.map((folio, index) => (
                  <TableRow key={index} className="border-b border-white/5 hover:bg-white/5">
                    <TableCell className="font-medium text-slate-300">{folio.room}</TableCell>
                    <TableCell className="text-slate-300">{folio.guest}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-800 text-slate-300 hover:bg-slate-700">
                        {folio.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                       <span className={folio.balance < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        ${Math.abs(folio.balance).toFixed(2)}
                        {folio.balance < 0 && ' CR'}
                       </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
