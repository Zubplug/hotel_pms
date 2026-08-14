'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRoomTypeSchema, CreateRoomTypeInput } from '@hotel-pms/types';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface RoomTypeFormProps {
  initialData?: any;
}

export function RoomTypeForm({ initialData }: RoomTypeFormProps) {
  const { propertyId } = useProperty();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateRoomTypeInput>({
    resolver: zodResolver(createRoomTypeSchema) as any,
    defaultValues: {
      propertyId: propertyId || '',
      name: initialData?.name || '',
      code: initialData?.code || '',
      description: initialData?.description || '',
      maxOccupancy: initialData?.maxOccupancy || 2,
      maxAdults: initialData?.maxAdults || 2,
      maxChildren: initialData?.maxChildren || 0,
      defaultBedConfig: initialData?.defaultBedConfig || '1 King Bed',
      baseRate: initialData?.baseRate ? Number(initialData.baseRate) : 0,
      currency: initialData?.currency || 'NGN',
      isActive: initialData?.isActive ?? true,
      amenities: initialData?.amenities || [],
      photos: initialData?.photos || [],
    },
  });

  const onSubmit = async (data: CreateRoomTypeInput) => {
    setIsSubmitting(true);
    try {
      const url = initialData ? `/api/v1/room-types/${initialData.id}` : '/api/v1/room-types';
      const method = initialData ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save room type');
      }

      toast.success(`Room type ${initialData ? 'updated' : 'created'} successfully`);
      router.push('/room-types');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Standard Room" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. STD" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="baseRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Rate (per night)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="maxOccupancy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Total Occupancy</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="maxAdults"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Adults</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="maxChildren"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Children</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="defaultBedConfig"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Bed Config</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 1 King Bed" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control as any}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Brief description of the room type" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Room Type
          </Button>
        </div>
      </form>
    </Form>
  );
}
