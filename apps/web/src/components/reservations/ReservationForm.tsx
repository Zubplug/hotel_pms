'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Plus } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';

const formSchema = z.object({
  isNewGuest: z.boolean(),
  guestId: z.string().optional(),
  guestDetails: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
  }).optional(),
  roomTypeId: z.string().min(1, 'Please select a room type'),
  roomId: z.string().min(1, 'Please select an available room'),
  checkIn: z.date({ required_error: 'Check-in date is required' }),
  checkOut: z.date({ required_error: 'Check-out date is required' }),
  adults: z.coerce.number().min(1, 'At least 1 adult is required'),
  children: z.coerce.number().min(0, 'Cannot be negative'),
}).refine((data) => data.checkOut > data.checkIn, {
  message: 'Check-out must be after check-in',
  path: ['checkOut'],
}).refine((data) => {
  if (data.isNewGuest) {
    return !!data.guestDetails?.firstName && !!data.guestDetails?.lastName;
  }
  return !!data.guestId;
}, {
  message: 'Please provide guest details or select an existing guest',
  path: ['guestId'],
});

export function ReservationForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { propertyId } = useProperty();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      isNewGuest: false,
      guestId: '',
      guestDetails: { firstName: '', lastName: '', email: '', phone: '' },
      roomTypeId: '',
      roomId: '',
      adults: 1,
      children: 0,
    },
  });

  const isNewGuest = form.watch('isNewGuest');
  const checkIn = form.watch('checkIn');
  const checkOut = form.watch('checkOut');
  const roomTypeId = form.watch('roomTypeId');

  const { data: guests, isLoading: loadingGuests } = useQuery({
    queryKey: ['guests'],
    queryFn: async () => {
      const res = await fetch('/api/v1/guests');
      if (!res.ok) throw new Error('Failed to fetch guests');
      return (await res.json()).data;
    },
  });

  const { data: roomTypes, isLoading: loadingRoomTypes } = useQuery({
    queryKey: ['room-types', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/room-types?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch room types');
      return (await res.json()).data;
    },
    enabled: !!propertyId,
  });

  const { data: availableRooms, isLoading: loadingAvailableRooms } = useQuery({
    queryKey: ['available-rooms', propertyId, roomTypeId, checkIn?.toISOString(), checkOut?.toISOString()],
    queryFn: async () => {
      if (!propertyId || !roomTypeId || !checkIn || !checkOut) return [];
      const res = await fetch(`/api/v1/rooms/available?propertyId=${propertyId}&roomTypeId=${roomTypeId}&checkIn=${checkIn.toISOString()}&checkOut=${checkOut.toISOString()}`);
      if (!res.ok) throw new Error('Failed to fetch available rooms');
      return (await res.json()).data;
    },
    enabled: !!propertyId && !!roomTypeId && !!checkIn && !!checkOut && checkOut > checkIn,
  });

  // Reset roomId when dependencies change
  useEffect(() => {
    form.setValue('roomId', '');
  }, [roomTypeId, checkIn, checkOut, form]);

  const createReservation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const payload = {
        ...values,
        checkIn: format(values.checkIn, 'yyyy-MM-dd'),
        checkOut: format(values.checkOut, 'yyyy-MM-dd'),
        propertyId
      };

      const res = await fetch('/api/v1/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create reservation');
      }
      return await res.json();
    },
    onSuccess: () => {
      toast.success('Reservation created successfully');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      router.push('/reservations');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createReservation.mutate(values);
  }

  // Pricing Calculation
  const selectedRoomType = roomTypes?.find((rt: any) => rt.id === roomTypeId);
  const nights = (checkIn && checkOut && checkOut > checkIn) 
    ? differenceInDays(checkOut, checkIn) 
    : 0;
  
  const formatter = selectedRoomType ? new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: selectedRoomType.currency || 'USD',
  }) : null;

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Create Booking</CardTitle>
        <CardDescription>
          Reserve a room for a guest. Physical lock credentials will be generated during Check-In.
        </CardDescription>
      </CardHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            
            {/* Guest Section */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Guest Information</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    form.setValue('isNewGuest', !isNewGuest);
                    form.setValue('guestId', '');
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isNewGuest ? 'Use Existing Guest' : 'New Guest'}
                </Button>
              </div>

              {!isNewGuest ? (
                <FormField
                  control={form.control}
                  name="guestId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Guest</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger disabled={loadingGuests}>
                            <SelectValue placeholder="Search guest..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {guests?.map((guest: any) => (
                            <SelectItem key={guest.id} value={guest.id}>
                              {guest.firstName} {guest.lastName} ({guest.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="guestDetails.firstName" render={({ field }) => (
                    <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="guestDetails.lastName" render={({ field }) => (
                    <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="guestDetails.email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="guestDetails.phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="checkIn"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Check-In Date</FormLabel>
                    <DatePicker value={field.value} onChange={field.onChange} placeholder="Select check-in" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="checkOut"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Check-Out Date</FormLabel>
                    <DatePicker value={field.value} onChange={field.onChange} placeholder="Select check-out" />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Room Selection */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="roomTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger disabled={loadingRoomTypes}>
                          <SelectValue placeholder="Select a room type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roomTypes?.map((rt: any) => (
                          <SelectItem key={rt.id} value={rt.id}>
                            {rt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roomId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Rooms</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!roomTypeId || !checkIn || !checkOut || loadingAvailableRooms}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            (!checkIn || !checkOut || !roomTypeId) ? 'Select dates & type first' : 
                            loadingAvailableRooms ? 'Searching...' : 'Select a room'
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableRooms?.length === 0 && (
                          <SelectItem value="none" disabled>No rooms available</SelectItem>
                        )}
                        {availableRooms?.map((room: any) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Occupants */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="adults"
                render={({ field }) => (
                  <FormItem><FormLabel>Adults</FormLabel><FormControl><Input type="number" min="1" {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="children"
                render={({ field }) => (
                  <FormItem><FormLabel>Children</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
            </div>

            {/* Pricing Summary */}
            {selectedRoomType && nights > 0 && formatter && (
              <div className="p-4 bg-muted/40 rounded-lg flex justify-between items-center mt-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">{nights} {nights === 1 ? 'night' : 'nights'} × {formatter.format(selectedRoomType.baseRate)}</span>
                </div>
                <div className="text-lg font-bold">
                  {formatter.format(selectedRoomType.baseRate * nights)}
                </div>
              </div>
            )}

          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={createReservation.isPending}>
              {createReservation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Reservation
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
