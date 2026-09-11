import Link from 'next/link';
import { BarChart3, BedDouble, ClipboardList, FileCheck2, FileText, Landmark, MoonStar, ReceiptText, Users, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const groups = [
  {
    title: 'Finance & cashier',
    description: 'Revenue control, cashier activity, and outstanding balances.',
    reports: [
      { title: 'Front Desk Reconciliation', description: 'Trace inflows and outflows by shift, staff, guest, room, folio, and payment method.', href: '/reports/frontdesk', icon: Landmark },
      { title: 'Shift / Cashier Report', description: 'Review end-of-shift cash, card, and online payment totals.', href: '/reports/shift', icon: Users },
      { title: 'Aged Receivables', description: 'Review outstanding folio balances and settlement exposure.', href: '/reports/receivables', icon: ReceiptText },
    ],
  },
  {
    title: 'Hotel operations',
    description: 'Daily operating performance across rooms and service departments.',
    reports: [
      { title: 'Room Status', description: 'Review occupancy, availability, housekeeping readiness, and room restrictions.', href: '/reports/room-status', icon: BedDouble },
      { title: 'Housekeeping', description: 'Monitor tasks, room readiness, completion, and outstanding workload.', href: '/reports/housekeeping', icon: ClipboardList },
      { title: 'Maintenance', description: 'Review open tickets, priorities, repair workload, and resolution status.', href: '/reports/maintenance', icon: Wrench },
    ],
  },
  {
    title: 'Audit & management packs',
    description: 'Read-only manager views for business-date controls and close review.',
    reports: [
      { title: 'Night Audit Dashboard', description: 'View audit readiness, blockers, warnings, business date, and audit activity.', href: '/general-manager/night-audit', icon: MoonStar },
      { title: 'Night Audit Reports', description: 'Open the detailed audit reports and manager flash pack.', href: '/general-manager/night-audit/reports', icon: FileCheck2 },
      { title: 'Management Overview', description: 'Return to the executive dashboard for portfolio KPIs and alerts.', href: '/general-manager', icon: BarChart3 },
    ],
  },
];

export default function ReportsOverviewPage() {
  return <div className="space-y-8 pb-10">
    <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-primary/80 p-6 text-white shadow-xl sm:p-8"><div className="flex items-start gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><FileText className="h-6 w-6" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Manager reporting centre</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Reports &amp; insight</h1><p className="mt-2 max-w-2xl text-sm text-white/70">Read-only operational and financial reporting across the property. Select a report area to review the latest business data.</p></div></div></div>
    {groups.map((group) => <section key={group.title}><div className="mb-4"><h2 className="text-xl font-bold tracking-tight">{group.title}</h2><p className="mt-1 text-sm text-muted-foreground">{group.description}</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{group.reports.map((report) => { const Icon = report.icon; return <Link key={report.href} href={report.href} className="group"><Card className="h-full border-muted/60 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-5 w-5" /></div><Badge variant="outline">View report</Badge></div><CardTitle className="pt-2 text-lg group-hover:text-primary">{report.title}</CardTitle><CardDescription>{report.description}</CardDescription></CardHeader></Card></Link>; })}</div></section>)}
  </div>;
}
