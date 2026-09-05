'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInCalendarDays, addDays, startOfDay, isBefore } from 'date-fns';
import { toast } from 'sonner';
import { formatRoomNumber } from '@/lib/format-room';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Loader2, Plus, ArrowRight, UserPlus, Calendar, Search, X, CheckCircle2, Phone, Mail, Tag } from 'lucide-react';
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
  corporateAccountId: z.string().optional(),
  checkIn: z.date({ required_error: 'Check-in date is required' }),
  checkOut: z.date({ required_error: 'Check-out date is required' }),
  adults: z.coerce.number().min(1, 'At least 1 adult is required'),
  children: z.coerce.number().min(0, 'Cannot be negative'),
  // Adjustment fields (Discount & Complimentary)
  adjustmentType: z.enum(['NONE', 'DISCOUNT_PERCENTAGE', 'DISCOUNT_FIXED', 'COMP_FULL', 'COMP_PARTIAL']),
  adjustmentValue: z.coerce.number().min(0).optional(),
  adjustmentReason: z.string().optional(),
  acknowledgedByStaffId: z.string().optional(),
  // Complimentary specifics
  compBeneficiaryType: z.enum(['GUEST', 'STAFF']).optional(),
  compBeneficiaryStaffId: z.string().optional(),
  compSettlementType: z.enum(['PAY_NOW', 'STAFF_PAY_LATER']).optional(),
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
}).refine((data) => {
  if (data.adjustmentType !== 'NONE' && data.adjustmentType !== 'COMP_FULL') {
    return !!data.adjustmentValue && data.adjustmentValue > 0;
  }
  return true;
}, {
  message: 'Adjustment value is required',
  path: ['adjustmentValue'],
}).refine((data) => {
  if (data.adjustmentType !== 'NONE') {
    return !!data.acknowledgedByStaffId;
  }
  return true;
}, {
  message: 'Acknowledged By is required when applying a discount or complimentary',
  path: ['acknowledgedByStaffId'],
}).refine((data) => {
  if (data.adjustmentType === 'COMP_FULL' || data.adjustmentType === 'COMP_PARTIAL') {
    return !!data.compBeneficiaryType;
  }
  return true;
}, {
  message: 'Beneficiary type is required for complimentary',
  path: ['compBeneficiaryType'],
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
      corporateAccountId: 'none',
      adults: 1,
      children: 0,
      adjustmentType: 'NONE',
      adjustmentValue: 0,
      adjustmentReason: '',
      acknowledgedByStaffId: '',
      compBeneficiaryType: 'GUEST',
      compBeneficiaryStaffId: '',
      compSettlementType: 'PAY_NOW',
    },
  });

  const { data: dashboardRes } = useQuery({
    queryKey: ['frontdesk', 'dashboard', propertyId],
    queryFn: () => provider.dashboard.get(propertyId),
    enabled: !!propertyId,
    staleTime: 60_000,
  });

  const businessDate = useMemo(() => {
    const rawDate = (dashboardRes as any)?.data?.businessDate || (dashboardRes as any)?.businessDate;
    return rawDate ? startOfDay(new Date(rawDate)) : startOfDay(new Date());
  }, [dashboardRes]);

  // Hydrate dates safely on client using the property's business date.
  useEffect(() => {
    if (!datesInitialized && businessDate) {
      form.setValue('checkIn', businessDate);
      form.setValue('checkOut', addDays(businessDate, 1));
      setDatesInitialized(true);
    }
  }, [datesInitialized, businessDate, form]);

  const isNewGuest = form.watch('isNewGuest');
  const checkIn = form.watch('checkIn');
  const checkOut = form.watch('checkOut');
  const roomTypeId = form.watch('roomTypeId');
  const adjustmentType = form.watch('adjustmentType');
  const adjustmentValue = form.watch('adjustmentValue') || 0;
  const compBeneficiaryType = form.watch('compBeneficiaryType');

  const [guestSearch, setGuestSearch] = useState('');
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  
  // Custom simple debounce for search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(guestSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [guestSearch]);

  const { data: guestsRes, isLoading: loadingGuests } = useQuery({
    queryKey: ['guests', debouncedSearch],
    queryFn: async () => {
      return provider.guests.search(debouncedSearch);
    },
    enabled: !isNewGuest && guestDropdownOpen,
  });
  const filteredGuests = (guestsRes as any)?.data || [];
  const visibleGuests = filteredGuests.slice(0, 8);

  const { data: roomTypesRes, isLoading: loadingRoomTypes } = useQuery({
    queryKey: ['room-types', propertyId],
    queryFn: async () => {
      return provider.roomTypes.list(propertyId);
    },
    enabled: !!propertyId,
  });
  const roomTypes = ((roomTypesRes as any)?.data || []).map((roomType: any) => ({
    ...roomType,
    baseRate: Number(roomType.baseRate ?? roomType.basePrice ?? roomType.BasePrice ?? 0),
    currency: roomType.currency || roomType.Currency || 'NGN',
  }));

  const { data: availableRoomsRes, isLoading: loadingAvailableRooms } = useQuery({
    queryKey: ['available-rooms', propertyId, roomTypeId, checkIn?.toISOString(), checkOut?.toISOString()],
    queryFn: async () => {
      if (!propertyId || !roomTypeId || !checkIn || !checkOut) return null;
      return provider.rooms.getAvailable(propertyId, roomTypeId, checkIn.toISOString(), checkOut.toISOString());
    },
    enabled: !!propertyId && !!roomTypeId && !!checkIn && !!checkOut && checkOut > checkIn,
  });
  const availableRooms = (availableRoomsRes as any)?.data || [];

  const { data: corporateAccountsRes, isLoading: loadingCorporateAccounts } = useQuery({
    queryKey: ['corporate-accounts', propertyId],
    queryFn: async () => {
      return provider.corporateAccounts.list(propertyId);
    },
    enabled: !!propertyId,
  });
  const corporateAccounts = (corporateAccountsRes as any)?.data || [];

  // Fetch ALL active staff from local DB — front desk can select themselves
  // or any management staff as the discount acknowledgement person
  const { data: managersRes } = useQuery({
    queryKey: ['managers-local', propertyId],
    queryFn: async () => {
      return provider.auth.getActiveStaff(); // no role filter — all active staff
    },
    enabled: !!propertyId,
    staleTime: 300_000,
  });
  const managers = (managersRes as any)?.data || [];

  // Reset roomId when dependencies change
  useEffect(() => {
    form.setValue('roomId', '');
  }, [roomTypeId, checkIn, checkOut, form]);

  const createReservation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const selectedRoom = availableRooms?.find((r: any) => r.id === values.roomId);
      const hasDiscount = values.adjustmentType === 'DISCOUNT_PERCENTAGE' || values.adjustmentType === 'DISCOUNT_FIXED';
      const hasComplimentary = values.adjustmentType === 'COMP_FULL' || values.adjustmentType === 'COMP_PARTIAL';
      
      const payload = {
        ...values,
        corporateAccountId: values.corporateAccountId === 'none' ? undefined : values.corporateAccountId,
        roomNumber: selectedRoom?.number || undefined,
        checkIn: format(values.checkIn, 'yyyy-MM-dd'),
        checkOut: format(values.checkOut, 'yyyy-MM-dd'),
        propertyId,
        // Send adjustment fields if applicable
        adjustmentType: (hasDiscount || hasComplimentary) ? values.adjustmentType : undefined,
        adjustmentValue: (hasDiscount || hasComplimentary) ? values.adjustmentValue : undefined,
        adjustmentReason: (hasDiscount || hasComplimentary) ? values.adjustmentReason : undefined,
        acknowledgedByStaffId: (hasDiscount || hasComplimentary) ? values.acknowledgedByStaffId : undefined,
        compBeneficiaryType: hasComplimentary ? values.compBeneficiaryType : undefined,
        compBeneficiaryStaffId: hasComplimentary ? values.compBeneficiaryStaffId : undefined,
        compSettlementType: hasComplimentary ? values.compSettlementType : undefined,
      };

      const res = await provider.reservations.create(payload);
      return { data: res }; // Wrap to match expected return type in onSuccess
    },
    onSuccess: (data) => {
      toast.success(isWalkIn ? 'Walk-In Created!' : 'Reservation created successfully');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard'] });
      
      // Navigate to the newly created reservation in the Front Desk view
      const newId = data.data?.data?.id || data.data?.id;
      router.push(`/frontdesk/reservations/detail?id=${newId}`);
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
    ? differenceInCalendarDays(checkOut, checkIn)
    : 0;

  const invalidDateRange = !checkIn || !checkOut || nights < 1;
  const minimumCheckoutDate = checkIn ? addDays(checkIn, 1) : addDays(businessDate, 1);
  const disableCheckInDate = (date: Date) => isBefore(startOfDay(date), businessDate);
  const disableCheckoutDate = (date: Date) => isBefore(startOfDay(date), minimumCheckoutDate);
  

  
  let discountDeduction = 0;
  let compDeduction = 0;
  const nightlyRate = selectedRoomType ? selectedRoomType.baseRate : 0;

  if (selectedRoomType && adjustmentType !== 'NONE') {
    if (adjustmentType === 'DISCOUNT_PERCENTAGE') {
      discountDeduction = nightlyRate * (adjustmentValue / 100);
    } else if (adjustmentType === 'DISCOUNT_FIXED') {
      discountDeduction = adjustmentValue;
    } else if (adjustmentType === 'COMP_FULL') {
      compDeduction = nightlyRate;
    } else if (adjustmentType === 'COMP_PARTIAL') {
      compDeduction = adjustmentValue; // treated as fixed amount per night or per stay? per night usually in reservations
    }
  }

  const estimatedTotal = nightlyRate * nights;
  const effectiveTotal = Math.max(0, (nightlyRate - discountDeduction - compDeduction) * nights);

  const formatter = useMemo(() => selectedRoomType ? new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: selectedRoomType.currency || 'NGN',
    maximumFractionDigits: 0
  }) : null, [selectedRoomType]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT PANE: Guest & Occupancy */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Guest Selection Glass Card */}
            <div className="relative z-40 bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl shadow-blue-900/5 rounded-3xl p-8">
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
                    setSelectedGuest(null);
                    setGuestSearch('');
                    setGuestDropdownOpen(false);
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
                      {selectedGuest || field.value ? (
                        <div className="flex items-center justify-between gap-4 min-h-14 rounded-2xl bg-blue-50/70 border border-blue-200 px-4 shadow-sm">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                              {selectedGuest?.firstName?.[0]}{selectedGuest?.lastName?.[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-800">{selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}` : 'Selected guest'}</p>
                              <p className="truncate text-xs text-slate-500">{selectedGuest?.phone || selectedGuest?.email || 'Guest selected'}</p>
                            </div>
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-slate-500 hover:text-blue-700" onClick={() => {
                            field.onChange('');
                            setSelectedGuest(null);
                            setGuestSearch('');
                            setGuestDropdownOpen(true);
                          }}>
                            Change
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={guestSearch}
                            onChange={(event) => {
                              setGuestSearch(event.target.value);
                              setGuestDropdownOpen(true);
                            }}
                            onFocus={() => setGuestDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setGuestDropdownOpen(false), 150)}
                            placeholder="Search by name, phone number, or email..."
                            autoComplete="off"
                            aria-label="Search guests by name, phone number, or email"
                            className="h-14 rounded-2xl border-slate-200 bg-white pl-12 pr-12 text-base shadow-sm transition-shadow focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                            disabled={loadingGuests}
                          />
                          {loadingGuests ? (
                            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-blue-500" />
                          ) : guestSearch ? (
                            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => setGuestSearch('')}>
                              <X className="h-5 w-5" />
                            </button>
                          ) : null}
                          {guestDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
                              <div className="flex items-center justify-between px-3 py-2">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{guestSearch ? 'Matching guests' : 'Recent guests'}</p>
                                {guestSearch && <span className="text-xs text-slate-400">{filteredGuests.length} found</span>}
                              </div>
                              {visibleGuests.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-slate-500">{guestSearch ? 'No guest found for that search.' : 'No guests available.'}</div>
                              ) : visibleGuests.map((guest: any) => (
                                <button
                                  key={guest.id}
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-blue-50"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    field.onChange(guest.id);
                                    setSelectedGuest(guest);
                                    setGuestSearch('');
                                    setGuestDropdownOpen(false);
                                  }}
                                >
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">{guest.firstName?.[0]}{guest.lastName?.[0]}</div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-bold text-slate-800">{guest.firstName} {guest.lastName}</p>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                      {guest.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{guest.phone}</span>}
                                      {guest.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{guest.email}</span>}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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
                          onChange={(date) => {
                            field.onChange(date);
                            if (date && (!checkOut || checkOut <= date)) form.setValue('checkOut', addDays(date, 1), { shouldValidate: true });
                          }}
                          disabled={isWalkIn}
                          disabledDays={disableCheckInDate}
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
                          disabledDays={disableCheckoutDate}
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
                              <SelectValue placeholder="Select room type...">
                                {roomTypes?.find((rt: any) => rt.id === field.value)?.name || 'Select room type...'}
                              </SelectValue>
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
                              }>
                                {availableRooms?.find((room: any) => room.id === field.value)?.number
                                  ? `Room ${formatRoomNumber(availableRooms.find((room: any) => room.id === field.value).number)}`
                                  : field.value ? 'Selected room' : undefined}
                              </SelectValue>
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

                  <FormField
                    control={form.control}
                    name="corporateAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-400 ml-1">Corporate Client (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={loadingCorporateAccounts}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white">
                              <SelectValue placeholder="No corporate account">
                                {field.value && field.value !== 'none'
                                  ? corporateAccounts?.find((ca: any) => ca.id === field.value)?.name || 'Unknown Account'
                                  : 'No corporate account'}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-60">
                            <SelectItem value="none" className="focus:bg-slate-700 focus:text-white">
                              No corporate account
                            </SelectItem>
                            {corporateAccounts?.map((ca: any) => (
                              <SelectItem key={ca.id} value={ca.id} className="focus:bg-slate-700 focus:text-white flex justify-between">
                                {ca.name} ({ca.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Adjustment Section */}
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-slate-300">Discount / Complimentary <span className="text-slate-500 font-normal">(Optional)</span></h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="adjustmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-400 ml-1">Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-900 border-slate-700 text-white">
                              <SelectValue placeholder="No adjustment" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            <SelectItem value="NONE" className="focus:bg-slate-700 focus:text-white">None</SelectItem>
                            <SelectItem value="DISCOUNT_PERCENTAGE" className="focus:bg-slate-700 focus:text-white">Discount Percentage (%)</SelectItem>
                            <SelectItem value="DISCOUNT_FIXED" className="focus:bg-slate-700 focus:text-white">Discount Fixed Amount</SelectItem>
                            <SelectItem value="COMP_FULL" className="focus:bg-slate-700 focus:text-white">Fully Complimentary</SelectItem>
                            <SelectItem value="COMP_PARTIAL" className="focus:bg-slate-700 focus:text-white">Partially Complimentary</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {adjustmentType !== 'NONE' && (
                    <>
                      {adjustmentType !== 'COMP_FULL' && (
                        <FormField
                          control={form.control}
                          name="adjustmentValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-400 ml-1">
                                {adjustmentType === 'DISCOUNT_PERCENTAGE' ? 'Percentage (%)' : 'Amount / Night'}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max={adjustmentType === 'DISCOUNT_PERCENTAGE' ? 100 : undefined}
                                  className="h-12 rounded-xl bg-slate-900 border-slate-700 text-white"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {(adjustmentType === 'COMP_FULL' || adjustmentType === 'COMP_PARTIAL') && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="compBeneficiaryType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-400 ml-1">Beneficiary Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-12 rounded-xl bg-slate-900 border-slate-700 text-white">
                                      <SelectValue placeholder="Select type..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                    <SelectItem value="GUEST" className="focus:bg-slate-700 focus:text-white">External Guest</SelectItem>
                                    <SelectItem value="STAFF" className="focus:bg-slate-700 focus:text-white">Staff Member</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {compBeneficiaryType === 'STAFF' && (
                            <>
                              <FormField
                                control={form.control}
                                name="compBeneficiaryStaffId"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-slate-400 ml-1">Beneficiary Staff Member</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-12 rounded-xl bg-slate-900 border-slate-700 text-white">
                                          <SelectValue placeholder="Select staff member..." />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-60">
                                        {managers.map((m: any) => (
                                          <SelectItem key={m.id} value={m.id} className="focus:bg-slate-700 focus:text-white">
                                            {m.firstName} {m.lastName} <span className="text-slate-400 text-xs ml-1">({m.role || m.position})</span>
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
                                name="compSettlementType"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-slate-400 ml-1">Settlement</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-12 rounded-xl bg-slate-900 border-slate-700 text-white">
                                          <SelectValue placeholder="Select settlement..." />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                        <SelectItem value="PAY_NOW" className="focus:bg-slate-700 focus:text-white">Pay Now (If partial)</SelectItem>
                                        <SelectItem value="STAFF_PAY_LATER" className="focus:bg-slate-700 focus:text-white">Staff Receivables (Pay Later)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </>
                          )}
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name="adjustmentReason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-400 ml-1">Reason</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="e.g. Loyalty guest, management approved, staff benefit..."
                                className="rounded-xl bg-slate-900 border-slate-700 text-white text-sm resize-none"
                                rows={2}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="acknowledgedByStaffId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-400 ml-1">Acknowledged By</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 rounded-xl bg-slate-900 border-slate-700 text-white">
                                  <SelectValue placeholder="Select acknowledging staff..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-60">
                                {managers.length === 0 && (
                                  <SelectItem value="none" disabled className="text-slate-500">No managers found</SelectItem>
                                )}
                                {managers.map((m: any) => (
                                  <SelectItem key={m.id} value={m.id} className="focus:bg-slate-700 focus:text-white">
                                    {m.firstName} {m.lastName} <span className="text-slate-400 text-xs ml-1">({m.role || m.position})</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                {/* Total Estimate */}
                <div className="bg-blue-600/20 border border-blue-500/30 rounded-2xl p-5 mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-blue-200 text-sm font-medium">Stay Amount</span>
                    <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full">
                      {nights} {nights === 1 ? 'Night' : 'Nights'}
                    </span>
                  </div>
                  {checkIn && checkOut && nights > 0 && (
                    <p className="mb-3 text-xs font-medium text-blue-200/90">
                      {format(checkIn, 'dd MMM yyyy')} → {format(checkOut, 'dd MMM yyyy')}
                    </p>
                  )}
                  {selectedRoomType && formatter && nights > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-sm text-blue-100">
                        <span>{nights} × {formatter.format(nightlyRate)} per night</span>
                        <span className="font-semibold">Room rate</span>
                      </div>
                      {adjustmentType !== 'NONE' && (discountDeduction > 0 || compDeduction > 0) && (
                        <div className="flex items-center justify-between text-sm text-amber-300">
                          <span>
                            {adjustmentType.startsWith('DISCOUNT') ? 'Discount' : 'Complimentary'} 
                            ({adjustmentType === 'DISCOUNT_PERCENTAGE' ? `${adjustmentValue}%` : formatter.format(discountDeduction + compDeduction)}/night)
                          </span>
                          <span className="font-semibold">− {formatter.format((discountDeduction + compDeduction) * nights)}</span>
                        </div>
                      )}
                      <div className="mt-2 text-3xl font-bold text-white tracking-tight">
                        {formatter.format(adjustmentType !== 'NONE' && (discountDeduction > 0 || compDeduction > 0) ? effectiveTotal : estimatedTotal)}
                        {adjustmentType !== 'NONE' && (discountDeduction > 0 || compDeduction > 0) && (
                          <span className="ml-2 text-base line-through text-slate-400 font-normal">{formatter.format(estimatedTotal)}</span>
                        )}
                      </div>
                      {adjustmentType !== 'NONE' && (discountDeduction > 0 || compDeduction > 0) && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-300/80">
                          <Tag className="w-3 h-3" />
                          <span>Pending Night Auditor approval</span>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between border-t border-blue-400/20 pt-2 text-xs text-blue-200">
                        <span>Average nightly total</span>
                        <span className="font-semibold">{formatter.format((adjustmentType !== 'NONE' && (discountDeduction > 0 || compDeduction > 0) ? effectiveTotal : estimatedTotal) / nights)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl font-bold text-white tracking-tight">Select a room type and dates</div>
                  )}
                  {checkIn && checkOut && invalidDateRange && <p className="mt-2 text-xs font-medium text-rose-300">Choose a checkout date at least one night after check-in.</p>}
                  <div className="mt-2 text-xs text-blue-200/80">
                    Estimated from the selected room rate and nights. The server validates the final rate when saved.
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
