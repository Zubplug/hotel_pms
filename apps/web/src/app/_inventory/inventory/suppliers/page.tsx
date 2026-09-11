import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { Building2, Mail, Phone, User, Hash } from 'lucide-react';
import { AddSupplierDialog } from './AddSupplierDialog';

export default async function SuppliersPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  if (!propertyId) return <div>No property selected</div>;

  const suppliers = await prisma.supplier.findMany({
    where: { propertyId },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Suppliers</h1>
            <p className="text-slate-400 text-sm mt-1">Manage your inventory suppliers and vendor contacts.</p>
          </div>
          <AddSupplierDialog />
        </div>
      </div>

      <div className="px-6 py-7 max-w-screen-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <Building2 className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">All Suppliers</span>
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
              {suppliers.length}
            </span>
          </div>

          {suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No suppliers yet</p>
              <p className="text-sm text-slate-400 mt-1">Add your first supplier to start linking purchase orders.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['Name', 'Contact Person', 'Email', 'Phone', 'Tax ID', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider ${
                          i === 5 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">
                            {supplier.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800">{supplier.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {supplier.contactName || <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          {supplier.email || <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {supplier.phone || <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600 font-mono text-xs">
                          <Hash className="h-3.5 w-3.5 text-slate-400" />
                          {supplier.taxIdentifier || <span className="text-slate-400 not-italic font-sans">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {/* Edit action — handled by AddSupplierDialog or future edit dialog */}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
