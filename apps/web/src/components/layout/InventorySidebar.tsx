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
  Hotel
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { useLogout } from '@/hooks/useLogout';

export function InventorySidebar() {
  const pathname = usePathname();
  const { data: session } = useLodgeCoreSession();
  const logout = useLogout();
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

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  const userInitials = getInitials(session?.user?.name, session?.user?.email);

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen text-slate-700">
      <div className="h-16 flex items-center px-6 border-b border-slate-200">
        <Link href="/inventory" className="flex items-center gap-3 text-slate-900 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm transition-transform group-hover:scale-105">
            <Hotel className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Stock Pro</span>
        </Link>
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
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <link.icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              {link.name}
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-700">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {session?.user?.name || session?.user?.email}
            </p>
            <p className="text-xs text-slate-500 capitalize truncate">
              {(role || 'Staff').toLowerCase().replace('_', ' ')}
            </p>
          </div>
        </div>
        <button 
          onClick={() => logout()}
          className="flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
