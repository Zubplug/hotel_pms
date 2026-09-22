import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { CityLedgerDetailClient } from './client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CityLedgerDetailPage(props: { params: Promise<{ id: string }>; allowNightAudit?: boolean }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'NIGHT_AUDITOR' && !props.allowNightAudit) redirect(`/night-audit/city-ledger/${params.id}`);
  
  const ctx = await requireOrganizationContext(session.user.id);

  const account = await prisma.cityLedgerAccount.findUnique({
    where: { id: params.id },
    include: {
      CorporateAccount: true,
      invoices: {
        where: {
          status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        },
        orderBy: { dueDate: 'asc' }
      },
      entries: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      }
    }
  });

  if (!account || !ctx.propertyIds.includes(account.propertyId)) {
    redirect('/accountant/city-ledger');
  }

  const paymentReferences = account.entries.filter(entry => entry.type === 'PAYMENT' && entry.reference).map(entry => entry.reference as string);
  const paymentAudit = paymentReferences.length ? await prisma.payment.findMany({
    where: { propertyId: account.propertyId, collectionSource: 'RECEIVABLES', reference: { in: paymentReferences } },
    select: { reference: true, receiptNumber: true, receivedBy: true, createdAt: true, frontdeskSession: { select: { shiftReference: true, staff: { select: { firstName: true, lastName: true } } } } },
  }) : [];
  const auditByReference = new Map(paymentAudit.flatMap(payment => [payment.reference, payment.receiptNumber].filter(Boolean).map(reference => [reference as string, { settledBy: payment.frontdeskSession?.staff ? `${payment.frontdeskSession.staff.firstName} ${payment.frontdeskSession.staff.lastName}`.trim() : payment.receivedBy, shiftReference: payment.frontdeskSession?.shiftReference || null, settledAt: payment.createdAt }] as const)));
  const auditedEntries = account.entries.map(entry => ({ ...entry, audit: entry.type === 'PAYMENT' && entry.reference ? auditByReference.get(entry.reference) || null : null }));

  // Calculate some summaries
  const totalOutstanding = account.invoices.reduce((sum, inv) => sum + Number(inv.outstandingAmount), 0);
  const asAt = new Date().getTime();

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-50 md:p-8">
      <div className="mx-auto max-w-7xl">
        <CityLedgerDetailClient 
          account={account as any} 
          openInvoices={account.invoices as any} 
          recentEntries={auditedEntries as any}
          totalOutstanding={totalOutstanding}
          asAt={asAt}
        />
      </div>
    </div>
  );
}
