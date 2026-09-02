import { Metadata } from 'next';
import { Download, Search, Filter, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Goods Received | LodgeCore',
};

export default function GoodsReceivedPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Goods Received Notes (GRN)</h2>
          <p className="text-muted-foreground">
            Record incoming deliveries and update stock quantities.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="mr-2 h-4 w-4" />
            Receive Goods
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow flex flex-col mt-6">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search GRN number or PO ref..." 
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9"
            />
          </div>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-3">GRN Number</th>
                <th className="px-6 py-3">Linked PO</th>
                <th className="px-6 py-3">Supplier Delivery Ref</th>
                <th className="px-6 py-3">Received Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="bg-white hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium text-emerald-700">GRN-2026-0150</td>
                <td className="px-6 py-4 text-indigo-600 hover:underline cursor-pointer">PO-2026-0082</td>
                <td className="px-6 py-4">INV-99321</td>
                <td className="px-6 py-4 text-muted-foreground">Aug 16, 2026</td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-slate-100 text-slate-700">DRAFT</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="text-indigo-600">
                    <ClipboardCheck className="w-4 h-4 mr-2" />
                    Verify & Post
                  </Button>
                </td>
              </tr>
              <tr className="bg-slate-50 hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium text-emerald-700">GRN-2026-0149</td>
                <td className="px-6 py-4 text-indigo-600 hover:underline cursor-pointer">PO-2026-0079</td>
                <td className="px-6 py-4">DLV-8821</td>
                <td className="px-6 py-4 text-muted-foreground">Aug 11, 2026</td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">POSTED</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="text-indigo-600">View Details</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
