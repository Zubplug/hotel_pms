import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@hotel-pms/db';
import { HubStatusBanner } from '@/components/hub/HubStatusBanner';
import { 
  Building2, 
  UtensilsCrossed, 
  Sparkles, 
  Banknote, 
  Package, 
  BarChart3, 
  Moon, 
  RefreshCw, 
  Wrench,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * Role-based landing page resolver.
 * Returns the direct dashboard URL for single-purpose roles so they
 * skip the hub tile-picker and land in their professional workspace.
 * Multi-role users (e.g. MANAGER with many capabilities) stay on /hub.
 */
function getDirectLandingUrl(
  role: string,
  capabilities: string[],
  isSuperAdmin: boolean
): string | null {
  // Super admins and management roles → Management Dashboard
  if (
    isSuperAdmin ||
    ['CEO', 'SUPER_ADMIN', 'MANAGER'].includes(role)
  ) {
    return '/dashboard';
  }

  // Front desk roles → Front Desk workspace
  if (['RECEPTIONIST', 'FRONT_DESK'].includes(role)) {
    return '/frontdesk';
  }

  // Stock / Procurement roles → Inventory dashboard
  if (['STOCK_MANAGER', 'PROCUREMENT_MANAGER'].includes(role)) {
    return '/inventory';
  }

  // Night Auditors → Night Audit
  if (role === 'NIGHT_AUDITOR') {
    return '/night-audit';
  }

  // Cashiers → Cash Office
  if (role === 'GENERAL_CASHIER') {
    return '/cash-management';
  }

  // Single-capability staff (e.g. housekeeping-only, POS-only)
  if (capabilities.length === 1) {
    const singleCapMap: Record<string, string> = {
      ACCESS_FRONT_DESK: '/frontdesk',
      ACCESS_HOUSEKEEPING: '/housekeeping',
      ACCESS_POS: '/pos',
      ACCESS_CASH_MANAGEMENT: '/cash-management',
      ACCESS_INVENTORY: '/inventory',
      ACCESS_MAINTENANCE: '/maintenance',
      ACCESS_NIGHT_AUDIT: '/night-audit',
    };
    return singleCapMap[capabilities[0]] ?? null;
  }

  // Multi-capability staff → show hub tile picker
  return null;
}

export default async function HubPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const { id: userId, email, role, capabilities = [], propertyId, isSuperAdmin } = session.user as any;
  const userName = session.user.name || email?.split('@')[0] || 'User';

  // Smart role-based redirect — single-purpose roles skip the hub entirely
  const directUrl = getDirectLandingUrl(role, capabilities, isSuperAdmin);
  if (directUrl) {
    redirect(directUrl);
  }

  // Format business date (Today for now, could be fetched from Property settings)
  const businessDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // 1. Fetch My Shift details (e.g. active POS Session)
  let activePosSession = null;
  if (capabilities.includes('ACCESS_POS') && propertyId) {
    activePosSession = await prisma.posSession.findFirst({
      where: { 
        outlet: { propertyId: propertyId },
        status: 'OPEN',
        openedBy: userId
      },
      include: { outlet: true }
    });
  }

  // 2. Fetch Tasks/Alerts (Conflicts, Low Stock)
  let syncConflictsCount = 0;
  if (capabilities.includes('ACCESS_SYNC_CENTER') && propertyId) {
    syncConflictsCount = await prisma.syncConflict.count({
      where: { propertyId, status: 'PENDING' }
    });
  }

  let inventoryAlertsCount = 0;
  if (capabilities.includes('ACCESS_INVENTORY') && propertyId) {
    inventoryAlertsCount = await prisma.inventoryAlert.count({
      where: { propertyId, status: 'OPEN' }
    });
  }

  let roomsClean = 0;
  if (capabilities.includes('ACCESS_HOUSEKEEPING') && propertyId) {
    roomsClean = await prisma.room.count({
      where: { propertyId, status: 'CLEAN' }
    });
  }

  const tiles = [
    { cap: 'ACCESS_FRONT_DESK', label: 'FRONT DESK', icon: Building2, href: '/frontdesk', color: 'bg-indigo-600 hover:bg-indigo-700' },
    { cap: 'ACCESS_POS', label: 'POINT OF SALE', icon: UtensilsCrossed, href: '/pos', color: 'bg-emerald-600 hover:bg-emerald-700' },
    { cap: 'ACCESS_HOUSEKEEPING', label: 'HOUSEKEEPING', icon: Sparkles, href: '/housekeeping', color: 'bg-cyan-600 hover:bg-cyan-700' },
    { cap: 'ACCESS_CASH_MANAGEMENT', label: 'CASH MANAGEMENT', icon: Banknote, href: '/cash-management', color: 'bg-green-600 hover:bg-green-700' },
    { cap: 'ACCESS_INVENTORY', label: 'INVENTORY', icon: Package, href: '/inventory', color: 'bg-amber-600 hover:bg-amber-700' },
    { cap: 'ACCESS_MAINTENANCE', label: 'MAINTENANCE', icon: Wrench, href: '/maintenance', color: 'bg-orange-600 hover:bg-orange-700' },
    { cap: 'ACCESS_MANAGEMENT', label: 'MANAGEMENT', icon: BarChart3, href: '/dashboard', color: 'bg-slate-700 hover:bg-slate-600' },
    { cap: 'ACCESS_NIGHT_AUDIT', label: 'NIGHT AUDIT', icon: Moon, href: '/night-audit', color: 'bg-purple-600 hover:bg-purple-700' },
    { cap: 'ACCESS_SYNC_CENTER', label: 'SYNC CENTER', icon: RefreshCw, href: '/sync-center', color: 'bg-blue-600 hover:bg-blue-700' },
  ];

  return (
    <div className="flex-1 flex flex-col pb-12">
      <HubStatusBanner 
        user={{ name: userName, role: role, propertyId }} 
        businessDate={businessDate} 
      />

      <div className="flex-1 max-w-7xl w-full mx-auto p-8 pt-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">GOOD MORNING, {userName.toUpperCase()}</h2>
          <p className="text-slate-400 text-lg">What would you like to do today?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Main Tiles Area - Takes up 8 columns */}
          <div className="md:col-span-8">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {tiles.filter(t => capabilities.includes(t.cap)).map(tile => (
                <Link key={tile.cap} href={tile.href} className={`
                  ${tile.color} rounded-2xl p-6 flex flex-col items-center justify-center
                  shadow-lg transition-all duration-200 transform hover:scale-105 hover:shadow-xl
                  aspect-square text-white group cursor-pointer
                `}>
                  <tile.icon className="w-16 h-16 mb-4 opacity-90 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                  <span className="font-bold tracking-wider text-sm text-center leading-tight">
                    {tile.label}
                  </span>
                </Link>
              ))}
              
              {capabilities.length === 0 && (
                <div className="col-span-3 p-8 border border-slate-700 rounded-2xl bg-slate-800 text-center">
                  <p className="text-slate-400 mb-2">No workspace capabilities assigned.</p>
                  <p className="text-slate-500 text-sm">Please contact your administrator to configure your role.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Area (My Shift & Alerts) - Takes up 4 columns */}
          <div className="md:col-span-4 space-y-6">
            
            {/* My Shift */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-md">
              <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-4 border-b border-slate-700 pb-2">My Shift</h3>
              
              {activePosSession ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Outlet:</span>
                    <span className="font-semibold text-white">{activePosSession.outlet?.name || 'POS Terminal'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Status:</span>
                    <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold border border-emerald-500/30">OPEN</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Opening Float:</span>
                    <span className="font-semibold text-white">₦{Number(activePosSession.openingCash).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Expected Cash:</span>
                    <span className="font-semibold text-white">₦{Number(activePosSession.expectedCash).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Department:</span>
                    <span className="font-semibold text-white">{role === 'FRONT_DESK' ? 'Front Desk' : role}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Shift:</span>
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/30">DAY</span>
                  </div>
                </div>
              )}
            </div>

            {/* Today's Attention */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-md">
              <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-4 border-b border-slate-700 pb-2">Today&apos;s Attention</h3>
              
              <ul className="space-y-4">
                {capabilities.includes('ACCESS_SYNC_CENTER') && (
                  <li className="flex items-center gap-3">
                    {syncConflictsCount > 0 ? (
                      <><AlertTriangle className="w-5 h-5 text-rose-400" /> <span className="text-slate-200"><span className="font-bold text-white">{syncConflictsCount}</span> Sync Conflicts</span></>
                    ) : (
                      <><CheckCircle2 className="w-5 h-5 text-emerald-400" /> <span className="text-slate-400">No Sync Conflicts</span></>
                    )}
                  </li>
                )}
                
                {capabilities.includes('ACCESS_INVENTORY') && (
                  <li className="flex items-center gap-3">
                    {inventoryAlertsCount > 0 ? (
                      <><AlertTriangle className="w-5 h-5 text-amber-400" /> <span className="text-slate-200"><span className="font-bold text-white">{inventoryAlertsCount}</span> Low Stock Items</span></>
                    ) : (
                      <><CheckCircle2 className="w-5 h-5 text-emerald-400" /> <span className="text-slate-400">Inventory Healthy</span></>
                    )}
                  </li>
                )}
                
                {capabilities.includes('ACCESS_HOUSEKEEPING') && (
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" /> 
                    <span className="text-slate-200"><span className="font-bold text-white">{roomsClean}</span> Rooms Clean</span>
                  </li>
                )}

                {/* Generic fallback if no specific alerts */}
                {!capabilities.includes('ACCESS_SYNC_CENTER') && !capabilities.includes('ACCESS_INVENTORY') && !capabilities.includes('ACCESS_HOUSEKEEPING') && (
                  <li className="text-slate-400 text-sm italic">You have no pending alerts.</li>
                )}
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
