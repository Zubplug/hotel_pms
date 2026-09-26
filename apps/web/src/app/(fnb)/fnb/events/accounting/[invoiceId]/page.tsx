import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@hotel-pms/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireEventContext } from '@/lib/events/access';
import { issueEventInvoice, reviewEventInvoice, submitEventInvoiceForReview } from '@/lib/events/accounting-actions';

export const metadata: Metadata = { title: 'Event Invoice | LodgeCore' };

export default async function EventInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { propertyId } = await requireEventContext();
  const { invoiceId } = await params;
  const invoice = await prisma.eventInvoice.findFirst({
    where: { id: invoiceId, event: { propertyId } },
    include: { event: true, items: true },
  });
  if (!invoice) notFound();
  const finalizeAction = async () => {
    'use server';
    await issueEventInvoice(invoice.id);
  };
  const submitAction = async () => {
    'use server';
    await submitEventInvoiceForReview(invoice.id);
  };
  const reviewAction = async (formData: FormData) => {
    'use server';
    const approve = formData.get('decision') === 'approve';
    await reviewEventInvoice(invoice.id, {
      approve,
      discountAmount: Number(formData.get('discountAmount') || 0),
      discountReason: String(formData.get('discountReason') || ''),
    });
  };

  return <div className="fnb-dark-surface min-h-full space-y-6 p-6"><Button variant="link" asChild className="-ml-4 px-4"><Link href="/fnb/events/accounting">← Back to accounting</Link></Button><Card><CardHeader><CardTitle>Invoice {invoice.id.slice(0, 8).toUpperCase()}</CardTitle><p className="text-sm text-muted-foreground">{invoice.event?.name || 'Event invoice'} · Financial: {invoice.status} · Workflow: {invoice.workflowStatus}</p></CardHeader><CardContent><div className="space-y-3">{invoice.items.map(item => <div key={item.id} className="flex justify-between border-b pb-2 text-sm"><span>{item.description} × {item.quantity}</span><span>{Number(item.totalPrice).toLocaleString()} {invoice.currency}</span></div>)}<div className="flex justify-between text-sm"><span>Subtotal / taxable</span><span>{Number(invoice.subTotal).toLocaleString()} {invoice.currency}</span></div><div className="flex justify-between text-sm"><span>Discount</span><span>-{Number(invoice.totalDiscount).toLocaleString()} {invoice.currency}</span></div><div className="flex justify-between text-sm"><span>Tax</span><span>{Number(invoice.totalTax).toLocaleString()} {invoice.currency}</span></div><div className="flex justify-between font-semibold"><span>Total</span><span>{Number(invoice.totalAmount).toLocaleString()} {invoice.currency}</span></div><div className="flex justify-between text-sm text-muted-foreground"><span>Paid</span><span>{Number(invoice.paidAmount).toLocaleString()} {invoice.currency}</span></div><div className="flex flex-wrap gap-2 pt-4">{['DRAFT', 'REJECTED'].includes(invoice.workflowStatus) && <form action={submitAction}><Button type="submit">Submit for accounting review</Button></form>}{['SUBMITTED', 'IN_REVIEW'].includes(invoice.workflowStatus) && <form action={reviewAction} className="w-full space-y-2 rounded border p-4"><p className="text-sm font-medium">Accountant review</p><div className="flex flex-wrap gap-2"><input name="discountAmount" type="number" min="0" step="0.01" defaultValue={Number(invoice.requestedDiscount)} className="h-9 rounded border px-2" placeholder="Approved discount" /><input name="discountReason" className="h-9 min-w-64 rounded border px-2" placeholder="Discount reason / rejection reason" /><Button name="decision" value="approve" type="submit">Approve</Button><Button name="decision" value="reject" type="submit" variant="outline">Reject</Button></div></form>}{invoice.workflowStatus === 'APPROVED' && <form action={finalizeAction}><Button type="submit">General cashier: issue invoice</Button></form>}{invoice.folioId && invoice.workflowStatus === 'ISSUED' && <Button variant="outline" asChild><Link href={`/frontdesk/folios/${invoice.folioId}?eventInvoiceId=${invoice.id}`}>Open individual folio / receive payment</Link></Button>}</div></div></CardContent></Card></div>;
}
