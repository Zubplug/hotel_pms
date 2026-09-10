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

const payrollRuns = [
  { id: 'PR-2026-09', period: 'Sep 2026', type: 'Regular', runDate: 'Sep 28, 2026', totalAmount: 425000, status: 'Processing' },
  { id: 'PR-2026-08', period: 'Aug 2026', type: 'Regular', runDate: 'Aug 28, 2026', totalAmount: 418000, status: 'Completed' },
  { id: 'PR-2026-07', period: 'Jul 2026', type: 'Regular', runDate: 'Jul 28, 2026', totalAmount: 420500, status: 'Completed' },
  { id: 'PR-2026-06', period: 'Jun 2026', type: 'Bonus', runDate: 'Jun 15, 2026', totalAmount: 150000, status: 'Completed' },
];

const deptLaborCosts = [
  { name: 'Engineering', employees: 42, cost: 185000 },
  { name: 'Marketing', employees: 18, cost: 65000 },
  { name: 'Sales', employees: 35, cost: 110000 },
  { name: 'Operations', employees: 85, cost: 220000 },
  { name: 'HR & Admin', employees: 12, cost: 45000 },
];

export default function PayrollPage() {
  const totalEmployees = deptLaborCosts.reduce((acc, curr) => acc + curr.employees, 0);
  const totalMonthlyCost = deptLaborCosts.reduce((acc, curr) => acc + curr.cost, 0);

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
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Banknote className="w-4 h-4 mr-2" />
            New Payroll Run
          </Button>
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
                <h3 className="text-2xl font-semibold mt-2 text-slate-100">Sep 28, 2026</h3>
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
                <h3 className="text-3xl font-semibold mt-2 text-slate-100">₦3.8M</h3>
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
                  {payrollRuns.map((run) => (
                    <TableRow key={run.id} className="border-slate-800/60 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="font-medium text-slate-200">
                        {run.period}
                        <div className="text-xs text-slate-500">{run.id}</div>
                      </TableCell>
                      <TableCell className="text-slate-300">{run.runDate}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-700 text-slate-300 bg-slate-800/50">
                          {run.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-200">
                        ₦{run.totalAmount.toLocaleString()}
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
                {deptLaborCosts.map((dept) => (
                  <div key={dept.name} className="flex flex-col space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-200">{dept.name}</span>
                      <span className="text-slate-300 font-medium">₦{dept.cost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>{dept.employees} Employees</span>
                      <span>{((dept.cost / totalMonthlyCost) * 100).toFixed(1)}% of total</span>
                    </div>
                    <div className="w-full bg-slate-800/60 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-1.5 rounded-full" 
                        style={{ width: `${(dept.cost / totalMonthlyCost) * 100}%` }}
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
