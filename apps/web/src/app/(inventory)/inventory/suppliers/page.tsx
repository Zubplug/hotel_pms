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
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your inventory suppliers and vendors</p>
        </div>
        <AddSupplierDialog />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No suppliers found</h3>
            <p className="text-slate-500 text-sm max-w-sm">Get started by adding your first supplier to track purchase orders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Contact Person</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">Tax ID</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-100 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{supplier.name}</td>
                    <td className="px-6 py-4 text-slate-700">{supplier.contactName || '-'}</td>
                    <td className="px-6 py-4 text-slate-700">{supplier.email || '-'}</td>
                    <td className="px-6 py-4 text-slate-700">{supplier.phone || '-'}</td>
                    <td className="px-6 py-4 text-slate-700">{supplier.taxIdentifier || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-500 hover:text-slate-900 transition-colors p-2 rounded-md hover:bg-slate-200">
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
