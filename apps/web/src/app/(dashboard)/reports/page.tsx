import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Users, CreditCard } from 'lucide-react';

export default function ReportsOverviewPage() {
  const reports = [
    {
      title: 'Shift / Cashier Report',
      description: 'View end-of-shift net cash, card, and online payments for specific cashiers or the entire property.',
      href: '/reports/shift',
      icon: Users,
    },
    {
      title: 'Aged Receivables',
      description: 'Track outstanding balances across all guests and easily access unpaid folios for settlement.',
      href: '/reports/receivables',
      icon: FileText,
    },
    {
      title: 'Gateway Reconciliation',
      description: 'Audit LodgeCore payments against online payment gateway settlements to identify discrepancies.',
      href: '/reports/gateway',
      icon: CreditCard,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-muted-foreground mt-2">
          Monitor your property's cash flow, receivables, and payment gateways.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {reports.map((report) => (
          <Link key={report.title} href={report.href}>
            <Card className="hover:border-primary/50 transition-colors h-full cursor-pointer group">
              <CardHeader>
                <div className="p-3 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <report.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <CardDescription className="pt-2">{report.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
