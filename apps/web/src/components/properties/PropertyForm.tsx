'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, MapPin, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface PropertyFormValues {
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
}

interface PropertyFormProps {
  defaultValues?: Partial<PropertyFormValues>;
  onSubmit: (data: PropertyFormValues) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
  darkTheme?: boolean;
}

export function PropertyForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting,
  mode = 'create',
  darkTheme = false,
}: PropertyFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={`mx-auto max-w-4xl space-y-6 ${darkTheme ? 'text-slate-100' : ''}`}>
      <Card className={`overflow-hidden shadow-sm ${darkTheme ? 'border-white/10 bg-white/[0.035]' : 'border-muted/60'}`}>
        <CardHeader className={`border-b px-6 py-5 ${darkTheme ? 'border-white/10 bg-white/[0.03]' : 'bg-muted/20'}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className={darkTheme ? 'text-white' : undefined}>Property identity</CardTitle>
              <CardDescription className={`mt-1 ${darkTheme ? 'text-slate-400' : ''}`}>Give this property a clear name and recognizable code.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label className={darkTheme ? 'text-slate-300' : ''} htmlFor="name">Property Name <span className="text-destructive">*</span></Label>
            <Input id="name" className={`h-11 ${darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''}`} placeholder="e.g. Grand Lagos Hotel" {...register('name', { required: 'Name is required' })} />
            {errors.name && <p className="text-xs text-rose-300">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className={darkTheme ? 'text-slate-300' : ''} htmlFor="code">Property Code <span className="text-destructive">*</span></Label>
            <Input id="code" className={`h-11 uppercase ${darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''}`} placeholder="e.g. LGS-01" {...register('code', { required: 'Code is required' })} />
            {errors.code && <p className="text-xs text-rose-300">{errors.code.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className={`overflow-hidden shadow-sm ${darkTheme ? 'border-white/10 bg-white/[0.035]' : 'border-muted/60'}`}>
        <CardHeader className={`border-b px-6 py-5 ${darkTheme ? 'border-white/10 bg-white/[0.03]' : 'bg-muted/20'}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className={darkTheme ? 'text-white' : undefined}>Location & contact</CardTitle>
              <CardDescription className={`mt-1 ${darkTheme ? 'text-slate-400' : ''}`}>Help staff and guests identify and reach this property.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label className={darkTheme ? 'text-slate-300' : ''} htmlFor="address">Address <span className="text-destructive">*</span></Label>
            <Input id="address" className={`h-11 ${darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''}`} placeholder="Street address" {...register('address', { required: 'Address is required' })} />
            {errors.address && <p className="text-xs text-rose-300">{errors.address.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className={darkTheme ? 'text-slate-300' : ''} htmlFor="city">City <span className="text-destructive">*</span></Label>
            <Input id="city" className={`h-11 ${darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''}`} placeholder="e.g. Lagos" {...register('city', { required: 'City is required' })} />
            {errors.city && <p className="text-xs text-rose-300">{errors.city.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className={darkTheme ? 'text-slate-300' : ''} htmlFor="country">Country <span className="text-destructive">*</span></Label>
            <Input id="country" className={`h-11 ${darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''}`} placeholder="e.g. Nigeria" {...register('country', { required: 'Country is required' })} />
            {errors.country && <p className="text-xs text-rose-300">{errors.country.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className={darkTheme ? 'text-slate-300' : ''} htmlFor="phone">Phone</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="phone" type="tel" className={`h-11 pl-9 ${darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''}`} placeholder="+234 800 000 0000" {...register('phone')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className={darkTheme ? 'text-slate-300' : ''} htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" className={`h-11 pl-9 ${darkTheme ? 'border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-600' : ''}`} placeholder="property@hotel.com" {...register('email')} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={`flex flex-col-reverse gap-3 rounded-2xl border p-4 sm:flex-row sm:justify-end ${darkTheme ? 'border-white/10 bg-white/[0.03]' : 'bg-muted/20'}`}>
        <Button type="button" variant="outline" className={darkTheme ? 'border-white/10 bg-transparent text-slate-300 hover:bg-white/10' : ''} onClick={onCancel ?? (() => window.history.back())}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className={darkTheme ? 'bg-emerald-300 text-slate-950 hover:bg-emerald-200' : ''}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Property' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
