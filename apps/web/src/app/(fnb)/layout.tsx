import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { NavItem } from '@/types/nav';
import { Utensils, LayoutDashboard, ReceiptText, ClipboardList, TrendingUp, Users, CalendarDays, ArrowLeftRight, Settings } from 'lucide-react';

const fnbNavItems: NavItem[] = [
  {
    title: 'F&B Dashboard',
    href: '/fnb/dashboard',
    icon: LayoutDashboard,
    roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'MANAGER'],
  },
  {
    title: 'Live Orders',
    href: '/fnb/orders',
    icon: ClipboardList,
    roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'MANAGER'],
  },
  {
    title: 'Menu Management',
    href: '/fnb/menu',
    icon: Utensils,
    roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'MANAGER'],
  },
  {
    title: 'Outlet Inventory',
    href: '/fnb/inventory',
    icon: ReceiptText,
    roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'MANAGER'],
  },
  {
    title: 'Requisitions',
    href: '/fnb/requisitions',
    icon: ArrowLeftRight,
    roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'MANAGER'],
  },
  {
    title: 'Staff Performance',
    href: '/fnb/staff',
    icon: Users,
    roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'MANAGER'],
  },
  {
    title: 'Halls & Events',
    href: '/fnb/events',
    icon: CalendarDays,
    roles: ['FNB_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'MANAGER'],
  },
  {
    title: 'Reports (DSS)',
    href: '/fnb/reports',
    icon: TrendingUp,
    roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'MANAGER'],
  },
  {
    title: 'Settings',
    href: '/fnb/settings',
    icon: Settings,
    roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'MANAGER'],
  },
];

export default function FnbLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar 
        items={fnbNavItems} 
        title="F&B Management" 
        subtitle="Operations & Analytics" 
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </SidebarProvider>
  );
}
