'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Search, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Employee = {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  position: string;
  status: string;
  salary: {
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    otherAllowances: number;
    currency: string;
    effectiveFrom?: string;
  } | null;
};
type SalaryCalculation = { basicSalary: number; housingAllowance: number; transportAllowance: number; otherAllowances: number; grossPay: number; payeTax: number; pensionEmployee: number; nhfDeduction: number; nhisDeduction: number; eligibleReliefs: number; loanRepayment: number; salaryAdvance: number; penaltyDeduction: number; totalDeductions: number; netPay: number; pensionEmployer: number; nsitfEmployer: number; itfEmployer: number; taxableIncome: number; cra: number };

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);

const numberValue = (value: unknown) => Number(value || 0);

export default function SalariesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<{ calculation: SalaryCalculation; currency: string; statutoryVersion: string } | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) { setBreakdown(null); return; }
    setBreakdownLoading(true);
    fetch(`/api/hr/salaries/${selectedId}/breakdown`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load salary breakdown')))
      .then((data) => setBreakdown(data))
      .catch((error) => console.error(error))
      .finally(() => setBreakdownLoading(false));
  }, [selectedId]);

  useEffect(() => {
    fetch('/api/hr/employees?limit=200')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Failed to load salaries')))
      .then((data) => setEmployees(data.employees || []))
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => employees.filter((employee) => {
    const matchesStatus = status === 'ALL' || employee.status === status;
    const haystack = `${employee.name} ${employee.employeeCode} ${employee.department} ${employee.position}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [employees, query, status]);

  const totals = useMemo(() => rows.reduce((summary, employee) => {
    const salary = employee.salary;
    summary.basic += numberValue(salary?.basicSalary);
    summary.allowances += numberValue(salary?.housingAllowance) + numberValue(salary?.transportAllowance) + numberValue(salary?.otherAllowances);
    return summary;
  }, { basic: 0, allowances: 0 }), [rows]);

  const exportCsv = () => {
    const header = ['Employee', 'Employee ID', 'Department', 'Basic Salary', 'Housing Allowance', 'Transport Allowance', 'Other Allowances', 'Gross Monthly Salary'];
    const body = rows.map((employee) => {
      const salary = employee.salary;
      const gross = numberValue(salary?.basicSalary) + numberValue(salary?.housingAllowance) + numberValue(salary?.transportAllowance) + numberValue(salary?.otherAllowances);
      return [employee.name, employee.employeeCode, employee.department, numberValue(salary?.basicSalary), numberValue(salary?.housingAllowance), numberValue(salary?.transportAllowance), numberValue(salary?.otherAllowances), gross];
    });
    const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'staff-salary-breakdown.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <main className="min-h-full space-y-6 bg-slate-950 p-5 text-slate-100 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">HR · Compensation</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Staff Salaries</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">View each employee&apos;s monthly salary package and the complete earnings breakdown.</p>
        </div>
        <Button onClick={exportCsv} variant="outline" className="gap-2 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"><Download className="h-4 w-4" />Export CSV</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Summary label="Staff shown" value={String(rows.length)} />
        <Summary label="Basic salary total" value={money(totals.basic)} />
        <Summary label="Gross monthly total" value={money(totals.basic + totals.allowances)} />
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff, department or ID" className="border-slate-700 bg-slate-950 pl-9 text-sm text-white" /></div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"><option value="ACTIVE">Active staff</option><option value="INACTIVE">Inactive staff</option><option value="ALL">All staff</option></select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Staff</th><th className="px-5 py-3">Basic</th><th className="px-5 py-3">Allowances</th><th className="px-5 py-3">Gross monthly</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" /></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Loading salary records…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No salary records found.</td></tr> : rows.map((employee) => {
                const salary = employee.salary;
                const allowances = numberValue(salary?.housingAllowance) + numberValue(salary?.transportAllowance) + numberValue(salary?.otherAllowances);
                const gross = numberValue(salary?.basicSalary) + allowances;
                return <tr key={employee.id} className="hover:bg-slate-800/40"><td className="px-5 py-4"><div className="font-semibold text-white">{employee.name}</div><div className="text-xs text-slate-500">{employee.employeeCode} · {employee.department}</div></td><td className="px-5 py-4 text-slate-200">{money(numberValue(salary?.basicSalary), salary?.currency)}</td><td className="px-5 py-4 text-slate-300">{money(allowances, salary?.currency)}</td><td className="px-5 py-4 font-semibold text-emerald-300">{money(gross, salary?.currency)}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">{employee.status}</span></td><td className="px-5 py-4 text-right"><button onClick={() => setSelectedId(selectedId === employee.id ? null : employee.id)} className="text-xs font-semibold text-teal-300 hover:text-teal-200">{selectedId === employee.id ? 'Hide breakdown' : 'View breakdown'}</button></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedId && (() => { const employee = employees.find((item) => item.id === selectedId); if (!employee) return null; return <BreakdownModal employee={employee} breakdown={breakdown} loading={breakdownLoading} onClose={() => setSelectedId(null)} />; })()}
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><WalletCards className="h-4 w-4 text-teal-400" />{label}</div><div className="mt-2 text-xl font-bold text-white">{value}</div></div>;
}

function BreakdownModal({ employee, breakdown, loading, onClose }: { employee: Employee; breakdown: { calculation: SalaryCalculation; currency: string; statutoryVersion: string } | null; loading: boolean; onClose: () => void }) {
  const salary = employee.salary;
  const earnings = [
    ['Basic salary', numberValue(salary?.basicSalary)],
    ['Housing allowance', numberValue(salary?.housingAllowance)],
    ['Transport allowance', numberValue(salary?.transportAllowance)],
    ['Other allowances', numberValue(salary?.otherAllowances)],
  ] as const;
  const gross = earnings.reduce((total, [, amount]) => total + amount, 0);
  const calculation = breakdown?.calculation;
  const deductions = calculation ? [['PAYE tax', calculation.payeTax], ['Employee pension', calculation.pensionEmployee], ['NHF', calculation.nhfDeduction], ['NHIS', calculation.nhisDeduction], ['Loan repayment', calculation.loanRepayment], ['Salary advance', calculation.salaryAdvance], ['Other liabilities / penalties', calculation.penaltyDeduction]] as const : [];
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-3xl"><DialogHeader><DialogTitle className="text-xl font-bold text-white">Salary breakdown · {employee.name}</DialogTitle><DialogDescription>{employee.position} · Effective {salary?.effectiveFrom ? new Date(salary.effectiveFrom).toLocaleDateString('en-NG') : 'not specified'}</DialogDescription></DialogHeader>{loading ? <div className="py-16 text-center text-sm text-slate-400">Calculating statutory deductions…</div> : calculation ? <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Summary label="Gross monthly" value={money(calculation.grossPay, breakdown?.currency)} /><Summary label="Total deductions" value={money(calculation.totalDeductions, breakdown?.currency)} /><Summary label="Estimated net pay" value={money(calculation.netPay, breakdown?.currency)} /></div><div className="grid gap-5 md:grid-cols-2"><section className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] p-4"><h3 className="font-semibold text-emerald-100">Earnings</h3><div className="mt-3 space-y-2">{earnings.map(([name, amount]) => <Row key={name} label={name} value={money(amount, breakdown?.currency)} />)}<div className="border-t border-white/10 pt-2"><Row label="Gross salary" value={money(calculation.grossPay, breakdown?.currency)} strong /></div></div></section><section className="rounded-xl border border-rose-400/20 bg-rose-400/[.05] p-4"><h3 className="font-semibold text-rose-100">Deductions</h3><div className="mt-3 space-y-2">{deductions.map(([name, amount]) => <Row key={name} label={name} value={money(amount, breakdown?.currency)} />)}<div className="border-t border-white/10 pt-2"><Row label="Total deductions" value={money(calculation.totalDeductions, breakdown?.currency)} strong /></div></div></section></div><section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="font-semibold text-white">Payroll calculation details</h3><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><Row label="Taxable income" value={money(calculation.taxableIncome, breakdown?.currency)} /><Row label="CRA relief" value={money(calculation.cra, breakdown?.currency)} /><Row label="Employer pension" value={money(calculation.pensionEmployer, breakdown?.currency)} /><Row label="NSITF employer cost" value={money(calculation.nsitfEmployer, breakdown?.currency)} /><Row label="ITF employer cost" value={money(calculation.itfEmployer, breakdown?.currency)} /><Row label="Rule version" value={breakdown?.statutoryVersion || 'Default'} /></div><p className="mt-4 text-xs leading-5 text-slate-500">This is an estimated monthly calculation using the current salary structure, active loan deductions, approved salary advances, and effective statutory rules. The final payslip is created when Payroll Runs is processed.</p></section></div> : <div className="py-10 text-center text-sm text-rose-300">Salary breakdown is unavailable.</div>}</DialogContent></Dialog>;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex justify-between gap-3 ${strong ? 'font-bold text-white' : 'text-slate-300'}`}><span>{label}</span><span>{value}</span></div>; }
