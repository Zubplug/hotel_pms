'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Package, 
  Boxes, 
  Warehouse, 
  ShoppingCart, 
  Truck, 
  ArrowRightLeft, 
  Users, 
  Bell, 
  Scale, 
  LogOut,
  ChevronLeft
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

export function InventorySidebar() {
  const pathname = usePathname();
  const { data: session } = useLodgeCoreSession();
  const role = session?.user?.role as string | undefined;
  
  const links = [
    { name: 'Overview', href: '/inventory', icon: Package },
    { name: 'Stock Items', href: '/inventory/stock-items', icon: Boxes },
    { name: 'Warehouses', href: '/inventory/warehouses', icon: Warehouse },
    { name: 'Purchase Orders', href: '/inventory/purchase-orders', icon: ShoppingCart, roles: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'PROCUREMENT_MANAGER'] },
    { name: 'Goods Received', href: '/inventory/grns', icon: Truck, roles: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'] },
    { name: 'Transfers', href: '/inventory/transfers', icon: ArrowRightLeft, roles: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER'] },
    { name: 'Suppliers', href: '/inventory/suppliers', icon: Users, roles: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'PROCUREMENT_MANAGER'] },
    { name: 'Alerts', href: '/inventory/alerts', icon: Bell },
    { name: 'Reconciliation', href: '/inventory/reconciliation', icon: Scale, roles: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER'] },
  ];

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col h-screen text-zinc-300">
      <div className="h-16 flex items-center px-6 border-b border-zinc-800">
        <div className="flex items-center gap-3 text-white">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Stock Pro</span>
        </div>
      </div>
      
      <div className="flex-1 py-6 px-3 overflow-y-auto space-y-1">
        {links.map((link) => {
          if (link.roles && role && !link.roles.includes(role)) {
             return null;
          }
          
          const isActive = pathname === link.href || (pathname.startsWith(link.href + '/') && link.href !== '/inventory');
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive 
                  ? 'bg-indigo-600/10 text-indigo-400' 
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50'
                }`}
            >
              <link.icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
              {link.name}
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-zinc-800">
        <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition-all">
          <ChevronLeft className="w-4 h-4" />
          Back to PMS
        </Link>
      </div>
    </aside>
  );
}
