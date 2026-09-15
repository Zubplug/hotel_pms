import { Metadata } from 'next';
import { prisma } from '@hotel-pms/db';
import { HallOnlyWizard } from '@/components/events/HallOnlyWizard';
import { getEquipment } from '@/lib/events/booking-actions';

export const metadata: Metadata = {
  title: 'Create Space Rental | LodgeCore',
};

export default async function CreateHallOnlyPage() {
  const halls = await prisma.hall.findMany({ orderBy: { name: 'asc' } });
  const equipment = await getEquipment();

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
