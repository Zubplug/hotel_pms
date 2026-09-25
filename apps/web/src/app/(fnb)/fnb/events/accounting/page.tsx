import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExportReportButton, ViewInvoiceButton } from '@/components/events/AccountingButtons';
import { prisma } from '@hotel-pms/db';
import { requireEventContext } from '@/lib/events/access';

export const metadata: Metadata = {
  title: 'Event Accounting | LodgeCore',
};

export default async function EventAccountingPage() {
  const { propertyId } = await requireEventContext();
  const invoices = await prisma.eventInvoice.findMany({
    where: { event: { propertyId } },
    orderBy: { createdAt: 'desc' },
    include: { event: true },
    take: 50
  });

  const allUnpaid = await prisma.eventInvoice.findMany({
    where: { status: 'ISSUED', event: { propertyId } },
    select: { totalAmount: true, paidAmount: true }
  });
  
  const allAr = await prisma.eventInvoice.findMany({
    where: { status: 'ISSUED', event: { propertyId }, cityLedgerAccountId: { not: null } },
    select: { totalAmount: true, paidAmount: true }
  });

  const allPartial = await prisma.eventInvoice.findMany({
    where: { status: 'PARTIAL', event: { propertyId } },
    select: { paidAmount: true }
  });

  const unpaidValue = allUnpaid.reduce((acc, inv) => acc + (inv.totalAmount.toNumber() - inv.paidAmount.toNumber()), 0);
  const depositValue = allPartial.reduce((acc, inv) => acc + inv.paidAmount.toNumber(), 0);
  const arValue = allAr.reduce((acc, inv) => acc + (inv.totalAmount.toNumber() - inv.paidAmount.toNumber()), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Accounting</h1>
          <p className="text-muted-foreground mt-1">Manage event invoices, deposits, AR, and GL integration.</p>
        </div>
        <ExportReportButton invoices={invoices.map(inv => ({ event: inv.event?.name || 'Event', status: inv.status, total: Number(inv.totalAmount), paid: Number(inv.paidAmount), currency: inv.currency }))} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Deposits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">NGN {depositValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">NGN {unpaidValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">City Ledger AR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">NGN {arValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>All generated event invoices and deposit requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{inv.event?.name || 'Unknown'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{Number(inv.totalAmount).toLocaleString()} {inv.currency}</td>
                      <td className="px-4 py-3 text-right">{Number(inv.paidAmount).toLocaleString()} {inv.currency}</td>
                      <td className="px-4 py-3 text-right">
                        <ViewInvoiceButton invoiceId={inv.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
