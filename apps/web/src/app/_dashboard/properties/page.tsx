'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Building2, MapPin, MoreVertical, Edit, Building, Eye, ArrowUpRight, Globe2, Phone } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface Property {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  phone: string;
  _count?: {
    rooms: number;
  };
}

export default function PropertiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const res = await fetch('/api/v1/properties');
      if (!res.ok) throw new Error('Failed to fetch properties');
      const json = await res.json();
      return json.data as Property[];
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Properties"
        description="A clear view of the properties and locations in your portfolio."
        className="pb-2"
      />

      {!isLoading && data && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Properties', value: data.length, icon: Building2 },
            { label: 'Rooms managed', value: data.reduce((sum, property) => sum + (property._count?.rooms || 0), 0), icon: Building },
            { label: 'Locations', value: new Set(data.map((property) => property.city)).size, icon: Globe2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border bg-card/70 px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold tracking-tight">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden border-muted/60">
              <div className="h-36 animate-pulse bg-muted" />
              <CardContent className="space-y-4 p-6">
                <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((property) => (
            <Card key={property.id} className="group overflow-hidden border-muted/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <div className="relative flex h-36 flex-col justify-between overflow-hidden border-b bg-gradient-to-br from-slate-950 via-slate-900 to-primary/80 p-5 text-white">
                <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full border-[18px] border-white/10" />
                <div className="relative flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label={`Actions for ${property.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem className="p-0">
                        <Link href={`/properties/${property.id}`} className="flex items-center gap-2 w-full px-2 py-1.5 cursor-pointer"><Eye className="h-4 w-4" /> View Details</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="p-0">
                        <Link href={`/properties/${property.id}/edit`} className="flex items-center gap-2 w-full px-2 py-1.5 cursor-pointer"><Edit className="h-4 w-4" /> Edit Property</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="p-0">
                        <Link href={`/properties/${property.id}/buildings`} className="flex items-center gap-2 w-full px-2 py-1.5 cursor-pointer"><Building className="h-4 w-4" /> Manage Buildings</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                </div>
                <div className="relative flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/65">Property</p>
                    <h2 className="mt-1 line-clamp-1 text-xl font-semibold tracking-tight">{property.name}</h2>
                  </div>
                  <Badge variant="secondary" className="border-0 bg-white/15 text-white hover:bg-white/20">
                    {property.code}
                  </Badge>
                </div>
              </div>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-2.5 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{property.city}, {property.country}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 shrink-0 text-primary" />
                    <span>{property.phone || 'No phone number added'}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t bg-muted/20 px-5 py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span><strong className="text-foreground">{property._count?.rooms || 0}</strong> rooms</span>
                </div>
                <Button asChild variant="ghost" size="sm" className="gap-1.5 text-primary hover:bg-primary/10 hover:text-primary">
                  <Link href={`/properties/${property.id}`}>
                    Open property
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
          {data?.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No properties found</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">You don't have access to any properties yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
