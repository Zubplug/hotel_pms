'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, addDays } from 'date-fns';
import { toast } from 'sonner';
import { formatRoomNumber } from '@/lib/format-room';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Loader2, Plus, ArrowRight, UserPlus, Calendar } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

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

interface FrontDeskReservationFormProps {
  isWalkIn?: boolean;
}

export function FrontDeskReservationForm({ isWalkIn = false }: FrontDeskReservationFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();

  // Use state for dates to avoid SSR hydration mismatch with new Date()
  const [datesInitialized, setDatesInitialized] = useState(false);

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

  // Hydrate dates safely on client
  useEffect(() => {
    if (!datesInitialized && isWalkIn) {
      const cachedDashboard: any = queryClient.getQueryData(['frontdesk', 'dashboard', propertyId]);
      const businessDate = cachedDashboard?.data?.businessDate 
        ? new Date(cachedDashboard.data.businessDate) 
        : new Date();
      const nextBusinessDate = addDays(businessDate, 1);
      
      form.setValue('checkIn', businessDate);
      form.setValue('checkOut', nextBusinessDate);
      setDatesInitialized(true);
    }
  }, [datesInitialized, isWalkIn, queryClient, propertyId, form]);

  const isNewGuest = form.watch('isNewGuest');
  const checkIn = form.watch('checkIn');
  const checkOut = form.watch('checkOut');
  const roomTypeId = form.watch('roomTypeId');

  const { data: guestsRes, isLoading: loadingGuests } = useQuery({
    queryKey: ['guests'],
    queryFn: async () => {
      return provider.guests.list();
    },
  });
  const guests = (guestsRes as any)?.data || [];

  const { data: roomTypesRes, isLoading: loadingRoomTypes } = useQuery({
    queryKey: ['room-types', propertyId],
    queryFn: async () => {
      return provider.roomTypes.list(propertyId);
    },
    enabled: !!propertyId,
  });
  const roomTypes = (roomTypesRes as any)?.data || [];

  const { data: availableRoomsRes, isLoading: loadingAvailableRooms } = useQuery({
    queryKey: ['available-rooms', propertyId, roomTypeId, checkIn?.toISOString(), checkOut?.toISOString()],
    queryFn: async () => {
      if (!propertyId || !roomTypeId || !checkIn || !checkOut) return null;
      return provider.rooms.getAvailable(propertyId, roomTypeId, checkIn.toISOString(), checkOut.toISOString());
    },
    enabled: !!propertyId && !!roomTypeId && !!checkIn && !!checkOut && checkOut > checkIn,
  });
  const availableRooms = (availableRoomsRes as any)?.data || [];

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

      const res = await provider.reservations.create(payload);
      return { data: res }; // Wrap to match expected return type in onSuccess
    },
    onSuccess: (data) => {
      toast.success(isWalkIn ? 'Walk-In Created!' : 'Reservation created successfully');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard'] });
      
      // Navigate to the newly created reservation in the Front Desk view
      router.push(`/frontdesk/reservations/detail?id=${data.data.id}`);
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
  
  const formatter = selectedRoomType ? new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: selectedRoomType.currency || 'NGN',
    maximumFractionDigits: 0
  }) : null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT PANE: Guest & Occupancy */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Guest Selection Glass Card */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl shadow-blue-900/5 rounded-3xl p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2.5 rounded-2xl text-blue-700">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Guest Identity</h2>
                </div>
                <Button 
                  type="button" 
                  variant={isNewGuest ? "default" : "outline"}
                  className="rounded-full shadow-sm font-semibold transition-all"
                  onClick={() => {
                    form.setValue('isNewGuest', !isNewGuest);
                    form.setValue('guestId', '');
                  }}
                >
                  {isNewGuest ? 'Switch to Existing Guest' : (
                    <><Plus className="w-4 h-4 mr-2" /> New Guest</>
                  )}
                </Button>
              </div>

              {!isNewGuest ? (
                <FormField
                  control={form.control}
                  name="guestId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500 font-medium ml-1">Search Database</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger disabled={loadingGuests} className="h-14 rounded-2xl bg-white/50 border-slate-200 text-lg shadow-sm">
                            <SelectValue placeholder="Search by name or email..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl shadow-2xl border-slate-100">
                          {guests?.map((guest: any) => (
                            <SelectItem key={guest.id} value={guest.id} className="py-3 cursor-pointer">
                              <div className="font-semibold">{guest.firstName} {guest.lastName}</div>
                              <div className="text-xs text-slate-400">{guest.email || guest.phone || 'No contact info'}</div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="grid grid-cols-2 gap-6 animate-in fade-in duration-300">
                  <FormField control={form.control} name="guestDetails.firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500 font-medium ml-1">First Name</FormLabel>
                      <FormControl><Input className="h-12 rounded-xl bg-white/50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="guestDetails.lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500 font-medium ml-1">Last Name</FormLabel>
                      <FormControl><Input className="h-12 rounded-xl bg-white/50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="guestDetails.email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500 font-medium ml-1">Email <span className="text-slate-300 font-normal">(Optional)</span></FormLabel>
                      <FormControl><Input type="email" className="h-12 rounded-xl bg-white/50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="guestDetails.phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500 font-medium ml-1">Phone <span className="text-slate-300 font-normal">(Optional)</span></FormLabel>
                      <FormControl><Input type="tel" className="h-12 rounded-xl bg-white/50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
            </div>

            {/* Occupants Card */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl shadow-blue-900/5 rounded-3xl p-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">Occupants</h3>
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="adults"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500 font-medium ml-1">Adults</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" className="h-12 rounded-xl bg-white/50 text-center font-bold text-lg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="children"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500 font-medium ml-1">Children</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" className="h-12 rounded-xl bg-white/50 text-center font-bold text-lg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

          </div>

          {/* RIGHT PANE: Dates, Room, Submit */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className="bg-slate-800 p-2.5 rounded-2xl text-blue-400 border border-slate-700">
                  <Calendar className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold">Stay Details</h2>
              </div>

              <div className="space-y-6 relative z-10">
                {/* Dates */}
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 space-y-4">
                  <FormField
                    control={form.control}
                    name="checkIn"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-slate-400 ml-1">Check-In</FormLabel>
                        <DatePicker 
                          value={field.value} 
                          onChange={field.onChange} 
                          disabled={isWalkIn}
                          className="h-12 rounded-xl bg-slate-900 border-slate-700 text-white" 
                        />
                        {isWalkIn && <p className="text-xs text-blue-400 mt-1 ml-1 font-medium">Locked to Business Date</p>}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="checkOut"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-slate-400 ml-1">Check-Out</FormLabel>
                        <DatePicker 
                          value={field.value} 
                          onChange={field.onChange} 
                          className="h-12 rounded-xl bg-slate-900 border-slate-700 text-white" 
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Room Selection */}
                <div className="space-y-4 pt-2">
                  <FormField
                    control={form.control}
                    name="roomTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-400 ml-1">Room Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger disabled={loadingRoomTypes} className="h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white">
                              <SelectValue placeholder="Select room type..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            {roomTypes?.map((rt: any) => (
                              <SelectItem key={rt.id} value={rt.id} className="focus:bg-slate-700 focus:text-white">
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
                        <FormLabel className="text-slate-400 ml-1">Assign Room</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!roomTypeId || !checkIn || !checkOut || loadingAvailableRooms}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white">
                              <SelectValue placeholder={
                                (!checkIn || !checkOut || !roomTypeId) ? 'Awaiting selection...' : 
                                loadingAvailableRooms ? 'Searching availability...' : 'Select a ready room'
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-60">
                            {availableRooms?.length === 0 && (
                              <SelectItem value="none" disabled className="text-red-400">No rooms available</SelectItem>
                            )}
                            {availableRooms?.map((room: any) => (
                              <SelectItem key={room.id} value={room.id} className="focus:bg-slate-700 focus:text-white flex justify-between">
                                Room {formatRoomNumber(room.number)}
                                {room.status === 'CLEAN' && <span className="ml-4 text-emerald-400 text-xs">READY</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Total Estimate */}
                <div className="bg-blue-600/20 border border-blue-500/30 rounded-2xl p-5 mt-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-blue-200 text-sm font-medium">Estimated Total</span>
                    <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full">{nights} Nights</span>
                  </div>
                  <div className="text-3xl font-bold text-white tracking-tight">
                    {selectedRoomType && formatter && nights > 0 
                      ? formatter.format(selectedRoomType.baseRate * nights) 
                      : '---'}
                  </div>
                </div>

                {/* Submit */}
                <Button 
                  type="submit" 
                  disabled={createReservation.isPending}
                  className="w-full h-14 text-base font-bold rounded-2xl bg-white text-slate-900 hover:bg-slate-100 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:scale-[1.02]"
                >
                  {createReservation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-600" />
                  ) : (
                    <>
                      {isWalkIn ? 'Process Walk-In' : 'Confirm Reservation'} <ArrowRight className="ml-2 w-5 h-5" />
                    </>
                  )}
                </Button>
                
              </div>
            </div>

          </div>

        </div>
      </form>
    </Form>
  );
}
