import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Warehouse, ArrowRight } from 'lucide-react';
import WarehouseClientActions from './WarehouseClientActions';
import EditWarehouseDialog from './EditWarehouseDialog';

export default async function WarehousesPage() {
  const session = await auth();
  if (!session?.user?.propertyId) return null;

  const warehouses = await prisma.warehouse.findMany({
    where: { propertyId: session.user.propertyId },
    include: { _count: { select: { stockItems: true } } },
  });

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Warehouses</h1>
            <p className="text-slate-400 text-sm mt-1">Manage your storage locations across the property.</p>
          </div>
          <WarehouseClientActions />
        </div>
      </div>

      <div className="px-6 py-7 max-w-screen-xl mx-auto">
        {warehouses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Warehouse className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No warehouses yet</p>
            <p className="text-sm text-slate-400 mt-1">Create a warehouse to start managing stock locations.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {warehouses.map((warehouse) => (
              <div
                key={warehouse.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all p-6 flex flex-col group"
              >
                {/* Card top */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                    <Warehouse className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 truncate">{warehouse.name}</h3>
                      <EditWarehouseDialog
                        warehouse={{
                          id: warehouse.id,
                          name: warehouse.name,
                          location: warehouse.location,
                        }}
                      />
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {warehouse.location || 'No location set'}
                    </p>
                  </div>
                </div>

                {/* Card bottom */}
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-7 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                      {warehouse._count.stockItems}
                    </span>
                    <span className="text-xs text-slate-500">items tracked</span>
                  </div>
                  <Link
                    href={`/inventory/stock-items?warehouse=${warehouse.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    View Items <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
