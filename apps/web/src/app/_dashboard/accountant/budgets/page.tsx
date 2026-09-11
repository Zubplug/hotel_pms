import React from 'react';
import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  PieChart, 
  TrendingUp, 
  Download, 
  CalendarDays,
  Target,
  AlertCircle
} from 'lucide-react';

export default async function BudgetsPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  const budgets = propertyId ? await prisma.budget.findMany({ 
    where: { propertyId }
  }) : [];

  const colors = ['bg-emerald-500', 'bg-rose-500', 'bg-emerald-400', 'bg-blue-500', 'bg-emerald-300'];
  const departments = budgets.map((b, i) => ({
    name: b.name || 'Unnamed Budget',
    budget: Number(b.totalExpenseBudget || 0),
    actual: 0,
    color: colors[i % colors.length]
  }));

  const totalBudget = departments.reduce((acc, curr) => acc + curr.budget, 0);
  const totalActual = departments.reduce((acc, curr) => acc + curr.actual, 0);
  const totalPercent = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600">
            Departmental Budgets
          </h1>
          <p className="text-slate-400 mt-1">Track budget vs actuals across all departments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:text-slate-50">
            <CalendarDays className="w-4 h-4 mr-2" />
            FY 2026
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Allocated Budget</p>
                <h3 className="text-3xl font-semibold mt-2 text-slate-100">
                  ₦{(totalBudget / 1000000).toFixed(1)}M
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <Target className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Actual Spend</p>
                <h3 className="text-3xl font-semibold mt-2 text-slate-100">
                  ₦{(totalActual / 1000000).toFixed(2)}M
                </h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="w-full">
                <p className="text-slate-400 text-sm font-medium">Overall Burn Rate</p>
                <div className="flex items-end justify-between mt-2">
                  <h3 className="text-3xl font-semibold text-slate-100">
                    {totalPercent.toFixed(1)}%
                  </h3>
                  <span className="text-slate-500 text-sm mb-1">of total budget</span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2.5 mt-4 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(totalPercent, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actuals Tracking */}
      <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md shadow-xl">
        <CardHeader className="border-b border-slate-800/60 pb-6">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-xl text-slate-100">Department Breakdown</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Monitor expenditure against allocated departmental budgets
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          {departments.length === 0 ? (
            <div className="text-center text-slate-400 py-4">No data</div>
          ) : departments.map((dept) => {
            const percent = dept.budget > 0 ? (dept.actual / dept.budget) * 100 : 0;
            const isOver = percent > 100;
            
            return (
              <div key={dept.name} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-200">{dept.name}</h4>
                      {isOver && (
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      ₦{dept.actual.toLocaleString()} / ₦{dept.budget.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ₦{isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="relative w-full bg-slate-800/60 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ₦{isOver ? 'bg-rose-500' : dept.color}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                  {/* Budget Marker line if actual exceeds budget (conceptually, we cap the bar at 100%, so let's show an over-budget indicator differently if needed, but topping at 100% and coloring red is standard) */}
                </div>
                
                {isOver && (
                  <p className="text-xs text-rose-400/80">
                    Over budget by ₦{(dept.actual - dept.budget).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
