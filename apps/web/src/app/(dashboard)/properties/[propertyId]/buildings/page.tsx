'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { BuildingList } from '@/components/properties/BuildingList';
import { Plus } from 'lucide-react';

export default function PropertyBuildingsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Buildings"
        description="Manage the physical building structure of this property."
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Building
          </Button>
        }
      />
      <BuildingList propertyId={propertyId} />
    </div>
  );
}
