import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { Building2, Pencil } from 'lucide-react';
import { AddSupplierDialog } from './AddSupplierDialog';

export default async function SuppliersPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  if (!propertyId) {
    return <div>No property selected</div>;
  }

  const suppliers = await prisma.supplier.findMany({
    where: { propertyId },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Suppliers</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your inventory suppliers and vendors</p>
        </div>
        <AddSupplierDialog />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No suppliers found</h3>
            <p className="text-slate-400 text-sm max-w-sm">Get started by adding your first supplier to track purchase orders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Contact Person</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">Tax ID</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{supplier.name}</td>
                    <td className="px-6 py-4 text-slate-300">{supplier.contactName || '-'}</td>
                    <td className="px-6 py-4 text-slate-300">{supplier.email || '-'}</td>
                    <td className="px-6 py-4 text-slate-300">{supplier.phone || '-'}</td>
                    <td className="px-6 py-4 text-slate-300">{supplier.taxIdentifier || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-800">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
