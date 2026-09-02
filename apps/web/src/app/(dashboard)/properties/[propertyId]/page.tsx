'use client';


import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState, ErrorState } from '@/components/ui/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, MapPin, Phone, Mail, BedDouble,
  Layers, Edit, ArrowRight, Wrench, Settings, Activity, Users, CreditCard, DoorClosed, Hotel
} from 'lucide-react';
import Link from 'next/link';

interface PropertyDetail {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email?: string;
  isActive: boolean;
  buildings: Array<{ id: string; name: string; _count?: { rooms: number } }>;
  _count: { rooms: number; roomTypes: number };
}

export default function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const router = useRouter();

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['properties', 'detail', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/properties/${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch property');
      const json = await res.json();
      return json.data as PropertyDetail;
    },
    enabled: !!propertyId,
  });

  if (isLoading) return <LoadingState message="Loading property..." />;
  if (isError || !property) return <ErrorState description="Could not load property details." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={property.name}
        description={`${property.city}, ${property.country} · ${property.code}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/properties/${propertyId}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Settings
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/reservations/new?propertyId=${propertyId}`}>
                New Reservation
              </Link>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="overview" className="w-full">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 -mx-6 px-6 pt-2 mb-6">
          <TabsList className="bg-transparent h-auto p-0 gap-6 w-full justify-start overflow-x-auto rounded-none border-b-0 pb-px">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Overview</TabsTrigger>
            <TabsTrigger value="rooms" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Rooms & Types</TabsTrigger>
            <TabsTrigger value="reservations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Reservations</TabsTrigger>
            <TabsTrigger value="guests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Guests</TabsTrigger>
            <TabsTrigger value="operations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Operations</TabsTrigger>
            <TabsTrigger value="financials" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Financials</TabsTrigger>
            <TabsTrigger value="buildings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Buildings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Rooms', value: property._count.rooms, icon: BedDouble },
              { label: 'Room Types', value: property._count.roomTypes, icon: Layers },
              { label: 'Buildings', value: property.buildings.length, icon: Building2 },
              { label: 'Status', value: property.isActive ? 'Active' : 'Inactive', icon: Wrench, isBadge: true, active: property.isActive },
            ].map(({ label, value, icon: Icon, isBadge, active }) => (
              <Card key={label} className="border-muted/60 shadow-sm">
                <CardContent className="p-5 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    {isBadge ? (
                      <Badge className={`mt-1 border-transparent ${active ? 'bg-green-100 text-green-800' : 'bg-destructive/10 text-destructive'}`}>
                        {value}
                      </Badge>
                    ) : (
                      <p className="text-2xl font-bold">{value}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-muted/60 shadow-sm">
              <CardHeader>
                <CardTitle>Contact Details</CardTitle>
                <CardDescription>Primary communication channels for this property.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium">{property.address}, {property.city}, {property.country}</span>
                </div>
                {property.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span>{property.phone}</span>
                  </div>
                )}
                {property.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span>{property.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-muted/60 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Quick Links</CardTitle>
                    <CardDescription>Jump straight to operational modules.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex-col gap-2 justify-center" asChild>
                    <Link href={`/housekeeping?propertyId=${propertyId}`}>
                      <Hotel className="h-5 w-5 text-primary" />
                      <span>Housekeeping</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2 justify-center" asChild>
                    <Link href={`/maintenance?propertyId=${propertyId}`}>
                      <Wrench className="h-5 w-5 text-primary" />
                      <span>Maintenance</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2 justify-center" asChild>
                    <Link href={`/reports?propertyId=${propertyId}`}>
                      <Activity className="h-5 w-5 text-primary" />
                      <span>Reports & KPIs</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2 justify-center" asChild>
                    <Link href={`/settings?propertyId=${propertyId}`}>
                      <Settings className="h-5 w-5 text-primary" />
                      <span>Settings</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="mt-0">
          <Card className="border-muted/60 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center p-8">
            <DoorClosed className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <CardTitle className="mb-2">Rooms & Room Types</CardTitle>
            <CardDescription className="max-w-sm mb-6">
              Manage physical rooms, categorization, bed types, and operational status.
            </CardDescription>
            <div className="flex gap-4">
              <Button asChild variant="outline">
                <Link href={`/room-types?propertyId=${propertyId}`}>Manage Types</Link>
              </Button>
              <Button asChild>
                <Link href={`/rooms?propertyId=${propertyId}`}>View All Rooms</Link>
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reservations" className="mt-0">
          <Card className="border-muted/60 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center p-8">
            <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <CardTitle className="mb-2">Reservations Ledger</CardTitle>
            <CardDescription className="max-w-sm mb-6">
              View the booking ledger, arrivals, departures, and in-house guests for this property.
            </CardDescription>
            <Button asChild>
              <Link href={`/reservations?propertyId=${propertyId}`}>Go to Reservations</Link>
            </Button>
          </Card>
        </TabsContent>
        
        <TabsContent value="guests" className="mt-0">
          <Card className="border-muted/60 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center p-8">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <CardTitle className="mb-2">Guest Directory</CardTitle>
            <CardDescription className="max-w-sm mb-6">
              Manage guest profiles, loyalty tiers, preferences, and stay history specific to this property.
            </CardDescription>
            <Button variant="outline" disabled>Module Coming Soon</Button>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="mt-0">
          <Card className="border-muted/60 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center p-8">
            <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <CardTitle className="mb-2">Operational Hub</CardTitle>
            <CardDescription className="max-w-sm mb-6">
              Manage Housekeeping task assignments, Maintenance ticketing, and general property health.
            </CardDescription>
            <div className="flex gap-4">
              <Button asChild variant="outline">
                <Link href={`/housekeeping?propertyId=${propertyId}`}>Housekeeping</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/maintenance?propertyId=${propertyId}`}>Maintenance</Link>
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="mt-0">
          <Card className="border-muted/60 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center p-8">
            <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <CardTitle className="mb-2">Financials & Gateway</CardTitle>
            <CardDescription className="max-w-sm mb-6">
              Reconcile payments, track outstanding folios, and configure billing settings.
            </CardDescription>
            <Button asChild>
              <Link href={`/reports/gateway?propertyId=${propertyId}`}>Gateway Reconciliation</Link>
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="buildings" className="mt-0">
          <Card className="border-muted/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Physical Infrastructure</CardTitle>
                  <CardDescription>Buildings, wings, and structural layout.</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/properties/${propertyId}/buildings`}>
                    Manage Buildings
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {property.buildings.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed rounded-xl">
                  <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No buildings configured.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {property.buildings.map((building) => (
                    <Link
                      key={building.id}
                      href={`/buildings/${building.id}`}
                      className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium block group-hover:text-primary transition-colors">{building.name}</span>
                          <span className="text-sm text-muted-foreground block">
                            {building._count?.rooms ?? 0} physical rooms
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transform" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
