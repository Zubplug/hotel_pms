'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Star, Wifi, Dumbbell, Wind, Tv } from 'lucide-react';
import { LoadingState, EmptyState } from '@/components/ui/EmptyState';

interface Amenity {
  id: string;
  name: string;
  category?: string;
  icon?: string;
  description?: string;
}

const categoryColors: Record<string, string> = {
  BATHROOM: 'bg-blue-100 text-blue-800',
  ENTERTAINMENT: 'bg-purple-100 text-purple-800',
  CONNECTIVITY: 'bg-green-100 text-green-800',
  COMFORT: 'bg-amber-100 text-amber-800',
  FOOD: 'bg-red-100 text-red-800',
  FITNESS: 'bg-orange-100 text-orange-800',
  DEFAULT: 'bg-gray-100 text-gray-800',
};

export default function AmenitiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['amenities'],
    queryFn: async () => {
      const res = await fetch('/api/v1/amenities');
      if (!res.ok) throw new Error('Failed to fetch amenities');
      return (await res.json()).data as Amenity[];
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Amenities"
        description="Manage the amenities available across your properties."
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Amenity
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState message="Loading amenities..." />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Star className="h-6 w-6" />}
          title="No amenities yet"
          description="Add amenities like WiFi, Pool, or Gym to categorize your rooms."
          action={<Button><Plus className="mr-2 h-4 w-4" />Add Amenity</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.map((amenity) => {
            const colorClass = categoryColors[amenity.category ?? 'DEFAULT'] ?? categoryColors.DEFAULT;
            return (
              <Card key={amenity.id} className="group hover:shadow-md transition-all border-muted/60">
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Star className="h-5 w-5 text-primary" />
                    </div>
                    {amenity.category && (
                      <Badge className={`text-xs border-transparent ${colorClass}`}>
                        {amenity.category}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold group-hover:text-primary transition-colors">{amenity.name}</p>
                    {amenity.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{amenity.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
