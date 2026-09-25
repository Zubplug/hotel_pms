import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { prisma } from '@hotel-pms/db';
import { requireEventContext } from '@/lib/events/access';
import { PackageForm } from '@/components/events/CatalogControls';

export const metadata: Metadata = {
  title: 'Banquet Packages | LodgeCore',
};

export default async function BanquetPackagesPage() {
  const { propertyId } = await requireEventContext();
  const packages = await prisma.banquetPackage.findMany({
    where: { propertyId },
    orderBy: { name: 'asc' },
    include: { items: true }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Packages & Equipment</h1>
          <p className="text-muted-foreground mt-1">Manage banquet packages, equipment rentals, and POS linkages.</p>
        </div>
        <PackageForm />
      </div>

      {packages.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <CardHeader>
            <CardTitle>No Packages Found</CardTitle>
            <CardDescription>Create your first event or catering package.</CardDescription>
          </CardHeader>
          <CardContent>
            <PackageForm />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packages.map(pkg => (
            <Card key={pkg.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    <CardDescription>{pkg.isHallOnly ? 'Hall Only' : 'Catering / Banquet'}</CardDescription>
                  </div>
                  <Package className="h-5 w-5 text-muted-foreground opacity-50" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-4">
                  {Number(pkg.basePrice).toLocaleString('en-US', { style: 'currency', currency: 'NGN' })}
                </div>
                <div className="text-sm text-muted-foreground mb-6">
                  {pkg.items.length} items included
                </div>
                <PackageForm pkg={{ id: pkg.id, name: pkg.name, description: pkg.description, basePrice: pkg.basePrice.toString(), isHallOnly: pkg.isHallOnly }} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
