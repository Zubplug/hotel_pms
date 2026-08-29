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
  ClipboardList,
  Activity,
  Hotel,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { useLogout } from '@/hooks/useLogout';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_LINKS = [
  { name: 'Overview',         href: '/inventory',                      icon: Package },
  { name: 'Stock Items',      href: '/inventory/stock-items',          icon: Boxes },
  { name: 'Warehouses',       href: '/inventory/warehouses',           icon: Warehouse },
  { name: 'Purchase Orders',  href: '/inventory/purchase-orders',      icon: ShoppingCart,   roles: ['CEO','SUPER_ADMIN','MANAGER','GENERAL_CASHIER','INVENTORY_MANAGER','PROCUREMENT_MANAGER','STOCK_MANAGER'] },
  { name: 'Goods Received',   href: '/inventory/grns',                 icon: Truck,          roles: ['CEO','SUPER_ADMIN','MANAGER','GENERAL_CASHIER','STOCK_MANAGER','PROCUREMENT_MANAGER'] },
  { name: 'Transfers',        href: '/inventory/transfers',            icon: ArrowRightLeft, roles: ['CEO','SUPER_ADMIN','MANAGER','INVENTORY_MANAGER','OUTLET_HEAD','STOCK_KEEPER','STOCK_MANAGER'] },
  { name: 'Suppliers',        href: '/inventory/suppliers',            icon: Users,          roles: ['CEO','SUPER_ADMIN','MANAGER','PROCUREMENT_MANAGER','STOCK_MANAGER'] },
  { name: 'Alerts',           href: '/inventory/alerts',               icon: Bell },
  { name: 'Stocktakes',       href: '/inventory/stocktakes',           icon: ClipboardList,  roles: ['CEO','SUPER_ADMIN','MANAGER','GENERAL_CASHIER','INVENTORY_MANAGER','STOCK_KEEPER','STOCK_MANAGER'] },
  { name: 'Cost Control',     href: '/inventory/cost-control',         icon: Activity,       roles: ['CEO','SUPER_ADMIN','MANAGER','GENERAL_CASHIER'] },
];

function getInitials(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return email ? email.slice(0, 2).toUpperCase() : '??';
}

interface InventorySidebarProps {
  onNavigate?: () => void;
}

export function InventorySidebar({ onNavigate }: InventorySidebarProps) {
  const pathname = usePathname();
  const { data: session } = useLodgeCoreSession();
  const logout = useLogout();
  const router = useRouter();
  const rawRole = String(session?.user?.role || '').toUpperCase();
  const role = rawRole === 'STOCK_KEEPER' ? 'STOCK_MANAGER' : rawRole;
  const userInitials = getInitials(session?.user?.name, session?.user?.email);
  const userDisplay = session?.user?.name || session?.user?.email || '';

  return (
    <div className="flex h-full flex-col bg-[#0b1120]">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5 border-b border-white/5">
        <Link href="/inventory" className="flex items-center gap-3 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-900/40 group-hover:scale-105 transition-transform">
            <Hotel className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-white tracking-tight">LodgeCore PMS</span>
            <span className="text-[10px] font-medium text-emerald-400 tracking-widest uppercase">Inventory</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5 gap-1">
        {NAV_LINKS.map((link) => {
          if (link.roles && role && !link.roles.includes(role)) return null;
          const isActive =
            pathname === link.href ||
            (pathname.startsWith(link.href + '/') && link.href !== '/inventory');
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/40'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500')} />
              {link.name}
            </Link>
          );
        })}
      </div>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/5 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5 group outline-none">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold text-xs ring-2 ring-emerald-500/30">
              {userInitials}
            </div>
            <div className="flex flex-1 flex-col items-start overflow-hidden">
              <span className="truncate text-sm font-medium text-slate-200 w-full text-left">
                {userDisplay}
              </span>
              <span className="truncate text-xs text-slate-500 w-full text-left capitalize">
                {(role || 'Staff').toLowerCase().replace(/_/g, ' ')}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0 group-hover:text-slate-300 transition-colors" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              My Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
