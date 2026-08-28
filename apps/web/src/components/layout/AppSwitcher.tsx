'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
  Grid3X3,
  X,
  Home,
  Lock
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useLock } from '@/components/auth/LockProvider';

const TILES = [
  { cap: ['ACCESS_FRONT_DESK'], label: 'Front Desk', icon: Building2, href: '/frontdesk' },
  { cap: ['ACCESS_POS'], label: 'Point of Sale', icon: UtensilsCrossed, href: '/pos' },
  { cap: ['ACCESS_HOUSEKEEPING'], label: 'Housekeeping', icon: Sparkles, href: '/housekeeping' },
  { cap: ['ACCESS_CASH_MANAGEMENT'], label: 'Cash Management', icon: Banknote, href: '/cash-management' },
  { 
    cap: [
      'ACCESS_INVENTORY', 
      'inventory.cost.view', 
      'inventory.recipe.manage',
      'inventory.stocktake.view',
      'inventory.grn.view'
    ], 
    label: 'Inventory', 
    icon: Package, 
    href: '/inventory' 
  },
  { cap: ['ACCESS_MAINTENANCE'], label: 'Maintenance', icon: Wrench, href: '/maintenance' },
  { cap: ['ACCESS_MANAGEMENT'], label: 'Management', icon: BarChart3, href: '/dashboard' },
  { cap: ['ACCESS_NIGHT_AUDIT'], label: 'Night Audit', icon: Moon, href: '/night-audit' },
  { cap: ['ACCESS_SYNC_CENTER'], label: 'Sync Center', icon: RefreshCw, href: '/sync-center' },
];

export function AppSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();
  const { lock } = useLock();

  const capabilities = (session?.user as any)?.capabilities || [];
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;
  
  // Exclude modules they don't have access to
  const availableTiles = TILES.filter(t => 
    isSuperAdmin || t.cap.some(c => capabilities.includes(c))
  );

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
        title="Switch Module"
      >
        <Grid3X3 className="w-5 h-5" />
        <span className="text-sm font-medium hidden md:block">Switch</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-2xl w-full max-w-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
              <h2 className="text-xl font-bold text-white tracking-wide">SWITCH MODULE</h2>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {/* Always show Hub Home */}
              <Link 
                href="/hub" 
                onClick={() => setIsOpen(false)}
                className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-slate-700 border border-transparent hover:border-slate-600 transition-colors group"
              >
                <div className="bg-slate-700 group-hover:bg-indigo-500 w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white text-center">Hub Home</span>
              </Link>

              {availableTiles.map(tile => (
                <Link 
                  key={tile.href}
                  href={tile.href} 
                  onClick={() => setIsOpen(false)}
                  className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-slate-700 border border-transparent hover:border-slate-600 transition-colors group"
                >
                  <div className="bg-slate-700 group-hover:bg-slate-600 w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors">
                    <tile.icon className="w-6 h-6 text-slate-300 group-hover:text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white text-center">{tile.label}</span>
                </Link>
              ))}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => {
                  setIsOpen(false);
                  lock();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">Lock Workstation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
