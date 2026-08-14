'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface PropertyFormValues {
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  organizationId: string;
}

interface PropertyFormProps {
  defaultValues?: Partial<PropertyFormValues>;
  onSubmit: (data: PropertyFormValues) => Promise<void>;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
  organizationId: string;
}

export function PropertyForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode = 'create',
  organizationId,
}: PropertyFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    defaultValues: {
      organizationId,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>General details about the property.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Property Name <span className="text-destructive">*</span></Label>
            <Input id="name" placeholder="e.g. Grand Lagos Hotel" {...register('name', { required: 'Name is required' })} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="code">Property Code <span className="text-destructive">*</span></Label>
            <Input id="code" placeholder="e.g. LGS-01" {...register('code', { required: 'Code is required' })} />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="address">Address <span className="text-destructive">*</span></Label>
            <Input id="address" placeholder="Street address" {...register('address', { required: 'Address is required' })} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
            <Input id="city" placeholder="e.g. Lagos" {...register('city', { required: 'City is required' })} />
            {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
            <Input id="country" placeholder="e.g. Nigeria" {...register('country', { required: 'Country is required' })} />
            {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" placeholder="+234 800 000 0000" {...register('phone')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="property@hotel.com" {...register('email')} />
          </div>

          <input type="hidden" {...register('organizationId')} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Property' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
