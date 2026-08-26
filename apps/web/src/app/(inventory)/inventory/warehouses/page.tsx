import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import WarehouseClientActions from './WarehouseClientActions';

export default async function WarehousesPage() {
  const session = await auth();
  if (!session?.user?.propertyId) return null;

  const warehouses = await prisma.warehouse.findMany({
    where: { propertyId: session.user.propertyId },
    include: {
      _count: {
        select: { stockItems: true }
      }
    }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Warehouses</h1>
          <p className="text-slate-500">Manage your storage locations across the property.</p>
        </div>
        <WarehouseClientActions />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.map((warehouse) => (
          <div key={warehouse.id} className="bg-white border border-slate-200 rounded-lg p-6 hover:border-zinc-700 transition-colors group flex flex-col shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 bg-slate-50 rounded-md text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{warehouse.name}</h3>
                </div>
                <p className="text-sm text-slate-500 pl-11">{warehouse.location || 'No location set'}</p>
              </div>
            </div>
            
            <div className="mt-auto pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                {warehouse._count.stockItems} Items
              </span>
              <Link href={`/inventory/stock-items?warehouse=${warehouse.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                View Items &rarr;
              </Link>
            </div>
          </div>
        ))}
        {warehouses.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
            No warehouses found. Create one to start managing stock.
          </div>
        )}
      </div>
    </div>
  );
}
