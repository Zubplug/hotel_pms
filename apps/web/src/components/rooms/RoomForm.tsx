'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRoomSchema, CreateRoomInput } from '@hotel-pms/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProperty } from '@/components/PropertyProvider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface RoomFormProps {
  initialData?: any;
}

export function RoomForm({ initialData }: RoomFormProps) {
  const { propertyId } = useProperty();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch Room Types
  const { data: roomTypes } = useQuery({
    queryKey: ['roomTypes', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/room-types`);
      if (!res.ok) throw new Error('Failed to fetch room types');
      return (await res.json()).data;
    },
    enabled: !!propertyId,
  });

  // Fetch Buildings
  const { data: buildings } = useQuery({
    queryKey: ['buildings', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/properties/${propertyId}/buildings`);
      if (!res.ok) throw new Error('Failed to fetch buildings');
      return (await res.json()).data;
    },
    enabled: !!propertyId,
  });

  const form = useForm<CreateRoomInput>({
    resolver: zodResolver(createRoomSchema) as any,
    defaultValues: {
      propertyId: propertyId || '',
      buildingId: initialData?.buildingId || '',
      floorId: initialData?.floorId || '',
      roomTypeId: initialData?.roomTypeId || '',
      number: initialData?.number || '',
      code: initialData?.code || '',
      maxOccupancy: initialData?.maxOccupancy || 2,
      maxAdults: initialData?.maxAdults || 2,
      maxChildren: initialData?.maxChildren || 0,
      bedConfiguration: initialData?.bedConfiguration || '1 King Bed',
      status: initialData?.status || 'AVAILABLE',
      housekeepingStatus: initialData?.housekeepingStatus || 'CLEAN',
      maintenanceStatus: initialData?.maintenanceStatus || 'NONE',
      isActive: initialData?.isActive ?? true,
      isAccessible: initialData?.isAccessible ?? false,
      amenities: initialData?.amenities || [],
      photos: initialData?.photos || [],
    },
  });

  const selectedBuildingId = form.watch('buildingId');

  // Fetch Floors based on selected building
  const { data: floors } = useQuery({
    queryKey: ['floors', selectedBuildingId],
    queryFn: async () => {
      if (!selectedBuildingId) return [];
      const res = await fetch(`/api/v1/buildings/${selectedBuildingId}/floors`);
      if (!res.ok) throw new Error('Failed to fetch floors');
      return (await res.json()).data;
    },
    enabled: !!selectedBuildingId,
  });

  const onSubmit = async (data: CreateRoomInput) => {
    setIsSubmitting(true);
    try {
      const url = initialData ? `/api/v1/rooms/${initialData.id}` : '/api/v1/rooms';
      const method = initialData ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save room');
      }

      toast.success(`Room ${initialData ? 'updated' : 'created'} successfully`);
      router.push('/rooms');
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
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Room Number</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 101" {...field} />
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
                <FormLabel>Room Code (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 101A" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="roomTypeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Room Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a room type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roomTypes?.map((rt: any) => (
                      <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="buildingId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Building</FormLabel>
                <Select onValueChange={(val) => {
                  field.onChange(val);
                  form.setValue('floorId', ''); // Reset floor when building changes
                }} defaultValue={field.value} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a building" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {buildings?.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="floorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Floor</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={!selectedBuildingId}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a floor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {floors?.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>Floor {f.number} {f.name ? `(${f.name})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="bedConfiguration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bed Configuration</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 1 King Bed" {...field} />
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
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Room
          </Button>
        </div>
      </form>
    </Form>
  );
}
