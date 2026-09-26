import { Metadata } from 'next';
import { prisma } from '@hotel-pms/db';
import { HallOnlyWizard } from '@/components/events/HallOnlyWizard';
import { getEquipment } from '@/lib/events/booking-actions';
import { auth } from '@/lib/auth';
export const metadata: Metadata = {
  title: 'Create Space Rental | LodgeCore',
};

export default async function CreateHallOnlyPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  if (!propertyId) throw new Error('No property is assigned to this account.');

  const halls = await prisma.hall.findMany({
    where: { propertyId, isActive: true },
    orderBy: { name: 'asc' },
  });
  const equipment = await getEquipment(propertyId);
  const [guests, corporateAccounts] = await Promise.all([
    prisma.guest.findMany({ where: { propertyId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: 'asc' }, take: 200 }),
    prisma.corporateAccount.findMany({ where: { propertyId, isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' }, take: 200 }),
  ]);
  const tax = await prisma.tax.findFirst({
    where: {
      propertyId,
      isActive: true,
      OR: [{ code: 'VAT' }, { name: { contains: 'VAT', mode: 'insensitive' } }],
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="fnb-dark-surface min-h-full p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Space Rental</h1>
        <p className="text-muted-foreground mt-1">Book halls and equipment.</p>
      </div>
      <HallOnlyWizard
        initialHalls={halls}
        equipmentList={equipment}
        guests={guests}
        corporateAccounts={corporateAccounts}
        taxRate={tax?.type === 'PERCENTAGE' ? Number(tax.rate) / 100 : 0}
      />
    </div>
  );
}
