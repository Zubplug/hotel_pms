import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@hotel-pms/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireEventContext } from '@/lib/events/access';

export const metadata: Metadata = { title: 'Event Invoice | LodgeCore' };

export default async function EventInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { propertyId } = await requireEventContext();
  const { invoiceId } = await params;
  const invoice = await prisma.eventInvoice.findFirst({
    where: { id: invoiceId, event: { propertyId } },
    include: { event: true, items: true },
  });
  if (!invoice) notFound();

  return <div className="space-y-6 p-6"><Button variant="link" asChild className="-ml-4 px-4"><Link href="/fnb/events/accounting">← Back to accounting</Link></Button><Card><CardHeader><CardTitle>Invoice {invoice.id.slice(0, 8).toUpperCase()}</CardTitle><p className="text-sm text-muted-foreground">{invoice.event?.name || 'Event invoice'} · {invoice.status}</p></CardHeader><CardContent><div className="space-y-3">{invoice.items.map(item => <div key={item.id} className="flex justify-between border-b pb-2 text-sm"><span>{item.description} × {item.quantity}</span><span>{Number(item.totalPrice).toLocaleString()} {invoice.currency}</span></div>)}<div className="flex justify-between font-semibold"><span>Total</span><span>{Number(invoice.totalAmount).toLocaleString()} {invoice.currency}</span></div><div className="flex justify-between text-sm text-muted-foreground"><span>Paid</span><span>{Number(invoice.paidAmount).toLocaleString()} {invoice.currency}</span></div></div></CardContent></Card></div>;
}
