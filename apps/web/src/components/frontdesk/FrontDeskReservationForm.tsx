'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
// shadcn Select removed — using PremiumDropdown instead
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Loader2, Plus, ArrowRight, UserPlus, Calendar, Search, X,
  CheckCircle2, Phone, Mail, Tag, Wallet, Users, BedDouble,
  Building2, ChevronDown, Sparkles, Info, AlertCircle, Check
} from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

/* ─────────────────────────────────────────────────────────────────────────────
   Zod schema (unchanged from original)
───────────────────────────────────────────────────────────────────────────── */
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
  adjustmentType: z.enum(['NONE', 'DISCOUNT_PERCENTAGE', 'DISCOUNT_FIXED', 'COMP_FULL', 'COMP_PARTIAL']),
  adjustmentValue: z.coerce.number().min(0).optional(),
  adjustmentReason: z.string().optional(),
  acknowledgedByStaffId: z.string().optional(),
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

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */
function formatAmountInput(value: number | string) {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return '';
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(numeric);
}

/** Small pill badge for section steps */
function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
      {n}
    </span>
  );
}

/** Section card wrapper */
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)] ${className}`}>
      {children}
    </div>
  );
}

/** Inline label + hint row for section headers */
function SectionHeader({ step, title, hint, icon }: { step: number; title: string; hint?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-slate-100 px-6 py-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <StepBadge n={step} />
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        </div>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PremiumDropdown — portal-based custom select (bypasses overflow:hidden)
───────────────────────────────────────────────────────────────────────────── */
type PDOption = {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

function PremiumDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  dark = false,
  emptyMessage = 'No options available',
  loading = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: PDOption[];
  placeholder?: string;
  disabled?: boolean;
  dark?: boolean;
  emptyMessage?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  // Position the portal panel beneath the trigger button
  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const panelHeight = Math.min(280, options.length * 56 + 24);
    const openAbove = spaceBelow < panelHeight + 8 && rect.top > panelHeight + 8;
    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      zIndex: 9999,
    });
  }, [options.length]);

  // Reposition on open and on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const triggerBase = dark
    ? 'border-slate-700 bg-slate-800/70 text-white hover:bg-slate-800'
    : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white';
  const triggerOpen = dark
    ? 'border-indigo-400 bg-slate-800 ring-2 ring-indigo-400/20'
    : 'border-indigo-400 bg-white ring-4 ring-indigo-100 shadow-md';
  const placeholderColor = dark ? 'text-slate-500' : 'text-slate-400';

  const panel = open && typeof window !== 'undefined' && (
    <div
      ref={panelRef}
      style={{ ...panelStyle, animation: 'pdDropIn 0.16s cubic-bezier(0.16,1,0.3,1) both' }}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] ring-1 ring-black/5"
    >
      <style>{`@keyframes pdDropIn{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {options.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">{emptyMessage}</p>
        ) : options.map(opt => {
          const isSel = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { if (!opt.disabled) { onChange(opt.value); setOpen(false); } }}
              className={[
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-100',
                isSel ? 'bg-indigo-50' : 'hover:bg-slate-50',
                opt.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
              ].join(' ')}
            >
              {opt.icon && (
                <span className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isSel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600',
                ].join(' ')}>{opt.icon}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${isSel ? 'text-indigo-900' : 'text-slate-800'}`}>
                  {opt.label}
                </span>
                {opt.sublabel && (
                  <span className="block truncate text-xs text-slate-500">{opt.sublabel}</span>
                )}
              </span>
              {opt.badge && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  opt.badgeColor ?? 'bg-slate-100 text-slate-600'
                }`}>{opt.badge}</span>
              )}
              {isSel && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(p => !p); } }}
        className={[
          'flex h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left text-sm font-medium transition-all duration-200',
          open ? triggerOpen : triggerBase,
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        ].join(' ')}
      >
        {loading ? (
          <span className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </span>
        ) : selected ? (
          <span className="flex min-w-0 items-center gap-2.5">
            {selected.icon && (
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                dark ? 'bg-white/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
              }`}>{selected.icon}</span>
            )}
            <span className="min-w-0">
              <span className={`block truncate font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{selected.label}</span>
              {selected.sublabel && (
                <span className={`block truncate text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{selected.sublabel}</span>
              )}
            </span>
            {selected.badge && (
              <span className={`ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                selected.badgeColor ?? 'bg-indigo-100 text-indigo-700'
              }`}>{selected.badge}</span>
            )}
          </span>
        ) : (
          <span className={`text-sm font-normal ${placeholderColor}`}>{placeholder}</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
          dark ? 'text-slate-500' : 'text-slate-400'
        } ${open ? 'rotate-180' : ''}`} />
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Props
───────────────────────────────────────────────────────────────────────────── */
interface FrontDeskReservationFormProps {
  isWalkIn?: boolean;
  prefillGuestId?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────────────────── */
export function FrontDeskReservationForm({ isWalkIn = false, prefillGuestId }: FrontDeskReservationFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();

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

  /* ── Data: business date ── */
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

  useEffect(() => {
    if (!datesInitialized && businessDate) {
      form.setValue('checkIn', businessDate);
      form.setValue('checkOut', addDays(businessDate, 1));
      setDatesInitialized(true);
    }
  }, [datesInitialized, businessDate, form]);

  /* ── Watchers ── */
  const isNewGuest = form.watch('isNewGuest');
  const checkIn = form.watch('checkIn');
  const checkOut = form.watch('checkOut');
  const roomTypeId = form.watch('roomTypeId');
  const corporateAccountId = form.watch('corporateAccountId');
  const adjustmentType = form.watch('adjustmentType');
  const adjustmentValue = form.watch('adjustmentValue') || 0;
  const compBeneficiaryType = form.watch('compBeneficiaryType');

  /* ── Guest search ── */
  const [guestSearch, setGuestSearch] = useState('');
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);

  const { data: prefillGuestRes } = useQuery({
    queryKey: ['guest', prefillGuestId],
    queryFn: async () => {
      if (!prefillGuestId) return null;
      const res = await provider.guests.search(prefillGuestId);
      return (res as any)?.data || [];
    },
    enabled: !!prefillGuestId && !selectedGuest,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (prefillGuestId && prefillGuestRes && Array.isArray(prefillGuestRes) && prefillGuestRes.length > 0) {
      const match = prefillGuestRes.find((g: any) => g.id === prefillGuestId) || prefillGuestRes[0];
      if (match && !selectedGuest) {
        setSelectedGuest(match);
        form.setValue('guestId', match.id);
        form.setValue('isNewGuest', false);
      }
    }
  }, [prefillGuestId, prefillGuestRes, selectedGuest, form]);

  const { data: prefillCreditRes } = useQuery({
    queryKey: ['guest-credit-prefill', propertyId, prefillGuestId],
    queryFn: () => provider.guestCredits.list(propertyId),
    enabled: !!prefillGuestId && !!propertyId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const prefilledCredit = useMemo(() => {
    const response: any = prefillCreditRes;
    const credits = Array.isArray(response)
      ? response
      : (response?.data ?? response?.credits ?? []);
    return Array.isArray(credits)
      ? credits.find((credit: any) => credit.guestId === prefillGuestId) ?? null
      : null;
  }, [prefillCreditRes, prefillGuestId]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(guestSearch), 300);
    return () => clearTimeout(handler);
  }, [guestSearch]);

  const { data: guestsRes, isLoading: loadingGuests } = useQuery({
    queryKey: ['guests', debouncedSearch],
    queryFn: async () => provider.guests.search(debouncedSearch),
    enabled: !isNewGuest && guestDropdownOpen,
  });
  const filteredGuests = (guestsRes as any)?.data || [];
  const visibleGuests = filteredGuests.slice(0, 8);

  /* ── Room types & rooms ── */
  const { data: roomTypesRes, isLoading: loadingRoomTypes } = useQuery({
    queryKey: ['room-types', propertyId],
    queryFn: async () => provider.roomTypes.list(propertyId),
    enabled: !!propertyId,
  });
  const roomTypes = ((roomTypesRes as any)?.data || []).map((rt: any) => ({
    ...rt,
    baseRate: Number(rt.baseRate ?? rt.basePrice ?? rt.BasePrice ?? 0),
    currency: rt.currency || rt.Currency || 'NGN',
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
    queryFn: async () => provider.corporateAccounts.list(propertyId),
    enabled: !!propertyId,
  });
  const corporateAccounts = (corporateAccountsRes as any)?.data || [];

  const { data: managersRes } = useQuery({
    queryKey: ['managers-local', propertyId],
    queryFn: async () => provider.auth.getActiveStaff(),
    enabled: !!propertyId,
    staleTime: 300_000,
  });
  const managers = (managersRes as any)?.data || [];

  useEffect(() => { form.setValue('roomId', ''); }, [roomTypeId, checkIn, checkOut, form]);

  /* ── Submit ── */
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
        adjustmentType: (hasDiscount || hasComplimentary) ? values.adjustmentType : undefined,
        adjustmentValue: (hasDiscount || hasComplimentary) ? values.adjustmentValue : undefined,
        adjustmentReason: (hasDiscount || hasComplimentary) ? values.adjustmentReason : undefined,
        acknowledgedByStaffId: (hasDiscount || hasComplimentary) ? values.acknowledgedByStaffId : undefined,
        compBeneficiaryType: hasComplimentary ? values.compBeneficiaryType : undefined,
        compBeneficiaryStaffId: hasComplimentary ? values.compBeneficiaryStaffId : undefined,
        compSettlementType: hasComplimentary ? values.compSettlementType : undefined,
      };

      let guestCreditToApply: any = prefilledCredit;
      if (prefillGuestId) {
        const latestCreditResponse: any = await provider.guestCredits.list(propertyId);
        const latestCredits = Array.isArray(latestCreditResponse)
          ? latestCreditResponse
          : (latestCreditResponse?.data ?? latestCreditResponse?.credits ?? []);
        guestCreditToApply = Array.isArray(latestCredits)
          ? latestCredits.find((credit: any) => credit.guestId === prefillGuestId) ?? null
          : null;
      }

      const res: any = await provider.reservations.create(payload);

      if (prefillGuestId && Number(guestCreditToApply?.availableAmount ?? 0) > 0) {
        const reservationId = res?.data?.newReservation?.id || res?.data?.id || res?.newReservation?.id || res?.id;
        if (!reservationId) throw new Error('Reservation was created but its ID could not be determined for guest-credit application.');
        const reservationResponse: any = await provider.reservations.get(reservationId);
        const reservation = reservationResponse?.data?.newReservation || reservationResponse?.data || reservationResponse?.reservation || reservationResponse;
        const folios = reservation?.folios || (reservation?.folio ? [reservation.folio] : []);
        const folio = Array.isArray(folios) ? folios.find((item: any) => item?.id) : null;
        if (!folio?.id) throw new Error('Reservation was created but its folio could not be found for guest-credit application.');
        await provider.guestCredits.apply({ folioId: folio.id, guestId: prefillGuestId, amount: Number(guestCreditToApply.availableAmount) });
      }

      return { data: res };
    },
    onSuccess: (data) => {
      toast.success(prefillGuestId
        ? 'Reservation created and guest credit applied to the folio'
        : (isWalkIn ? 'Walk-In Created!' : 'Reservation created successfully'));
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard'] });
      const newId = data.data?.data?.id || data.data?.id;
      router.push(`/frontdesk/reservations/detail?id=${newId}`);
    },
    onError: (error) => { toast.error(error.message); },
  });

  function onSubmit(values: z.infer<typeof formSchema>) { createReservation.mutate(values); }

  /* ── Pricing ── */
  const selectedRoomType = roomTypes?.find((rt: any) => rt.id === roomTypeId);
  const selectedCorporateAccount = corporateAccounts?.find((ca: any) => ca.id === corporateAccountId && corporateAccountId !== 'none');
  const corporateRate = selectedCorporateAccount?.ratePlan?.rates?.find((rate: any) => rate.roomTypeId === roomTypeId);
  const nights = (checkIn && checkOut && checkOut > checkIn) ? differenceInCalendarDays(checkOut, checkIn) : 0;
  const invalidDateRange = !checkIn || !checkOut || nights < 1;
  const minimumCheckoutDate = checkIn ? addDays(checkIn, 1) : addDays(businessDate, 1);
  const disableCheckInDate = (date: Date) => isBefore(startOfDay(date), businessDate);
  const disableCheckoutDate = (date: Date) => isBefore(startOfDay(date), minimumCheckoutDate);

  let discountDeduction = 0;
  let compDeduction = 0;
  const nightlyRate = corporateRate ? Number(corporateRate.amount ?? corporateRate.baseAmount ?? 0) : (selectedRoomType ? selectedRoomType.baseRate : 0);
  const isCorporateRate = Boolean(corporateRate);

  if (selectedRoomType && adjustmentType !== 'NONE') {
    if (adjustmentType === 'DISCOUNT_PERCENTAGE') discountDeduction = nightlyRate * (adjustmentValue / 100);
    else if (adjustmentType === 'DISCOUNT_FIXED') discountDeduction = adjustmentValue;
    else if (adjustmentType === 'COMP_FULL') compDeduction = nightlyRate;
    else if (adjustmentType === 'COMP_PARTIAL') compDeduction = adjustmentValue;
  }

  const estimatedTotal = nightlyRate * nights;
  const effectiveTotal = Math.max(0, (nightlyRate - discountDeduction - compDeduction) * nights);
  const hasAdjustment = adjustmentType !== 'NONE' && (discountDeduction > 0 || compDeduction > 0);

  const formatter = useMemo(() => selectedRoomType ? new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: selectedRoomType.currency || 'NGN', maximumFractionDigits: 0
  }) : null, [selectedRoomType]);

  /* ───────────────────────────────────────────────────────────────────────────
     Render
  ─────────────────────────────────────────────────────────────────────────── */
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

          {/* ══════════════════════════════════════════════════════════════════
              LEFT COLUMN  (span 7)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-6">

            {/* ── Section 1: Guest Identity ── */}
            <SectionCard>
              <SectionHeader
                step={1}
                title="Guest Identity"
                hint={isNewGuest ? 'Fill in the new guest details below' : 'Search your guest database by name, phone or email'}
                icon={<UserPlus className="h-5 w-5" />}
              />
              <div className="p-6">
                {/* Toggle */}
                <div className="mb-6 flex items-center gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => { form.setValue('isNewGuest', false); form.setValue('guestId', ''); setSelectedGuest(null); setGuestSearch(''); setGuestDropdownOpen(false); }}
                    className={[
                      'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200',
                      !isNewGuest ? 'bg-white text-indigo-700 shadow-[0_2px_8px_rgba(15,23,42,0.10)]' : 'text-slate-500 hover:text-slate-700'
                    ].join(' ')}
                  >
                    <Search className="mr-2 inline h-4 w-4" />Search Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => { form.setValue('isNewGuest', true); form.setValue('guestId', ''); setSelectedGuest(null); setGuestSearch(''); setGuestDropdownOpen(false); }}
                    className={[
                      'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200',
                      isNewGuest ? 'bg-white text-indigo-700 shadow-[0_2px_8px_rgba(15,23,42,0.10)]' : 'text-slate-500 hover:text-slate-700'
                    ].join(' ')}
                  >
                    <Plus className="mr-2 inline h-4 w-4" />New Guest
                  </button>
                </div>

                {/* Existing guest search */}
                {!isNewGuest ? (
                  <FormField
                    control={form.control}
                    name="guestId"
                    render={({ field }) => (
                      <FormItem>
                        {selectedGuest || field.value ? (
                          /* Selected guest chip */
                          <div className="flex items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                                {selectedGuest?.firstName?.[0]}{selectedGuest?.lastName?.[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">
                                  {selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}` : 'Selected guest'}
                                </p>
                                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                                  {selectedGuest?.phone && <span><Phone className="mr-1 inline h-3 w-3" />{selectedGuest.phone}</span>}
                                  {selectedGuest?.email && <span><Mail className="mr-1 inline h-3 w-3" />{selectedGuest.email}</span>}
                                  {!selectedGuest?.phone && !selectedGuest?.email && <span>Guest selected</span>}
                                </div>
                                {prefillGuestId && prefilledCredit && (
                                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                                    <Wallet className="mr-1 inline h-3 w-3" />
                                    Available credit: {new Intl.NumberFormat('en-NG', {
                                      style: 'currency', currency: prefilledCredit.currency || 'NGN', maximumFractionDigits: 0
                                    }).format(Number(prefilledCredit.availableAmount || 0))}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                              <Button type="button" variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-indigo-700"
                                onClick={() => { field.onChange(''); setSelectedGuest(null); setGuestSearch(''); setGuestDropdownOpen(true); }}>
                                Change
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Search input */
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <Input
                              value={guestSearch}
                              onChange={(e) => { setGuestSearch(e.target.value); setGuestDropdownOpen(true); }}
                              onFocus={() => setGuestDropdownOpen(true)}
                              onBlur={() => setTimeout(() => setGuestDropdownOpen(false), 150)}
                              placeholder="Search by name, phone or email…"
                              autoComplete="off"
                              className="h-13 h-[52px] rounded-2xl border-slate-200 bg-slate-50 pl-12 pr-12 text-sm shadow-sm transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                              disabled={loadingGuests}
                            />
                            {loadingGuests
                              ? <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500" />
                              : guestSearch
                                ? <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onMouseDown={(e) => e.preventDefault()} onClick={() => setGuestSearch('')}><X className="h-4 w-4" /></button>
                                : null}

                            {/* Dropdown */}
                            {guestDropdownOpen && (
                              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
                                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                    {guestSearch ? 'Matching guests' : 'Recent guests'}
                                  </p>
                                  {guestSearch && <span className="text-xs text-slate-400">{filteredGuests.length} found</span>}
                                </div>
                                <div className="max-h-60 overflow-y-auto p-2">
                                  {visibleGuests.length === 0 ? (
                                    <p className="px-4 py-8 text-center text-sm text-slate-400">
                                      {guestSearch ? 'No guest found.' : 'No guests yet.'}
                                    </p>
                                  ) : visibleGuests.map((guest: any) => (
                                    <button
                                      key={guest.id}
                                      type="button"
                                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-indigo-50"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => { field.onChange(guest.id); setSelectedGuest(guest); setGuestSearch(''); setGuestDropdownOpen(false); }}
                                    >
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                                        {guest.firstName?.[0]}{guest.lastName?.[0]}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-900">{guest.firstName} {guest.lastName}</p>
                                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                                          {guest.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{guest.phone}</span>}
                                          {guest.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{guest.email}</span>}
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  /* New guest fields */
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="guestDetails.firstName" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">First Name</FormLabel>
                        <FormControl><Input className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="guestDetails.lastName" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Last Name</FormLabel>
                        <FormControl><Input className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="guestDetails.email" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Email <span className="font-normal normal-case text-slate-400">(optional)</span></FormLabel>
                        <FormControl><Input type="email" className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="guestDetails.phone" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone <span className="font-normal normal-case text-slate-400">(optional)</span></FormLabel>
                        <FormControl><Input type="tel" className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>
            </SectionCard>

            {/* ── Section 2: Occupancy ── */}
            <SectionCard>
              <SectionHeader step={2} title="Occupancy" hint="How many guests will be staying in this room?" icon={<Users className="h-5 w-5" />} />
              <div className="grid grid-cols-2 gap-6 p-6">
                <FormField control={form.control} name="adults" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Adults</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => field.onChange(Math.max(1, Number(field.value) - 1))}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">−</button>
                        <div className="flex-1 rounded-xl border border-slate-200 bg-white text-center text-xl font-bold text-slate-900 py-2.5">{field.value}</div>
                        <button type="button" onClick={() => field.onChange(Number(field.value) + 1)}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">+</button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="children" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Children</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => field.onChange(Math.max(0, Number(field.value) - 1))}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">−</button>
                        <div className="flex-1 rounded-xl border border-slate-200 bg-white text-center text-xl font-bold text-slate-900 py-2.5">{field.value}</div>
                        <button type="button" onClick={() => field.onChange(Number(field.value) + 1)}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">+</button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </SectionCard>

            {/* ── Section 3: Corporate Client ── */}
            <SectionCard>
              <SectionHeader step={3} title="Corporate Client" hint="Attach a corporate account to apply negotiated rates" icon={<Building2 className="h-5 w-5" />} />
              <div className="p-6">
                <FormField control={form.control} name="corporateAccountId" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PremiumDropdown
                        value={field.value || 'none'}
                        onChange={field.onChange}
                        loading={loadingCorporateAccounts}
                        placeholder="No corporate account — standard rate"
                        options={[
                          { value: 'none', label: 'No corporate account', sublabel: 'Standard room rate applies', icon: <Building2 className="h-4 w-4" /> },
                          ...corporateAccounts.map((ca: any) => ({
                            value: ca.id,
                            label: ca.name,
                            sublabel: `Code: ${ca.code}`,
                            badge: 'Corp',
                            badgeColor: 'bg-blue-100 text-blue-700',
                            icon: <Building2 className="h-4 w-4" />,
                          })),
                        ]}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </SectionCard>

            {/* ── Section 4: Discount / Complimentary ── */}
            <SectionCard>
              <SectionHeader step={4} title="Rate Adjustment" hint="Discounts and complimentary stays require management acknowledgement" icon={<Tag className="h-5 w-5" />} />
              <div className="space-y-5 p-6">
                <FormField control={form.control} name="adjustmentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Type</FormLabel>
                    <FormControl>
                      <PremiumDropdown
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: 'NONE', label: 'None', sublabel: 'Standard pricing applies', icon: <Tag className="h-4 w-4" />, badge: 'Default', badgeColor: 'bg-slate-100 text-slate-500' },
                          { value: 'DISCOUNT_PERCENTAGE', label: 'Discount — Percentage', sublabel: 'Reduce rate by a % per night', icon: <Tag className="h-4 w-4" />, badge: '%', badgeColor: 'bg-amber-100 text-amber-700' },
                          { value: 'DISCOUNT_FIXED', label: 'Discount — Fixed Amount', sublabel: 'Reduce rate by a fixed ₦ amount', icon: <Tag className="h-4 w-4" />, badge: '₦', badgeColor: 'bg-amber-100 text-amber-700' },
                          { value: 'COMP_FULL', label: 'Fully Complimentary', sublabel: 'Entire stay at zero charge', icon: <Sparkles className="h-4 w-4" />, badge: 'COMP', badgeColor: 'bg-purple-100 text-purple-700' },
                          { value: 'COMP_PARTIAL', label: 'Partially Complimentary', sublabel: 'Fixed amount waived per night', icon: <Sparkles className="h-4 w-4" />, badge: 'COMP', badgeColor: 'bg-purple-100 text-purple-700' },
                        ]}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {adjustmentType !== 'NONE' && (
                  <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                      <AlertCircle className="h-4 w-4" /> Requires management sign-off before this reservation can be audited
                    </div>

                    {adjustmentType !== 'COMP_FULL' && (
                      <FormField control={form.control} name="adjustmentValue" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {adjustmentType === 'DISCOUNT_PERCENTAGE' ? 'Percentage (%)' : 'Amount / Night'}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              {(adjustmentType === 'DISCOUNT_FIXED' || adjustmentType === 'COMP_PARTIAL') && (
                                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">₦</span>
                              )}
                              <Input
                                type={adjustmentType === 'DISCOUNT_FIXED' || adjustmentType === 'COMP_PARTIAL' ? 'text' : 'number'}
                                inputMode={adjustmentType === 'DISCOUNT_FIXED' || adjustmentType === 'COMP_PARTIAL' ? 'decimal' : 'numeric'}
                                min="0"
                                max={adjustmentType === 'DISCOUNT_PERCENTAGE' ? 100 : undefined}
                                className={`h-12 rounded-xl border-slate-200 bg-white ${(adjustmentType === 'DISCOUNT_FIXED' || adjustmentType === 'COMP_PARTIAL') ? 'pl-9' : ''}`}
                                value={adjustmentType === 'DISCOUNT_FIXED' || adjustmentType === 'COMP_PARTIAL' ? formatAmountInput(field.value || 0) : field.value}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9.]/g, '');
                                  field.onChange(adjustmentType === 'DISCOUNT_FIXED' || adjustmentType === 'COMP_PARTIAL' ? (raw ? Number(raw) : 0) : e.target.value);
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}

                    {(adjustmentType === 'COMP_FULL' || adjustmentType === 'COMP_PARTIAL') && (
                      <div className="space-y-4">
                        <FormField control={form.control} name="compBeneficiaryType" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Beneficiary Type</FormLabel>
                            <FormControl>
                              <PremiumDropdown
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                options={[
                                  { value: 'GUEST', label: 'External Guest', sublabel: 'Outside-hotel guest receiving complimentary stay', icon: <UserPlus className="h-4 w-4" />, badge: 'Guest', badgeColor: 'bg-emerald-100 text-emerald-700' },
                                  { value: 'STAFF', label: 'Staff Member', sublabel: 'Hotel employee — requires staff ID and settlement', icon: <Users className="h-4 w-4" />, badge: 'Staff', badgeColor: 'bg-blue-100 text-blue-700' },
                                ]}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        {compBeneficiaryType === 'STAFF' && (
                          <>
                            <FormField control={form.control} name="compBeneficiaryStaffId" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Beneficiary Staff Member</FormLabel>
                                <FormControl>
                                  <PremiumDropdown
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    placeholder="Select staff member…"
                                    emptyMessage="No active staff found"
                                    options={managers.map((m: any) => ({
                                      value: m.id,
                                      label: `${m.firstName} ${m.lastName}`,
                                      sublabel: m.role || m.position || 'Staff',
                                      badge: (m.role || m.position || '').toUpperCase().slice(0, 8),
                                      badgeColor: 'bg-slate-100 text-slate-600',
                                      icon: <span className="flex h-full w-full items-center justify-center text-xs font-bold">{m.firstName?.[0]}{m.lastName?.[0]}</span>,
                                    }))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="compSettlementType" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Settlement</FormLabel>
                                <FormControl>
                                  <PremiumDropdown
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    placeholder="Select settlement…"
                                    options={[
                                      { value: 'PAY_NOW', label: 'Pay Now', sublabel: 'Collect outstanding balance immediately', icon: <Wallet className="h-4 w-4" />, badge: 'Immediate', badgeColor: 'bg-emerald-100 text-emerald-700' },
                                      { value: 'STAFF_PAY_LATER', label: 'Staff Receivables', sublabel: 'Logged as staff debt — settled via payroll', icon: <Users className="h-4 w-4" />, badge: 'Deferred', badgeColor: 'bg-amber-100 text-amber-700' },
                                    ]}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </>
                        )}
                      </div>
                    )}

                    <FormField control={form.control} name="adjustmentReason" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g. Loyalty guest, management approved, staff benefit…" className="rounded-xl border-slate-200 bg-white text-sm resize-none" rows={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="acknowledgedByStaffId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Acknowledged By</FormLabel>
                        <FormControl>
                          <PremiumDropdown
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Select acknowledging staff…"
                            emptyMessage="No active staff found"
                            options={managers.map((m: any) => ({
                              value: m.id,
                              label: `${m.firstName} ${m.lastName}`,
                              sublabel: m.role || m.position || 'Staff',
                              badge: (m.role || m.position || '').toUpperCase().slice(0, 8),
                              badgeColor: 'bg-indigo-100 text-indigo-700',
                              icon: <span className="flex h-full w-full items-center justify-center text-xs font-bold text-indigo-700">{m.firstName?.[0]}{m.lastName?.[0]}</span>,
                            }))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>
            </SectionCard>

          </div>{/* end left column */}

          {/* ══════════════════════════════════════════════════════════════════
              RIGHT COLUMN  (span 5, sticky)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6 lg:self-start">

            {/* ── Stay Details dark card ── */}
            <div className="relative overflow-hidden rounded-[24px] bg-[#0b1730] text-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
              <div className="pointer-events-none absolute bottom-[-80px] left-1/3 h-48 w-48 rounded-full bg-blue-400/10 blur-3xl" />

              {/* Card header */}
              <div className="relative flex items-center gap-3 border-b border-white/10 px-6 py-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-400/15 text-indigo-200">
                  <Calendar className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <StepBadge n={5} />
                    <h2 className="text-sm font-bold text-white">Stay Details</h2>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">Dates, room type and room number</p>
                </div>
              </div>

              <div className="relative space-y-5 p-6">

                {/* Date pickers side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="checkIn" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Check-In</FormLabel>
                      <DatePicker
                        value={field.value}
                        onChange={(date) => { field.onChange(date); if (date && (!checkOut || checkOut <= date)) form.setValue('checkOut', addDays(date, 1), { shouldValidate: true }); }}
                        disabled={isWalkIn}
                        disabledDays={disableCheckInDate}
                        className="h-12 rounded-xl border-slate-700 bg-slate-800/70 text-white"
                      />
                      {isWalkIn && <p className="text-[10px] text-indigo-400 font-medium">Locked to business date</p>}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="checkOut" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Check-Out</FormLabel>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        disabledDays={disableCheckoutDate}
                        className="h-12 rounded-xl border-slate-700 bg-slate-800/70 text-white"
                      />
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Nights chip */}
                {nights > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm">
                    <span className="text-slate-400">{format(checkIn, 'dd MMM')} → {format(checkOut, 'dd MMM yyyy')}</span>
                    <span className="rounded-full bg-indigo-500/20 px-3 py-0.5 text-xs font-bold text-indigo-200">
                      {nights} {nights === 1 ? 'night' : 'nights'}
                    </span>
                  </div>
                )}

                {/* Room Type */}
                <FormField control={form.control} name="roomTypeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Room Type</FormLabel>
                    <FormControl>
                      <PremiumDropdown
                        value={field.value}
                        onChange={field.onChange}
                        dark
                        loading={loadingRoomTypes}
                        placeholder="Select room type…"
                        emptyMessage="No room types configured"
                        options={roomTypes.map((rt: any) => ({
                          value: rt.id,
                          label: rt.name,
                          sublabel: rt.baseRate > 0 ? `₦${Number(rt.baseRate).toLocaleString()} / night` : 'Rate not set',
                          icon: <BedDouble className="h-4 w-4" />,
                          badge: rt.currency || 'NGN',
                          badgeColor: 'bg-indigo-500/30 text-indigo-200',
                        }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Room number */}
                <FormField control={form.control} name="roomId" render={({ field }) => {
                  const isDisabled = !roomTypeId || !checkIn || !checkOut || loadingAvailableRooms;
                  const noRooms = !isDisabled && availableRooms.length === 0;
                  const placeholder = !checkIn || !checkOut || !roomTypeId
                    ? 'Complete dates & room type first'
                    : loadingAvailableRooms ? 'Searching availability…'
                    : noRooms ? 'No rooms available for these dates'
                    : 'Select an available room';
                  return (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Assign Room</FormLabel>
                      <FormControl>
                        <PremiumDropdown
                          value={field.value}
                          onChange={field.onChange}
                          dark
                          disabled={isDisabled || noRooms}
                          loading={loadingAvailableRooms}
                          placeholder={placeholder}
                          emptyMessage="No available rooms for selected dates"
                          options={availableRooms.map((room: any) => ({
                            value: room.id,
                            label: `Room ${formatRoomNumber(room.number)}`,
                            sublabel: room.floor ? `Floor ${room.floor}` : undefined,
                            badge: room.status === 'CLEAN' ? 'READY' : room.status,
                            badgeColor: room.status === 'CLEAN'
                              ? 'bg-emerald-500/25 text-emerald-300'
                              : 'bg-amber-500/25 text-amber-300',
                            icon: <BedDouble className="h-4 w-4" />,
                          }))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }} />

              </div>
            </div>

            {/* ── Pricing summary card ── */}
            <div className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Pricing Estimate</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Preview</span>
              </div>

              <div className="p-6">
                {selectedRoomType && formatter && nights > 0 ? (
                  <div className="space-y-3">
                    {/* Rate row */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{nights} × {formatter.format(nightlyRate)}/night</span>
                      <span className="font-semibold text-slate-700">
                        {isCorporateRate
                          ? <span className="mr-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">CORP</span>
                          : null}
                        {formatter.format(estimatedTotal)}
                      </span>
                    </div>

                    {/* Discount / comp row */}
                    {hasAdjustment && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-amber-700">
                          <Tag className="h-3.5 w-3.5" />
                          {adjustmentType.startsWith('DISCOUNT') ? 'Discount' : 'Complimentary'}
                          {adjustmentType === 'DISCOUNT_PERCENTAGE' && ` (${adjustmentValue}%)`}
                        </span>
                        <span className="font-semibold text-amber-700">−{formatter.format((discountDeduction + compDeduction) * nights)}</span>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="my-2 border-t border-slate-100" />

                    {/* Total */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-slate-400">Total estimated</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                          {formatter.format(hasAdjustment ? effectiveTotal : estimatedTotal)}
                        </p>
                        {hasAdjustment && (
                          <p className="mt-0.5 text-sm text-slate-400 line-through">{formatter.format(estimatedTotal)}</p>
                        )}
                      </div>
                      {nights > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">avg / night</p>
                          <p className="text-base font-semibold text-slate-700">
                            {formatter.format((hasAdjustment ? effectiveTotal : estimatedTotal) / nights)}
                          </p>
                        </div>
                      )}
                    </div>

                    {hasAdjustment && (
                      <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        <Info className="h-3.5 w-3.5 shrink-0" /> Pending Night Auditor approval
                      </div>
                    )}
                    {corporateAccountId && corporateAccountId !== 'none' && !corporateRate && (
                      <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        <Info className="h-3.5 w-3.5 shrink-0" /> No corporate rate configured for this room type — standard rate applied
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400">Server validates the final rate on save</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <BedDouble className="h-6 w-6" />
                    </span>
                    <p className="mt-3 text-sm font-medium text-slate-400">
                      {!selectedRoomType ? 'Select a room type to see pricing' : nights < 1 ? 'Set valid check-in and check-out dates' : 'Price preview will appear here'}
                    </p>
                  </div>
                )}

                {invalidDateRange && checkIn && checkOut && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-600">
                    <AlertCircle className="h-3.5 w-3.5" /> Check-out must be at least one night after check-in
                  </p>
                )}
              </div>
            </div>

            {/* ── Submit button ── */}
            <Button
              type="submit"
              disabled={createReservation.isPending}
              className="h-16 w-full rounded-[20px] bg-indigo-600 text-base font-bold text-white shadow-[0_8px_32px_rgba(79,70,229,0.35)] transition-all hover:bg-indigo-500 hover:shadow-[0_12px_40px_rgba(79,70,229,0.45)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              {createReservation.isPending ? (
                <><Loader2 className="mr-3 h-5 w-5 animate-spin" />Processing…</>
              ) : (
                <><Sparkles className="mr-3 h-5 w-5" />
                  {isWalkIn ? 'Process Walk-In' : 'Confirm Reservation'}
                  <ArrowRight className="ml-3 h-5 w-5" /></>
              )}
            </Button>

            <p className="text-center text-[11px] text-slate-400">
              This reservation is logged against today&apos;s business date and is available offline immediately after creation.
            </p>
          </div>{/* end right column */}

        </div>
      </form>
    </Form>
  );
}
