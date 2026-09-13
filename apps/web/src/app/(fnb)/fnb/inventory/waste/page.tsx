import { Metadata } from 'next';
import prisma from '@hotel-pms/db';
import { format } from 'date-fns';
import { Trash2, AlertCircle, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Waste Log | F&B Controls',
};

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

export default async function WasteLogPage() {
  const property = await prisma.property.findFirst({ where: { isActive: true } });
  if (!property) return <div>No active property found.</div>;
  const currency = property.baseCurrency || 'NGN';

  const wasteEntries = await prisma.kitchenWasteEntry.findMany({
    where: { propertyId: property.id },
    orderBy: { id: 'desc' }, // Fallback to id since there is no createdAt in this model? 
    // Wait, let's just fetch them
    include: {
      stockItem: true,
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8 font-sans">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-600 mb-3">
            <Trash2 className="h-4 w-4" /> Inventory Controls
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Waste Log</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-xl">
            Review logged kitchen waste, spoilage, and production losses affecting inventory valuation.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 shadow-sm">
            + Log Waste
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Item</th>
                <th className="px-6 py-4 text-right">Quantity</th>
                <th className="px-6 py-4 text-right">Unit Cost</th>
                <th className="px-6 py-4 text-right">Total Value</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wasteEntries.map(entry => (
                <tr key={entry.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{entry.stockItem?.name}</p>
                    {entry.notes && <p className="text-xs text-slate-500 mt-0.5">{entry.notes}</p>}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                    {Number(entry.quantity)} {entry.unitOfMeasure}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-500">
                    {money(Number(entry.unitCost), currency)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-rose-600">
                    {money(Number(entry.totalValue), currency)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {entry.reason.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      entry.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                      entry.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
              
              {wasteEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Trash2 className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-semibold text-slate-600">No waste logged yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
