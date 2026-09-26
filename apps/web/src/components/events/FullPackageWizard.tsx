'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, CalendarDays, Box, CheckSquare, FileText } from 'lucide-react';
import { createFullEventBooking } from '@/lib/events/booking-actions';
import { BookingWizardShell } from './BookingWizardShell';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const steps = [
  { id: 1, title: 'Client', description: 'Who is hosting', icon: User },
  { id: 2, title: 'Schedule', description: 'Dates & Times', icon: CalendarDays },
  { id: 3, title: 'Package', description: 'Package & Extras', icon: Box },
  { id: 4, title: 'Options', description: 'Equipment & Notes', icon: CheckSquare },
  { id: 5, title: 'Review', description: 'Confirm booking', icon: FileText }
];

export function FullPackageWizard({ initialHalls, equipmentList, packageList, guests, corporateAccounts, taxRate = 0, onCreated }: { initialHalls: any[], equipmentList: any[], packageList: any[], guests: any[], corporateAccounts: any[], taxRate?: number, onCreated?: () => void }) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    clientType: 'INDIVIDUAL' as 'INDIVIDUAL' | 'CORPORATE',
    isExisting: false,
    clientId: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    companyName: '',
    contactPerson: '',
    contactName: '',
    contactPhone: '',
    expectedGuests: '',
    hallId: '',
    startTime: '',
    endTime: '',
    setupBufferMinutes: 120,
    teardownBufferMinutes: 120,
    packageId: '',
    dietaryNotes: '',
    equipmentRequests: {} as Record<string, number>,
    discountAmount: 0
  });

  const currentStep = steps[currentStepIndex].id;
  const canContinue = currentStep === 1
    ? Boolean(Number(formData.expectedGuests) > 0 && (!formData.isExisting || formData.clientId) && (formData.isExisting || (formData.clientType === 'INDIVIDUAL' ? formData.firstName.trim() && formData.lastName.trim() : formData.companyName.trim())))
    : currentStep === 2
      ? Boolean(formData.hallId && formData.startTime && formData.endTime && new Date(formData.endTime) > new Date(formData.startTime))
      : currentStep === 3
        ? Boolean(formData.packageId)
        : true;

  const handleNext = () => setCurrentStepIndex(prev => Math.min(prev + 1, steps.length - 1));
  const handleBack = () => setCurrentStepIndex(prev => Math.max(prev - 1, 0));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.checked });
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
      if (!formData.packageId) throw new Error("Please select a package.");
      if (!formData.startTime || !formData.endTime) throw new Error("Please set start and end times.");

      const eqReqs = Object.entries(formData.equipmentRequests)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({ equipmentId: id, quantity: qty }));

      const hallRate = Number(initialHalls.find(h => h.id === formData.hallId)?.rate || 0);

      await createFullEventBooking({
        clientType: formData.clientType,
        isExisting: formData.isExisting,
        clientId: formData.clientId || undefined,
        clientDetails: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          companyName: formData.companyName,
          contactPerson: formData.contactPerson,
          contactEmail: formData.email,
          contactPhone: formData.phone,
        },
        contactName: formData.clientType === 'INDIVIDUAL' ? (formData.isExisting ? `${guests.find((guest: any) => guest.id === formData.clientId)?.firstName || ''} ${guests.find((guest: any) => guest.id === formData.clientId)?.lastName || ''}`.trim() : `${formData.firstName} ${formData.lastName}`.trim()) : (formData.isExisting ? corporateAccounts.find((account: any) => account.id === formData.clientId)?.name || '' : formData.contactPerson || formData.companyName),
        contactPhone: formData.clientType === 'INDIVIDUAL' ? formData.phone : formData.phone,
        expectedGuests: Number(formData.expectedGuests || 0),
        hallId: formData.hallId,
        startTime: new Date(formData.startTime),
        endTime: new Date(formData.endTime),
        setupBufferMinutes: Number(formData.setupBufferMinutes),
        teardownBufferMinutes: Number(formData.teardownBufferMinutes),
        packageIds: [formData.packageId],
        bookingType: 'FULL_PACKAGE',
        equipmentRequests: eqReqs,
        dietaryNotes: formData.dietaryNotes ? { notes: formData.dietaryNotes } : undefined,
        hallRate: hallRate,
        discountAmount: Number(formData.discountAmount || 0)
      });

      toast.success("Full Package Booking successfully created!");
      if (onCreated) onCreated(); else router.push(`/fnb/events/bookings`);
    } catch (err: any) {
      toast.error(err.message || "An error occurred creating the booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedHall = initialHalls.find(h => h.id === formData.hallId);
  const selectedPackage = packageList.find(p => p.id === formData.packageId);
  const hallGross = selectedHall ? Number(selectedHall.rate || 0) : 0;

  // Package calculation (per person)
  const guestsCount = Number(formData.expectedGuests || 0);
  const packageGross = selectedPackage ? Number(selectedPackage.basePrice || 0) : 0;
  const equipmentGross = Object.entries(formData.equipmentRequests).reduce((sum, [id, quantity]) => {
    const equipment = equipmentList.find(item => item.id === id);
    return sum + (equipment ? Number(equipment.rentalPrice || 0) * quantity : 0);
  }, 0);

  const totalGross = hallGross + packageGross + equipmentGross;
  const discount = Number(formData.discountAmount || 0);
  const subTotal = Math.max(0, totalGross - discount);
  const taxAmt = subTotal * taxRate;
  const netTotal = subTotal + taxAmt;

  return (
    <BookingWizardShell steps={steps} currentStepIndex={currentStepIndex} isSubmitting={isSubmitting} canContinue={canContinue} onBack={handleBack} onNext={handleNext} onSubmit={handleSubmit} summary={[
      { label: 'Client', value: formData.clientType === 'INDIVIDUAL' ? (formData.isExisting ? `${guests.find((guest: any) => guest.id === formData.clientId)?.firstName || ''} ${guests.find((guest: any) => guest.id === formData.clientId)?.lastName || ''}`.trim() : `${formData.firstName} ${formData.lastName}`.trim()) || 'Not added' : (formData.isExisting ? corporateAccounts.find((account: any) => account.id === formData.clientId)?.name || 'Not added' : formData.companyName || 'Not added') },
      { label: 'Guests', value: formData.expectedGuests || 'Not set' },
      { label: 'Hall', value: initialHalls.find(h => h.id === formData.hallId)?.name || 'Not selected' },
      { label: 'Package', value: packageList.find(p => p.id === formData.packageId)?.name || 'Not selected' },
      { label: 'Start', value: formData.startTime ? new Date(formData.startTime).toLocaleString() : 'Not set' },
    ]}>

          {currentStep === 1 && (
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                 <Label htmlFor="clientType">Booking Client Type</Label>
                 <select
                   id="clientType"
                   name="clientType"
                   value={formData.clientType}
                   onChange={handleChange}
                   className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                 >
                   <option value="INDIVIDUAL">Individual</option>
                   <option value="CORPORATE">Corporate</option>
                 </select>
              </div>

              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isExisting" name="isExisting" checked={formData.isExisting} onChange={handleCheckboxChange} />
                <Label htmlFor="isExisting">Existing Client?</Label>
              </div>

              {formData.isExisting ? (
                 <div className="space-y-2">
                    <Label htmlFor="clientId">Existing {formData.clientType === 'INDIVIDUAL' ? 'guest' : 'corporate account'}</Label>
                    <select id="clientId" name="clientId" value={formData.clientId} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">-- Select --</option>
                      {(formData.clientType === 'INDIVIDUAL' ? guests : corporateAccounts).map((client: any) => <option key={client.id} value={client.id}>{formData.clientType === 'INDIVIDUAL' ? `${client.firstName} ${client.lastName}${client.email ? ` (${client.email})` : ''}` : `${client.name} (${client.code})`}</option>)}
                    </select>
                 </div>
              ) : (
                formData.clientType === 'INDIVIDUAL' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" value={formData.email} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPerson">Contact Person</Label>
                      <Input id="contactPerson" name="contactPerson" value={formData.contactPerson} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" value={formData.email} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
                    </div>
                  </>
                )
              )}

              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="expectedGuests">Expected Guests</Label>
                  <Input id="expectedGuests" name="expectedGuests" type="number" value={formData.expectedGuests} onChange={handleChange} placeholder="150" />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="hallId">Select Primary Hall</Label>
                <select
                  id="hallId"
                  name="hallId"
                  value={formData.hallId}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-- Select a Hall --</option>
                  {initialHalls.map(h => (
                    <option key={h.id} value={h.id}>{h.name} (Cap: {h.capacity}) - NGN {Number(h.rate || 0).toLocaleString()}</option>
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
              <div className="grid grid-cols-1 gap-4">
                {packageList.map(p => (
                  <label key={p.id} className={`flex items-start p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${formData.packageId === p.id ? 'border-primary ring-1 ring-primary bg-slate-50' : ''}`}>
                    <input type="radio" name="packageId" value={p.id} checked={formData.packageId === p.id} onChange={handleChange} className="mt-1" />
                    <div className="ml-3">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">{p.description}</div>
                      <div className="mt-2 text-sm font-medium">NGN {Number(p.basePrice).toLocaleString()} package</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <Label>Equipment Requests</Label>
                {equipmentList.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 border rounded-lg text-slate-500 text-sm">
                    No equipment available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {equipmentList.map(eq => {
                      const qty = formData.equipmentRequests[eq.id] || 0;
                      return (
                        <div key={eq.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium text-sm">{eq.name}</div>
                            <div className="text-xs text-muted-foreground">NGN {Number(eq.rentalPrice).toLocaleString()}/ea</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEquipmentChange(eq.id, -1)} disabled={qty === 0} className="w-8 h-8 rounded-md hover:bg-slate-100 border text-slate-600">-</button>
                            <span className="w-4 text-center text-sm font-medium">{qty}</span>
                            <button onClick={() => handleEquipmentChange(eq.id, 1)} disabled={qty >= eq.totalStock} className="w-8 h-8 rounded-md hover:bg-slate-100 border text-slate-600">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dietaryNotes">Dietary Restrictions & Notes</Label>
                <textarea
                  id="dietaryNotes"
                  name="dietaryNotes"
                  value={formData.dietaryNotes}
                  onChange={handleChange as any}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="E.g., 5 Vegetarian, 2 Gluten-free"
                />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Full Package Booking Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border">
                <div><span className="text-muted-foreground">Client: </span> {formData.clientType === 'INDIVIDUAL' ? (formData.isExisting ? `${guests.find((guest: any) => guest.id === formData.clientId)?.firstName || ''} ${guests.find((guest: any) => guest.id === formData.clientId)?.lastName || ''}`.trim() : `${formData.firstName} ${formData.lastName}`.trim()) : (formData.isExisting ? corporateAccounts.find((account: any) => account.id === formData.clientId)?.name || 'N/A' : formData.companyName || 'N/A')}</div>
                <div><span className="text-muted-foreground">Guests: </span> {formData.expectedGuests || 0}</div>
                <div><span className="text-muted-foreground">Hall: </span> {selectedHall?.name || 'N/A'}</div>
                <div><span className="text-muted-foreground">Package: </span> {selectedPackage?.name || 'N/A'}</div>
                <div><span className="text-muted-foreground">Start: </span> {formData.startTime ? new Date(formData.startTime).toLocaleString() : 'N/A'}</div>
                <div><span className="text-muted-foreground">End: </span> {formData.endTime ? new Date(formData.endTime).toLocaleString() : 'N/A'}</div>
              </div>

              <div className="space-y-4 mt-6 max-w-md">
                 <h4 className="font-semibold">Financial Breakdown</h4>
                 <div className="space-y-2">
                    <Label htmlFor="discountAmount">Discount Amount (NGN)</Label>
                    <Input id="discountAmount" name="discountAmount" type="number" value={formData.discountAmount} onChange={handleChange} />
                 </div>

                 <div className="bg-slate-100 p-4 rounded-md space-y-2 text-sm border">
                    <div className="flex justify-between text-slate-600 text-xs">
                       <span>Hall Fee:</span>
                       <span>NGN {hallGross.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-xs">
                       <span>Package Fee ({guestsCount} guests):</span>
                       <span>NGN {packageGross.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200">
                       <span>Gross Rate:</span>
                       <span className="font-medium">NGN {totalGross.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                       <span>Discount:</span>
                       <span>- NGN {discount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-2">
                       <span>Sub Total:</span>
                       <span className="font-medium">NGN {subTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                       <span>Tax:</span>
                       <span>+ NGN {taxAmt.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-2 font-bold text-base">
                       <span>Net Total:</span>
                       <span>NGN {netTotal.toLocaleString()}</span>
                    </div>
                 </div>
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
