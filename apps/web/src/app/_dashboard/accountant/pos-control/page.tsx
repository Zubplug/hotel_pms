'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, MonitorSmartphone, WifiOff, RefreshCcw, HandCoins, UserX, ReceiptText } from 'lucide-react';

// Hardcoded data
const shiftSummaries = [
  { shiftId: 'SH-101', terminal: 'Restaurant POS 1', cashier: 'John Doe', netSales: 1250.00, cashCollected: 300.00, cardCollected: 950.00, variance: 0.00, status: 'Closed' },
  { shiftId: 'SH-102', terminal: 'Bar POS 1', cashier: 'Sarah Lee', netSales: 850.50, cashCollected: 150.00, cardCollected: 700.50, variance: 0.00, status: 'Closed' },
  { shiftId: 'SH-103', terminal: 'Spa POS 1', cashier: 'Mike Brown', netSales: 450.00, cashCollected: 50.00, cardCollected: 395.00, variance: -5.00, status: 'Closed' },
  { shiftId: 'SH-104', terminal: 'Restaurant POS 2', cashier: 'Emma Wilson', netSales: 920.00, cashCollected: 220.00, cardCollected: 700.00, variance: 0.00, status: 'Open' },
];

const voidsComps = [
  { id: 'VC-001', type: 'Void', terminal: 'Bar POS 1', user: 'Sarah Lee', amount: 25.00, reason: 'Wrong item ordered', time: '14:23', approvedBy: 'Manager A' },
  { id: 'VC-002', type: 'Comp', terminal: 'Restaurant POS 1', user: 'John Doe', amount: 150.00, reason: 'VIP Guest', time: '19:45', approvedBy: 'Manager B' },
  { id: 'VC-003', type: 'Void', terminal: 'Spa POS 1', user: 'Mike Brown', amount: 12.00, reason: 'System error', time: '10:15', approvedBy: 'Auto' },
];

const syncStatus = [
  { terminal: 'Restaurant POS 1', status: 'Online', lastSync: 'Just now', pendingChecks: 0 },
  { terminal: 'Restaurant POS 2', status: 'Online', lastSync: '2 mins ago', pendingChecks: 0 },
  { terminal: 'Bar POS 1', status: 'Online', lastSync: 'Just now', pendingChecks: 0 },
  { terminal: 'Pool POS 1', status: 'Offline', lastSync: '45 mins ago', pendingChecks: 12 },
  { terminal: 'Spa POS 1', status: 'Online', lastSync: '5 mins ago', pendingChecks: 0 },
];

export default function POSControlPage() {
  return (
    <div className="p-6 space-y-6 bg-slate-950 text-slate-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-emerald-400">POS Control</h1>
        <p className="text-slate-400 mt-1">Cashier shift summaries, voids/comps audit, and offline sync status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Net Sales</CardTitle>
            <FileText className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">₦3,470.50</div>
            <p className="text-xs text-slate-400 mt-1">+12% from yesterday</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Variance</CardTitle>
            <HandCoins className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">-₦5.00</div>
            <p className="text-xs text-slate-400 mt-1">Across all closed shifts</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Voids & Comps</CardTitle>
            <UserX className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">₦187.00</div>
            <p className="text-xs text-slate-400 mt-1">3 transactions today</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Offline Terminals</CardTitle>
            <WifiOff className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">1</div>
            <p className="text-xs text-slate-400 mt-1">12 checks pending sync</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-emerald-400">
            <ReceiptText className="mr-2 h-5 w-5" /> Cashier Shift Summaries
          </CardTitle>
          <CardDescription className="text-slate-400">Overview of all POS shifts for the current date.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/10 hover:bg-white/5">
                <TableHead className="text-slate-300">Shift ID</TableHead>
                <TableHead className="text-slate-300">Terminal</TableHead>
                <TableHead className="text-slate-300">Cashier</TableHead>
                <TableHead className="text-slate-300 text-right">Net Sales</TableHead>
                <TableHead className="text-slate-300 text-right">Cash</TableHead>
                <TableHead className="text-slate-300 text-right">Card</TableHead>
                <TableHead className="text-slate-300 text-right">Variance</TableHead>
                <TableHead className="text-slate-300">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftSummaries.map((shift) => (
                <TableRow key={shift.shiftId} className="border-b border-white/5 hover:bg-white/5">
                  <TableCell className="font-medium text-slate-300">{shift.shiftId}</TableCell>
                  <TableCell className="text-slate-300">{shift.terminal}</TableCell>
                  <TableCell className="text-slate-300">{shift.cashier}</TableCell>
                  <TableCell className="text-right text-slate-300">₦{shift.netSales.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-slate-300">₦{shift.cashCollected.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-slate-300">₦{shift.cardCollected.toFixed(2)}</TableCell>
                  <TableCell className={`text-right ₦{shift.variance < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    ₦{shift.variance.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      shift.status === 'Closed' ? 'text-emerald-400 border-emerald-400/50' : 'text-amber-400 border-amber-400/50'
                    }>
                      {shift.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-emerald-400">
              <UserX className="mr-2 h-5 w-5" /> Voids & Comps Audit
            </CardTitle>
            <CardDescription className="text-slate-400">Recent void and comp transactions requiring review.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/10 hover:bg-white/5">
                  <TableHead className="text-slate-300">Type</TableHead>
                  <TableHead className="text-slate-300">Details</TableHead>
                  <TableHead className="text-slate-300">Reason</TableHead>
                  <TableHead className="text-slate-300 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voidsComps.map((vc) => (
                  <TableRow key={vc.id} className="border-b border-white/5 hover:bg-white/5">
                    <TableCell>
                      <Badge variant="secondary" className={vc.type === 'Void' ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'}>
                        {vc.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-300">{vc.terminal}</div>
                      <div className="text-xs text-slate-500">{vc.user} • {vc.time}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-300">
                      {vc.reason}
                      <div className="text-xs text-slate-500">Appr: {vc.approvedBy}</div>
                    </TableCell>
                    <TableCell className="text-right text-slate-300 font-medium">
                      ₦{vc.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-emerald-400">
              <RefreshCcw className="mr-2 h-5 w-5" /> Offline Sync Status
            </CardTitle>
            <CardDescription className="text-slate-400">Connectivity status for all active POS terminals.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/10 hover:bg-white/5">
                  <TableHead className="text-slate-300">Terminal</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Last Sync</TableHead>
                  <TableHead className="text-slate-300 text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncStatus.map((terminal, index) => (
                  <TableRow key={index} className="border-b border-white/5 hover:bg-white/5">
                    <TableCell className="font-medium text-slate-300 flex items-center">
                      <MonitorSmartphone className="mr-2 h-4 w-4 text-slate-400" />
                      {terminal.terminal}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ₦{terminal.status === 'Online' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                        <span className={terminal.status === 'Online' ? 'text-emerald-400' : 'text-rose-400'}>{terminal.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300 text-sm">{terminal.lastSync}</TableCell>
                    <TableCell className="text-right">
                      {terminal.pendingChecks > 0 ? (
                        <Badge variant="destructive" className="bg-rose-500/20 text-rose-300 hover:bg-rose-500/30">
                          {terminal.pendingChecks} checks
                        </Badge>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
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
