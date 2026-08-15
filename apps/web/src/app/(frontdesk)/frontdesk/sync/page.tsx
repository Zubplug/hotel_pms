import { Metadata } from 'next';
import { CloudSync, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Sync Center | LodgeCore',
};

export default function SyncCenterPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sync Center</h2>
          <p className="text-muted-foreground">
            Manage offline synchronization and resolve data conflicts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Force Sync
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Network Status</h3>
            <CloudSync className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-emerald-500">Online</div>
            <p className="text-xs text-muted-foreground mt-1">
              Connected to lodgecore.com
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Pending Uploads</h3>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              All local data is synced
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-amber-50 text-card-foreground shadow border-amber-200">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-amber-800">Review Required</h3>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-amber-600">0</div>
            <p className="text-xs text-amber-700/80 mt-1">
              Double-bookings detected
            </p>
          </div>
        </div>
        
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Security Validation</h3>
            <ShieldCheck className="h-4 w-4 text-slate-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-slate-700">Verified</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ledger integrity intact
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Conflict Resolution Queue</h3>
        <div className="rounded-md border bg-white flex items-center justify-center h-48 text-muted-foreground text-sm">
          No pending conflicts to resolve. Great job!
        </div>
      </div>
    </div>
  );
}
