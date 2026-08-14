'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { PropertyForm, PropertyFormValues } from '@/components/properties/PropertyForm';
import { toast } from 'sonner';

export default function NewPropertyPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In a real app, organizationId would come from session context
  const organizationId = 'default-org';

  async function handleSubmit(data: PropertyFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Failed to create property');
      }
      const json = await res.json();
      toast.success('Property created successfully!');
      router.push(`/properties/${json.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="New Property"
        description="Add a new hotel property to your portfolio."
      />
      <PropertyForm
        mode="create"
        organizationId={organizationId}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
