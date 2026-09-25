'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, CalendarDays, Box, FileText } from 'lucide-react';
import { createFullEventBooking } from '@/lib/events/booking-actions';
import { BookingWizardShell } from './BookingWizardShell';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const steps = [
  { id: 1, title: 'Client', description: 'Who is hosting the booking', icon: User },
  { id: 2, title: 'Schedule', description: 'Hall, date and buffers', icon: CalendarDays },
  { id: 3, title: 'Equipment', description: 'Reserve available inventory', icon: Box },
  { id: 4, title: 'Review', description: 'Confirm before creating', icon: FileText }
];

export function HallOnlyWizard({ initialHalls, equipmentList, onCreated }: { initialHalls: any[], equipmentList: any[], onCreated?: () => void }) {
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
    equipmentRequests: {} as Record<string, number>
  });

  const currentStep = steps[currentStepIndex].id;
  const canContinue = currentStep === 1
    ? Boolean(formData.contactName.trim() && Number(formData.expectedGuests) > 0)
    : currentStep === 2
      ? Boolean(formData.hallId && formData.startTime && formData.endTime && new Date(formData.endTime) > new Date(formData.startTime) && (formData.repeatFrequency === 'NONE' || (formData.repeatUntil && (formData.repeatFrequency !== 'WEEKLY' || formData.repeatDaysOfWeek.length > 0))))
      : true;

  const handleNext = () => setCurrentStepIndex(prev => Math.min(prev + 1, steps.length - 1));
  const handleBack = () => setCurrentStepIndex(prev => Math.max(prev - 1, 0));
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleDayOfWeek = (day: number) => {
    setFormData(prev => {
      const days = prev.repeatDaysOfWeek.includes(day)
        ? prev.repeatDaysOfWeek.filter(d => d !== day)
        : [...prev.repeatDaysOfWeek, day];
      return { ...prev, repeatDaysOfWeek: days };
    });
  };

  const handleEquipmentChange = (eqId: string, delta: number) => {
    setFormData(prev => {
      const current = prev.equipmentRequests[eqId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, equipmentRequests: { ...prev.equipmentRequests, [eqId]: next } };
    });
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      if (!formData.hallId) throw new Error("Please select a hall.");
      if (!formData.startTime || !formData.endTime) throw new Error("Please set start and end times.");
      
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

      const eqReqs = Object.entries(formData.equipmentRequests)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({ equipmentId: id, quantity: qty }));

      await createFullEventBooking({
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        expectedGuests: Number(formData.expectedGuests || 0),
        hallId: formData.hallId,
        startTime: new Date(formData.startTime),
        endTime: new Date(formData.endTime),
        setupBufferMinutes: Number(formData.setupBufferMinutes),
        teardownBufferMinutes: Number(formData.teardownBufferMinutes),
        packageIds: [],
        bookingType: 'HALL_ONLY',
        equipmentRequests: eqReqs,
        recurrenceRule
      });

      toast.success("Hall Booking successfully created!");
      if (onCreated) onCreated(); else router.push(`/fnb/events/bookings`);
    } catch (err: any) {
      toast.error(err.message || "An error occurred creating the booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BookingWizardShell steps={steps} currentStepIndex={currentStepIndex} isSubmitting={isSubmitting} canContinue={canContinue} onBack={handleBack} onNext={handleNext} onSubmit={handleSubmit} summary={[
      { label: 'Client', value: formData.contactName || 'Not added' },
      { label: 'Guests', value: formData.expectedGuests || 'Not set' },
      { label: 'Hall', value: initialHalls.find(h => h.id === formData.hallId)?.name || 'Not selected' },
      { label: 'Equipment', value: `${Object.values(formData.equipmentRequests).filter(quantity => quantity > 0).length} item types` },
      { label: 'Start', value: formData.startTime ? new Date(formData.startTime).toLocaleString() : 'Not set' },
    ]}>
          
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
              <p className="text-sm text-muted-foreground">Select required equipment. Availability will be strictly checked against total inventory for your selected dates.</p>
              {equipmentList.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border rounded-lg text-slate-500">
                  No equipment configured in inventory.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {equipmentList.map(eq => {
                    const qty = formData.equipmentRequests[eq.id] || 0;
                    return (
                      <div key={eq.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-slate-300">
                        <div>
                          <div className="font-semibold text-sm">{eq.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">Stock: {eq.totalStock} | NGN {Number(eq.rentalPrice).toLocaleString()}/ea</div>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-md border">
                          <button onClick={() => handleEquipmentChange(eq.id, -1)} disabled={qty === 0} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 disabled:opacity-50 text-slate-600">-</button>
                          <span className="w-4 text-center text-sm font-medium">{qty}</span>
                          <button onClick={() => handleEquipmentChange(eq.id, 1)} disabled={qty >= eq.totalStock} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 disabled:opacity-50 text-slate-600">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Hall Only Booking Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border">
                <div><span className="text-muted-foreground">Client: </span> {formData.contactName || 'N/A'}</div>
                <div><span className="text-muted-foreground">Guests: </span> {formData.expectedGuests || 0}</div>
                <div><span className="text-muted-foreground">Hall: </span> {initialHalls.find(h => h.id === formData.hallId)?.name || 'N/A'}</div>
                <div><span className="text-muted-foreground">Type: </span> Hall Only</div>
                <div><span className="text-muted-foreground">Start: </span> {formData.startTime ? new Date(formData.startTime).toLocaleString() : 'N/A'}</div>
                <div><span className="text-muted-foreground">End: </span> {formData.endTime ? new Date(formData.endTime).toLocaleString() : 'N/A'}</div>
                {formData.repeatFrequency !== 'NONE' && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Recurrence: </span> 
                    {formData.repeatFrequency} until {formData.repeatUntil}
                  </div>
                )}
              </div>
              {Object.keys(formData.equipmentRequests).length > 0 && (
                <div className="text-sm bg-slate-50 p-4 rounded-lg border mt-2">
                  <h4 className="font-semibold mb-2">Requested Equipment:</h4>
                  <ul className="list-disc pl-5">
                    {Object.entries(formData.equipmentRequests).filter(([_, q]) => q > 0).map(([id, q]) => (
                      <li key={id}>{equipmentList.find(e => e.id === id)?.name}: {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
    </BookingWizardShell>
  );
}
