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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Space Rental</h1>
        <p className="text-muted-foreground mt-1">Book halls and equipment.</p>
      </div>
      <HallOnlyWizard initialHalls={halls} equipmentList={equipment} />
    </div>
  );
}
