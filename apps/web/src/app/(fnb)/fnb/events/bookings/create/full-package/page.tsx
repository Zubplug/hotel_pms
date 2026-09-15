import { Metadata } from 'next';
import { prisma } from '@hotel-pms/db';
import { FullPackageWizard } from '@/components/events/FullPackageWizard';

export const metadata: Metadata = {
  title: 'Create Banquet Event | LodgeCore',
};

export default async function CreateFullPackagePage() {
  const halls = await prisma.hall.findMany({ orderBy: { name: 'asc' } });
  const packages = await prisma.banquetPackage.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Banquet Event</h1>
        <p className="text-muted-foreground mt-1">Comprehensive event planning for catered events and weddings.</p>
      </div>
      <FullPackageWizard initialHalls={halls} initialPackages={packages} />
    </div>
  );
}
