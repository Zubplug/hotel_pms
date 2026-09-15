'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { createEventLead } from '@/lib/events/crm-add-lead';
import { toast } from 'sonner';

export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    contactName: '',
    companyName: '',
    eventType: '',
    expectedGuests: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      if (!formData.contactName) throw new Error("Contact name is required");

      await createEventLead({
        contactName: formData.contactName,
        companyName: formData.companyName,
        eventType: formData.eventType,
        expectedGuests: Number(formData.expectedGuests || 0)
      });

      toast.success("Lead created successfully");
      setOpen(false);
      setFormData({ contactName: '', companyName: '', eventType: '', expectedGuests: '' });
    } catch (err: any) {
      toast.error(err.message || "Failed to create lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" /> Add Lead</Button>} />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Enter the details for the new event inquiry.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact Name</Label>
            <Input id="contactName" name="contactName" value={formData.contactName} onChange={handleChange} placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Company (Optional)</Label>
            <Input id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Acme Corp" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type</Label>
              <Input id="eventType" name="eventType" value={formData.eventType} onChange={handleChange} placeholder="Wedding" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedGuests">Pax</Label>
              <Input id="expectedGuests" name="expectedGuests" type="number" value={formData.expectedGuests} onChange={handleChange} placeholder="150" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
