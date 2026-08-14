'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export interface RoomFormValues {
  number: string;
  displayName?: string;
  floorId: string;
  roomTypeId: string;
  maxAdults: number;
  maxChildren: number;
}

interface RoomFormProps {
  defaultValues?: Partial<RoomFormValues>;
  onSubmit: (data: RoomFormValues) => Promise<void>;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

export function RoomForm({ defaultValues, onSubmit, isSubmitting, mode = 'create' }: RoomFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoomFormValues>({ defaultValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Room Details</CardTitle>
          <CardDescription>Define the room number, capacity, and assignment.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="space-y-1.5">
            <Label htmlFor="number">Room Number <span className="text-destructive">*</span></Label>
            <Input id="number" placeholder="e.g. 101" {...register('number', { required: 'Room number is required' })} />
            {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" placeholder="e.g. Ocean Suite" {...register('displayName')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="floorId">Floor ID <span className="text-destructive">*</span></Label>
            <Input id="floorId" placeholder="Floor ID" {...register('floorId', { required: 'Floor is required' })} />
            {errors.floorId && <p className="text-xs text-destructive">{errors.floorId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roomTypeId">Room Type ID <span className="text-destructive">*</span></Label>
            <Input id="roomTypeId" placeholder="Room Type ID" {...register('roomTypeId', { required: 'Room type is required' })} />
            {errors.roomTypeId && <p className="text-xs text-destructive">{errors.roomTypeId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxAdults">Max Adults <span className="text-destructive">*</span></Label>
            <Input
              id="maxAdults"
              type="number"
              min={1}
              {...register('maxAdults', { required: true, min: 1, valueAsNumber: true })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxChildren">Max Children</Label>
            <Input
              id="maxChildren"
              type="number"
              min={0}
              defaultValue={0}
              {...register('maxChildren', { valueAsNumber: true })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Room' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
