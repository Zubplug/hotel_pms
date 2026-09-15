'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, ChevronRight, User, CalendarDays, Box, FileText } from 'lucide-react';
import { createFullEventBooking } from '@/lib/events/booking-actions';
import { useRouter } from 'next/navigation';

const steps = [
  { id: 1, title: 'Client Info', icon: User },
  { id: 2, title: 'Schedule & Hall', icon: CalendarDays },
  { id: 3, title: 'Packages', icon: Box },
  { id: 4, title: 'Summary', icon: FileText }
];

export function EventWizard({ initialHalls, initialPackages }: { initialHalls: any[], initialPackages: any[] }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    contactName: '',
    contactPhone: '',
    expectedGuests: '',
    hallId: '',
    startTime: '',
    endTime: '',
    setupBufferMinutes: 60,
    teardownBufferMinutes: 60,
    packageIds: [] as string[]
  });

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePackage = (pkgId: string) => {
    setFormData(prev => ({
      ...prev,
      packageIds: prev.packageIds.includes(pkgId) 
        ? prev.packageIds.filter(id => id !== pkgId)
        : [...prev.packageIds, pkgId]
    }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      if (!formData.hallId) throw new Error("Please select a hall.");
      if (!formData.startTime || !formData.endTime) throw new Error("Please set start and end times.");
      
      const newEvent = await createFullEventBooking({
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        expectedGuests: Number(formData.expectedGuests || 0),
        hallId: formData.hallId,
        startTime: new Date(formData.startTime),
        endTime: new Date(formData.endTime),
        setupBufferMinutes: Number(formData.setupBufferMinutes),
        teardownBufferMinutes: Number(formData.teardownBufferMinutes),
        packageIds: formData.packageIds
      });

      alert("Event successfully created!");
      router.push(`/fnb/events/bookings`);
    } catch (err: any) {
      setError(err.message || "An error occurred creating the booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          
          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white transition-colors
                ${isActive ? 'border-primary text-primary' : isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-400'}`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs font-medium mt-2 ${isActive || isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep - 1].title}</CardTitle>
          <CardDescription>Enter the details for this booking phase.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">
          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded text-sm mb-4">
              {error}
            </div>
          )}
          
          {currentStep === 1 && (
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="contactName">Primary Contact Name</Label>
                <Input id="contactName" name="contactName" value={formData.contactName} onChange={handleChange} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone Number</Label>
                <Input id="contactPhone" name="contactPhone" value={formData.contactPhone} onChange={handleChange} placeholder="+1 234 567 890" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedGuests">Expected Guests</Label>
                <Input id="expectedGuests" name="expectedGuests" type="number" value={formData.expectedGuests} onChange={handleChange} placeholder="150" />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="hallId">Select Hall</Label>
                <select 
                  id="hallId" 
                  name="hallId" 
                  value={formData.hallId} 
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-- Select a Hall --</option>
                  {initialHalls.map(h => (
                    <option key={h.id} value={h.id}>{h.name} (Cap: {h.capacity})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input id="startTime" name="startTime" type="datetime-local" value={formData.startTime} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input id="endTime" name="endTime" type="datetime-local" value={formData.endTime} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="setupBufferMinutes">Setup Time (mins)</Label>
                  <Input id="setupBufferMinutes" name="setupBufferMinutes" type="number" value={formData.setupBufferMinutes} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teardownBufferMinutes">Teardown Time (mins)</Label>
                  <Input id="teardownBufferMinutes" name="teardownBufferMinutes" type="number" value={formData.teardownBufferMinutes} onChange={handleChange} />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select Banquet & Equipment Packages</p>
              <div className="grid grid-cols-2 gap-4">
                {initialPackages.map(pkg => (
                  <div 
                    key={pkg.id} 
                    onClick={() => togglePackage(pkg.id)}
                    className={`p-4 border rounded cursor-pointer transition-colors ${formData.packageIds.includes(pkg.id) ? 'border-primary bg-primary/5' : 'hover:border-slate-300'}`}
                  >
                    <div className="font-semibold text-sm">{pkg.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">NGN {Number(pkg.basePrice).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Booking Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border">
                <div>
                  <span className="text-muted-foreground">Client: </span> {formData.contactName || 'N/A'}
                </div>
                <div>
                  <span className="text-muted-foreground">Guests: </span> {formData.expectedGuests || 0}
                </div>
                <div>
                  <span className="text-muted-foreground">Hall: </span> {initialHalls.find(h => h.id === formData.hallId)?.name || 'N/A'}
                </div>
                <div>
                  <span className="text-muted-foreground">Packages: </span> {formData.packageIds.length} selected
                </div>
                <div>
                  <span className="text-muted-foreground">Start: </span> {formData.startTime ? new Date(formData.startTime).toLocaleString() : 'N/A'}
                </div>
                <div>
                  <span className="text-muted-foreground">End: </span> {formData.endTime ? new Date(formData.endTime).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t p-4">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1 || isSubmitting}>
            Back
          </Button>
          {currentStep < steps.length ? (
            <Button onClick={handleNext}>Next Step <ChevronRight className="w-4 h-4 ml-2" /></Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Confirm & Schedule'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
