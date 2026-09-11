import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Banknote, 
  Clock, 
  CheckCircle2, 
  FileText,
  DollarSign,
  Briefcase
} from 'lucide-react';
import { RunPayrollDialog } from '@/components/accountant/RunPayrollDialog';

import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

export default async function PayrollPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  if (!propertyId) {
    return <div className="p-8 text-slate-400">Property ID not found</div>;
  }

  const [payrollPeriods, staffList] = await Promise.all([
    prisma.payrollPeriod.findMany({
      where: { propertyId },
      orderBy: { startDate: 'desc' },
    }),
    prisma.staff.findMany({
      where: { propertyAccess: { has: propertyId } },
    }),
  ]);

  const totalEmployees = staffList.length;

  const payrollRuns = payrollPeriods.map(p => ({
    id: p.id,
    period: p.name,
    type: 'Regular', // Assuming regular for now
    runDate: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : p.endDate.toISOString().split('T')[0],
    totalAmount: Number(p.totalGross || 0),
    status: p.status === 'PAID' ? 'Completed' : 'Processing',
  }));

  const ytdPayrollSpend = payrollPeriods
    .filter(p => p.startDate.getFullYear() === new Date().getFullYear())
    .reduce((acc, curr) => acc + Number(curr.totalGross || 0), 0);
  
  const mostRecentPayrollCost = payrollRuns[0]?.totalAmount || 0;
  const totalMonthlyCost = mostRecentPayrollCost;

  // Group staff by department
  const deptMap = staffList.reduce((acc, curr) => {
    const dept = curr.department || 'Unassigned';
    if (!acc[dept]) acc[dept] = 0;
    acc[dept]++;
    return acc;
  }, {} as Record<string, number>);

  const deptLaborCosts = Object.keys(deptMap).map(dept => {
    const count = deptMap[dept];
    const cost = totalEmployees > 0 ? (count / totalEmployees) * totalMonthlyCost : 0;
    return {
      name: dept,
      employees: count,
      cost,
    };
  });

  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600">
            Payroll Management
          </h1>
          <p className="text-slate-400 mt-1">Review payroll runs and departmental labor costs</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:text-slate-50">
            <FileText className="w-4 h-4 mr-2" />
            Tax Documents
          </Button>
          <RunPayrollDialog />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Active Employees</p>
                <h3 className="text-3xl font-semibold mt-2 text-slate-100">{totalEmployees}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium">Est. Monthly Labor Cost</p>
                <h3 className="text-3xl font-semibold mt-2 text-slate-100">₦{(totalMonthlyCost / 1000).toFixed(0)}k</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium">Next Run Date</p>
                <h3 className="text-2xl font-semibold mt-2 text-slate-100">{payrollRuns.find(r => r.status === 'Processing')?.runDate ?? 'N/A'}</h3>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium">YTD Payroll Spend</p>
                <h3 className="text-3xl font-semibold mt-2 text-slate-100">₦{(ytdPayrollSpend / 1000000).toFixed(1)}M</h3>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Briefcase className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payroll Runs */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md shadow-xl h-full">
            <CardHeader className="border-b border-slate-800/60 pb-6">
              <CardTitle className="text-xl text-slate-100">Recent Payroll Runs</CardTitle>
              <CardDescription className="text-slate-400">History of processed and upcoming payrolls</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-900/40">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-medium">Period</TableHead>
                    <TableHead className="text-slate-400 font-medium">Run Date</TableHead>
                    <TableHead className="text-slate-400 font-medium">Type</TableHead>
                    <TableHead className="text-slate-400 font-medium text-right">Total Amount</TableHead>
                    <TableHead className="text-slate-400 font-medium text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-400 py-6">No data</TableCell>
                    </TableRow>
                  )}
                  {payrollRuns.map((run) => (
                    <TableRow key={run.id} className="border-slate-800/60 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="font-medium text-slate-200">
                        {run.period}
                        <div className="text-xs text-slate-500">{run.id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell className="text-slate-300">{run.runDate}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-700 text-slate-300 bg-slate-800/50">
                          {run.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-200">
                        ₦{run.totalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.status === 'Completed' ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 hover:bg-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-400 border-0 hover:bg-amber-500/30">
                            <Clock className="w-3 h-3 mr-1" /> Processing
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Departmental Labor Costs */}
        <div className="space-y-6">
          <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md shadow-xl h-full">
            <CardHeader className="border-b border-slate-800/60 pb-6">
              <CardTitle className="text-xl text-slate-100">Labor by Department</CardTitle>
              <CardDescription className="text-slate-400">Current monthly cost distribution</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {deptLaborCosts.length === 0 && (
                  <div className="text-center text-slate-400 py-6">No data</div>
                )}
                {deptLaborCosts.map((dept) => (
                  <div key={dept.name} className="flex flex-col space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-200">{dept.name}</span>
                      <span className="text-slate-300 font-medium">₦{dept.cost.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>{dept.employees} Employees</span>
                      <span>{totalMonthlyCost > 0 ? ((dept.cost / totalMonthlyCost) * 100).toFixed(1) : 0}% of total</span>
                    </div>
                    <div className="w-full bg-slate-800/60 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-1.5 rounded-full" 
                        style={{ width: `${totalMonthlyCost > 0 ? (dept.cost / totalMonthlyCost) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
