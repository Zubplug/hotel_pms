'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, CalendarPlus } from 'lucide-react';

export default function NewReservationPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 -mt-0.5">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Reservation</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Create a new booking for a guest.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            <CardTitle>Create Booking</CardTitle>
          </div>
          <CardDescription>
            The booking creation form will be implemented here. For now, this is a placeholder page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page prevents the UUID error when navigating to /reservations/new.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
