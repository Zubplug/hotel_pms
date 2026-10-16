'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRoomTypeSchema, CreateRoomTypeInput } from '@hotel-pms/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface RoomTypeFormProps {
  initialData?: any;
  onSaved?: () => void;
  onCancel?: () => void;
  darkTheme?: boolean;
}

export function RoomTypeForm({ initialData, onSaved, onCancel, darkTheme = false }: RoomTypeFormProps) {
  const { propertyId } = useProperty();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [reachEnabled, setReachEnabled] = React.useState(false);
  React.useEffect(() => { if (!propertyId) return; void fetch(`/api/v1/referrals/program?propertyId=${propertyId}`).then((response) => response.ok ? response.json() : null).then((payload) => setReachEnabled(Boolean(payload?.data?.reachEnabled))); }, [propertyId]);

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
      referralEnabled: initialData?.referralEnabled ?? true,
      referralCommissionMode: initialData?.referralCommissionMode || 'PERCENT',
      referralCommissionValue: initialData?.referralCommissionValue ? Number(initialData.referralCommissionValue) : 0,
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
      if (onSaved) onSaved();
      else {
        router.push('/room-types');
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className={`max-w-2xl space-y-6 ${darkTheme ? 'text-slate-100' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input className={darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''} placeholder="e.g. Standard Room" {...field} />
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
                  <Input className={darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''} placeholder="e.g. STD" {...field} />
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
                  <AmountInput value={field.value} onValueChange={value => field.onChange(value ? parseFloat(value) : 0)} />
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
                  <Input className={darkTheme ? 'border-white/10 bg-slate-950 text-slate-100' : ''} {...field} />
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
                  <Input className={darkTheme ? 'border-white/10 bg-slate-950 text-slate-100' : ''} type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
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
                  <Input className={darkTheme ? 'border-white/10 bg-slate-950 text-slate-100' : ''} type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
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
                  <Input className={darkTheme ? 'border-white/10 bg-slate-950 text-slate-100' : ''} type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
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
                  <Input className={darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''} placeholder="e.g. 1 King Bed" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {reachEnabled && <div className={darkTheme ? 'rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4' : 'rounded-xl border p-4'}>
          <div className="mb-3"><p className="font-semibold">LodgeCore Reach referral rule</p><p className="text-xs text-muted-foreground">Visible only when this property has the active Reach add-on. This room type can override the campaign commission.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField control={form.control as any} name="referralEnabled" render={({ field }) => <FormItem className="flex items-center gap-3 space-y-0 md:pt-8"><FormControl><input type="checkbox" checked={field.value} onChange={field.onChange} /></FormControl><FormLabel>Eligible for referrals</FormLabel></FormItem>} />
            <FormField control={form.control as any} name="referralCommissionMode" render={({ field }) => <FormItem><FormLabel>Commission type</FormLabel><FormControl><select className={darkTheme ? 'h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-slate-100' : 'h-10 w-full rounded-md border px-3 text-sm'} value={field.value} onChange={field.onChange}><option value="PERCENT">Percentage of eligible revenue</option><option value="AMOUNT">Fixed amount per night</option></select></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control as any} name="referralCommissionValue" render={({ field }) => <FormItem><FormLabel>{form.watch('referralCommissionMode') === 'AMOUNT' ? 'Amount per night' : 'Percentage'} </FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} onChange={(event) => field.onChange(Number(event.target.value || 0))} /></FormControl><FormMessage /></FormItem>} />
          </div>
        </div>}

        <FormField
          control={form.control as any}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={darkTheme ? 'text-slate-300' : ''}>Description</FormLabel>
              <FormControl>
                  <Input className={darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''} placeholder="Brief description of the room type" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" className={darkTheme ? 'border-white/10 bg-transparent text-slate-300 hover:bg-white/10' : ''} onClick={onCancel ?? (() => router.back())}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className={darkTheme ? 'bg-emerald-300 text-slate-950 hover:bg-emerald-200' : ''}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Room Type
          </Button>
        </div>
      </form>
    </Form>
  );
}
