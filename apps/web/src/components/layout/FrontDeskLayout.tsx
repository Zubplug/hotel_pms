'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { PropertySelector } from '@/components/properties/PropertySelector';
import {
  Hotel,
  LogOut,
  ChevronDown,
  Menu,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Brush,
  Wrench,
  Activity
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProperty } from '@/components/PropertyProvider';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export function FrontDeskLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { propertyId } = useProperty();
  const router = useRouter();
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: res } = useQuery({
    queryKey: ['frontdesk', 'dashboard', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const response = await fetch(`/api/v1/frontdesk/dashboard?propertyId=${propertyId}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    enabled: !!propertyId,
    refetchInterval: 10000,
  });

  const hardware = res?.data?.hardware;
  const businessDate = res?.data?.businessDate ? new Date(res.data.businessDate) : null;

  const userInitials = session?.user?.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : '??';

  const role = (session?.user as any)?.role || 'STAFF';
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 w-full flex items-center h-16 px-4 md:px-6 bg-background/95 backdrop-blur border-b shadow-sm">
        
        {/* Left: Logo & Property */}
        <div className="flex items-center gap-4 lg:gap-6 flex-1 min-w-0">
          <Link href="/frontdesk" className="flex items-center gap-2 group shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm transition-transform group-hover:scale-105">
              <Hotel className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight hidden sm:inline-block">LodgeCore</span>
          </Link>
          
          <div className="h-6 w-px bg-border hidden sm:block" />
          
          <PropertySelector className="w-[180px] lg:w-[240px]" />
        </div>

        {/* Center/Right: Hardware, Date/Time, User */}
        <div className="flex items-center gap-3 lg:gap-6 shrink-0 ml-auto">
          
          {/* Operations Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <Button variant="ghost" className="hidden lg:flex gap-2 h-9 px-3 text-muted-foreground hover:text-foreground">
                Operations <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Departments</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/housekeeping')} className="w-full cursor-pointer">
                <Brush className="mr-2 h-4 w-4" /> Housekeeping
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/maintenance')} className="w-full cursor-pointer">
                <Wrench className="mr-2 h-4 w-4" /> Maintenance
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/reports')} className="w-full cursor-pointer">
                <Activity className="mr-2 h-4 w-4" /> Room Status
              </DropdownMenuItem>
              {(isSuperAdmin || role === 'CEO' || role === 'MANAGER') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/dashboard')} className="w-full cursor-pointer">
                    Admin Dashboard
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-px bg-border hidden lg:block" />

          {/* Business Date & Clock */}
          <div className="hidden xl:flex flex-col items-end justify-center min-w-[120px]">
            {businessDate ? (
              <span className="text-xs font-semibold text-foreground leading-tight">
                {businessDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            ) : (
              <span className="h-4 w-24 bg-muted animate-pulse rounded" />
            )}
            <span className="text-xs text-muted-foreground font-mono">
              {time ? time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '--:--'}
            </span>
          </div>

          <div className="h-6 w-px bg-border hidden lg:block" />

          {/* Hardware Status */}
          {hardware ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                <Button 
                  variant="outline" 
                  className={cn(
                    "h-9 px-3 gap-2 rounded-full border shadow-sm transition-colors cursor-pointer",
                    hardware.status === 'ONLINE' 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800" 
                      : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800"
                  )}
                >
                  {hardware.status === 'ONLINE' ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="hidden sm:inline font-medium">Encoder Ready</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      <span className="hidden sm:inline font-medium">Encoder Offline</span>
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Hardware Connections</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-3 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Windows Lock Agent</span>
                    <Badge variant={hardware.status === 'ONLINE' ? 'default' : 'destructive'} className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      Connected
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Deluns SDK</span>
                    {hardware.status === 'ONLINE' ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ready</Badge>
                    ) : (
                      <Badge variant="destructive">Offline</Badge>
                    )}
                  </div>
                  {hardware.message && (
                    <div className="bg-muted p-2 rounded text-xs text-muted-foreground mt-2">
                      {hardware.message}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="h-9 w-32 bg-muted rounded-full animate-pulse" />
          )}

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none ml-1">
              <div className="h-9 w-9 rounded-full bg-slate-200 border-2 border-background flex items-center justify-center text-sm font-semibold text-slate-700 shadow-sm hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer">
                {userInitials}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-1">
              <div className="px-2 py-2">
                <p className="text-sm font-medium truncate">{session?.user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{role.toLowerCase().replace('_', ' ')}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { signOut({ redirect: false }); window.location.href='/login'; }} className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
