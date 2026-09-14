import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { CityLedgerDetailClient } from './client';

export default async function CityLedgerDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  
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

  // Calculate some summaries
  const totalOutstanding = account.invoices.reduce((sum, inv) => sum + Number(inv.outstandingAmount), 0);

  return (
    <div className="mx-auto max-w-7xl">
      <CityLedgerDetailClient 
        account={account as any} 
        openInvoices={account.invoices as any} 
        recentEntries={account.entries as any} 
        totalOutstanding={totalOutstanding}
      />
    </div>
  );
}
