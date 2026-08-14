'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  BedDouble,
  Users,
  Settings,
  Menu,
  Hotel,
  LogOut,
  ChevronDown,
  Layers,
  Star,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PropertySelector } from '@/components/properties/PropertySelector';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Properties', href: '/properties', icon: Hotel },
  { name: 'Rooms', href: '/rooms', icon: BedDouble },
  { name: 'Room Types', href: '/room-types', icon: Layers },
  { name: 'Amenities', href: '/amenities', icon: Star },
  { name: 'Reservations', href: '/reservations', icon: CalendarDays },
  { name: 'Staff', href: '/staff', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const userInitials = session?.user?.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : '??';

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push('/login');
  }

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 shadow shadow-blue-500/30">
          <Hotel className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">LodgeCore PMS</span>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 gap-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-4.5 w-4.5 shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* User footer */}
      <div className="border-t px-4 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/60 transition-colors cursor-pointer outline-none">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">
                {session?.user?.email ?? 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {session?.user?.isSuperAdmin ? 'Super Admin' : 'Staff'}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-background border-r shadow-xl flex flex-col">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-background">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-1 items-center gap-4">
            <PropertySelector />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
