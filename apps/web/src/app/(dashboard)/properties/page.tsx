'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus, Building2, MapPin, MoreVertical, Edit, Building, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
        description="Manage your hotel properties, locations, and settings."
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-32 bg-muted rounded-t-xl" />
              <CardContent className="p-6">
                <div className="h-6 w-2/3 bg-muted rounded mb-2" />
                <div className="h-4 w-1/3 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data?.map((property) => (
            <Card key={property.id} className="group overflow-hidden transition-all hover:shadow-md border-muted/60">
              <div className="h-32 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b relative p-6 flex flex-col justify-end">
                <div className="absolute top-4 right-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2"><Eye className="h-4 w-4" /> View Details</DropdownMenuItem>
                      <DropdownMenuItem className="gap-2"><Edit className="h-4 w-4" /> Edit Property</DropdownMenuItem>
                      <DropdownMenuItem className="gap-2"><Building className="h-4 w-4" /> Manage Buildings</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/30 border-transparent">
                    {property.code}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold tracking-tight mb-2 group-hover:text-primary transition-colors">
                  {property.name}
                </h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{property.city}, {property.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span>{property._count?.rooms || 0} Rooms total</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="px-6 py-4 bg-muted/20 border-t flex justify-between items-center">
                <Button variant="outline" size="sm" className="w-full">
                  Manage Property
                </Button>
              </CardFooter>
            </Card>
          ))}
          {data?.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No properties found</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">You don't have access to any properties yet.</p>
              <Button>Create Property</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
