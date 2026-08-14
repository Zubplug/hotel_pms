'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState, ErrorState } from '@/components/ui/EmptyState';
import {
  Building2, MapPin, Phone, Mail, BedDouble,
  Layers, Edit, ArrowRight, Wrench
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={property.name}
        description={`${property.city}, ${property.country} · ${property.code}`}
        actions={
          <Button asChild>
            <Link href={`/properties/${propertyId}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Property
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Rooms', value: property._count.rooms, icon: BedDouble },
          { label: 'Room Types', value: property._count.roomTypes, icon: Layers },
          { label: 'Buildings', value: property.buildings.length, icon: Building2 },
          { label: 'Status', value: 'Active', icon: Wrench, isBadge: true },
        ].map(({ label, value, icon: Icon, isBadge }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                {isBadge ? (
                  <Badge className="mt-1 bg-green-100 text-green-800 border-transparent">{value}</Badge>
                ) : (
                  <p className="text-2xl font-bold">{value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details & Buildings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{property.address}, {property.city}, {property.country}</span>
            </div>
            {property.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{property.phone}</span>
              </div>
            )}
            {property.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{property.email}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Buildings</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/properties/${propertyId}/buildings`}>
                  View all <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {property.buildings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No buildings yet.</p>
            ) : (
              property.buildings.slice(0, 5).map((building) => (
                <Link
                  key={building.id}
                  href={`/buildings/${building.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{building.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {building._count?.rooms ?? 0} rooms
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
