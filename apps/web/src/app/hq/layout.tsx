import { requireHQAdmin } from '@/lib/auth/hq';
import Link from 'next/link';
import { Shield, Building2, Package, Activity, FileText } from 'lucide-react';
import { Suspense } from 'react';

export default async function HQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure the user is a LodgeCore Admin.
  // This physically blocks normal hotel users from loading anything inside (hq)
  await requireHQAdmin();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-950">
      {/* HQ Sidebar */}
      <aside className="w-64 border-r bg-zinc-900 text-zinc-300 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-zinc-800">
          <Shield className="w-5 h-5 mr-3 text-blue-500" />
          <span className="font-bold text-white tracking-wide">LodgeCore HQ</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/hq" className="flex items-center px-3 py-2 rounded-md hover:bg-zinc-800 hover:text-white transition-colors">
            <Activity className="w-4 h-4 mr-3" />
            Dashboard
          </Link>
          <Link href="/hq/organizations" className="flex items-center px-3 py-2 rounded-md hover:bg-zinc-800 hover:text-white transition-colors">
            <Building2 className="w-4 h-4 mr-3" />
            Organizations
          </Link>
          <Link href="/hq/products" className="flex items-center px-3 py-2 rounded-md hover:bg-zinc-800 hover:text-white transition-colors">
            <Package className="w-4 h-4 mr-3" />
            Products & Pricing
          </Link>
          <Link href="/hq/invoices" className="flex items-center px-3 py-2 rounded-md hover:bg-zinc-800 hover:text-white transition-colors">
            <FileText className="w-4 h-4 mr-3" />
            Invoices
          </Link>
          <Link href="/hq/activity" className="flex items-center px-3 py-2 rounded-md hover:bg-zinc-800 hover:text-white transition-colors">
            <Shield className="w-4 h-4 mr-3" />
            Audit Log
          </Link>
        </nav>
        
        <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500">
          LodgeCore Control Plane v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<div className="p-8 text-zinc-500">Loading HQ...</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
