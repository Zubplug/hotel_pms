'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ChevronRight, User, CalendarDays, Box, Utensils, FileText } from 'lucide-react';
import { createFullEventBooking } from '@/lib/events/booking-actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const steps = [
  { id: 1, title: 'Client Info', icon: User },
  { id: 2, title: 'Schedule & Hall', icon: CalendarDays },
  { id: 3, title: 'Packages', icon: Box },
  { id: 4, title: 'Dietary & Custom', icon: Utensils },
  { id: 5, title: 'Summary', icon: FileText }
];

export function FullPackageWizard({ initialHalls, initialPackages }: { initialHalls: any[], initialPackages: any[] }) {
  const router = useRouter();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    contactName: '',
    contactPhone: '',
    expectedGuests: '',
    hallId: '',
    startTime: '',
    endTime: '',
    setupBufferMinutes: 60,
    teardownBufferMinutes: 60,
    repeatFrequency: 'NONE',
    repeatDaysOfWeek: [] as number[],
    repeatUntil: '',
    packageId: '',
    dietaryAllergies: '',
    dietaryVegan: '',
    specialRequests: ''
  });

  const currentStep = steps[currentStepIndex].id;

  const handleNext = () => setCurrentStepIndex(prev => Math.min(prev + 1, steps.length - 1));
  const handleBack = () => setCurrentStepIndex(prev => Math.max(prev - 1, 0));
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePackage = (pkgId: string) => {
    setFormData(prev => ({ ...prev, packageId: prev.packageId === pkgId ? '' : pkgId }));
  };

  const toggleDayOfWeek = (day: number) => {
    setFormData(prev => {
      const days = prev.repeatDaysOfWeek.includes(day)
        ? prev.repeatDaysOfWeek.filter(d => d !== day)
        : [...prev.repeatDaysOfWeek, day];
      return { ...prev, repeatDaysOfWeek: days };
    });
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      if (!formData.hallId) throw new Error("Please select a hall.");
      if (!formData.startTime || !formData.endTime) throw new Error("Please set start and end times.");
      if (!formData.packageId) throw new Error("Please select a banquet package.");
      
      let recurrenceRule = undefined;
      if (formData.repeatFrequency !== 'NONE') {
        if (!formData.repeatUntil) throw new Error("Please select an end date for the recurrence.");
        if (formData.repeatFrequency === 'WEEKLY' && formData.repeatDaysOfWeek.length === 0) {
          throw new Error("Please select at least one day of the week.");
        }
        recurrenceRule = {
          frequency: formData.repeatFrequency,
          daysOfWeek: formData.repeatFrequency === 'WEEKLY' ? formData.repeatDaysOfWeek : undefined,
          until: formData.repeatUntil
        };
      }

      const dietaryNotes = {
        allergies: formData.dietaryAllergies,
        veganVegetarianReqs: formData.dietaryVegan,
        specialRequests: formData.specialRequests
      };

      await createFullEventBooking({
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        expectedGuests: Number(formData.expectedGuests || 0),
        hallId: formData.hallId,
        startTime: new Date(formData.startTime),
        endTime: new Date(formData.endTime),
        setupBufferMinutes: Number(formData.setupBufferMinutes),
        teardownBufferMinutes: Number(formData.teardownBufferMinutes),
        packageIds: [formData.packageId],
        bookingType: 'FULL_PACKAGE',
        dietaryNotes,
        recurrenceRule
      });

      toast.success("Banquet Event successfully created!");
      router.push(`/fnb/events`);
    } catch (err: any) {
      toast.error(err.message || "An error occurred creating the booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStepIndex === index;
          const isCompleted = currentStepIndex > index;
          
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
          <CardTitle>{steps[currentStepIndex].title}</CardTitle>
          <CardDescription>Enter the details for this booking phase.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">
          
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

              {/* Recurrence Block */}
              <div className="pt-4 border-t space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="repeatFrequency">Repeat Booking?</Label>
                  <select 
                    id="repeatFrequency" 
                    name="repeatFrequency" 
                    value={formData.repeatFrequency} 
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="NONE">Does not repeat</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>

                {formData.repeatFrequency === 'WEEKLY' && (
                  <div className="space-y-2">
                    <Label>Days of the Week</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { val: 1, label: 'Mo' }, { val: 2, label: 'Tu' }, { val: 3, label: 'We' },
                        { val: 4, label: 'Th' }, { val: 5, label: 'Fr' }, { val: 6, label: 'Sa' },
                        { val: 0, label: 'Su' }
                      ].map(day => (
                        <button
                          key={day.val}
                          onClick={() => toggleDayOfWeek(day.val)}
                          type="button"
                          className={`w-10 h-10 rounded-full text-xs font-medium border flex items-center justify-center transition-colors ${
                            formData.repeatDaysOfWeek.includes(day.val) 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'bg-background hover:bg-muted'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {formData.repeatFrequency !== 'NONE' && (
                  <div className="space-y-2">
                    <Label htmlFor="repeatUntil">Repeat Until</Label>
                    <Input id="repeatUntil" name="repeatUntil" type="date" value={formData.repeatUntil} onChange={handleChange} />
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select the core Banquet Package for the event.</p>
              <div className="grid grid-cols-2 gap-4">
                {initialPackages.map(pkg => (
                  <div 
                    key={pkg.id} 
                    onClick={() => togglePackage(pkg.id)}
                    className={`p-4 border rounded cursor-pointer transition-colors ${formData.packageId === pkg.id ? 'border-primary bg-primary/5' : 'hover:border-slate-300'}`}
                  >
                    <div className="font-semibold text-sm">{pkg.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">NGN {Number(pkg.basePrice).toLocaleString()} / guest</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4 max-w-lg">
              <p className="text-sm text-muted-foreground">Log structured dietary requirements. These will be included in the BEO for the kitchen.</p>
              <div className="space-y-2">
                <Label htmlFor="dietaryAllergies">Severe Allergies (e.g. Nut, Shellfish)</Label>
                <Textarea id="dietaryAllergies" name="dietaryAllergies" value={formData.dietaryAllergies} onChange={handleChange} placeholder="List allergies and affected guest counts..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dietaryVegan">Vegetarian / Vegan Requests</Label>
                <Input id="dietaryVegan" name="dietaryVegan" value={formData.dietaryVegan} onChange={handleChange} placeholder="E.g. 15 Vegan, 5 Gluten-Free" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialRequests">Other Special/VIP Requests</Label>
                <Textarea id="specialRequests" name="specialRequests" value={formData.specialRequests} onChange={handleChange} placeholder="Specific pacing, VIP table service instructions..." />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Banquet Event Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border">
                <div><span className="text-muted-foreground">Client: </span> {formData.contactName || 'N/A'}</div>
                <div><span className="text-muted-foreground">Guests: </span> {formData.expectedGuests || 0}</div>
                <div><span className="text-muted-foreground">Hall: </span> {initialHalls.find(h => h.id === formData.hallId)?.name || 'N/A'}</div>
                <div><span className="text-muted-foreground">Package: </span> {initialPackages.find(p => p.id === formData.packageId)?.name || 'None selected'}</div>
                <div><span className="text-muted-foreground">Start: </span> {formData.startTime ? new Date(formData.startTime).toLocaleString() : 'N/A'}</div>
                <div><span className="text-muted-foreground">End: </span> {formData.endTime ? new Date(formData.endTime).toLocaleString() : 'N/A'}</div>
                {formData.repeatFrequency !== 'NONE' && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Recurrence: </span> 
                    {formData.repeatFrequency} until {formData.repeatUntil}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t p-4">
          <Button variant="outline" onClick={handleBack} disabled={currentStepIndex === 0 || isSubmitting}>
            Back
          </Button>
          {currentStepIndex < steps.length - 1 ? (
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
