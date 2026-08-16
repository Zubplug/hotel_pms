'use client';

export function generateStaticParams() { return []; }

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PropertyForm, PropertyFormValues } from '@/components/properties/PropertyForm';
import { LoadingState, ErrorState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';

export default function EditPropertyPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['properties', 'detail', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/properties/${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch property');
      return (await res.json()).data;
    },
    enabled: !!propertyId,
  });

  async function handleSubmit(data: PropertyFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Failed to update property');
      }
      toast.success('Property updated successfully!');
      router.push(`/properties/${propertyId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading property..." />;
  if (isError || !property) return <ErrorState description="Could not load property for editing." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Edit Property"
        description={`Editing: ${property.name}`}
      />
      <PropertyForm
        mode="edit"
        defaultValues={property}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
