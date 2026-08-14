'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Property {
  id: string;
  name: string;
  code: string;
  city: string;
}

interface PropertySelectorProps {
  selectedPropertyId?: string;
  onPropertyChange?: (propertyId: string) => void;
  className?: string;
}

import { buttonVariants } from '@/components/ui/button';

export function PropertySelector({ selectedPropertyId, onPropertyChange, className }: PropertySelectorProps) {
  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties', 'all'], // Changed to 'all' to avoid cache collision with paginated 'list'
    queryFn: async () => {
      const res = await fetch('/api/v1/properties');
      if (!res.ok) throw new Error('Failed to fetch properties');
      const json = await res.json();
      return (Array.isArray(json.data) ? json.data : []) as Property[];
    },
  });

  const selected = properties?.find((p) => p.id === selectedPropertyId);

  if (isLoading) {
    return (
      <div className="h-9 w-44 rounded-md bg-muted animate-pulse" />
    );
  }

  if (!properties || properties.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: 'outline' }), 'h-9 gap-2 max-w-xs', className)}
      >
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <span className="truncate text-sm font-medium">
          {selected?.name ?? 'Select Property'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch Property
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {properties.map((property) => (
          <DropdownMenuItem
            key={property.id}
            className="gap-2"
            onClick={() => onPropertyChange?.(property.id)}
          >
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-medium text-sm truncate">{property.name}</span>
              <span className="text-xs text-muted-foreground">{property.city} · {property.code}</span>
            </div>
            {property.id === selectedPropertyId && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
