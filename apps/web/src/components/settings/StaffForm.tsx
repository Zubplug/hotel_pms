'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface StaffFormProps {
  staff?: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export function StaffForm({ staff, onClose, onSaved }: StaffFormProps) {
  const isEditing = !!staff;
  const [isSaving, setIsSaving] = useState(false);
  const [outlets, setOutlets] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    firstName: staff?.firstName || '',
    lastName: staff?.lastName || '',
    email: staff?.email || '',
    department: staff?.department || '',
    position: staff?.position || '',
    posPin: '',
    isActive: staff?.isActive ?? true,
    posOutlets: staff?.posOutletAccess?.map((a: any) => a.outlet.id) || [] as string[],
  });

  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        const res = await fetch('/api/v1/pos/outlets');
        if (res.ok) {
          const data = await res.json();
          setOutlets(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load outlets', error);
      }
    };
    fetchOutlets();
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOutletToggle = (outletId: string) => {
    setFormData((prev) => {
      const isSelected = prev.posOutlets.includes(outletId);
      if (isSelected) {
        return { ...prev, posOutlets: prev.posOutlets.filter((id: string) => id !== outletId) };
      } else {
        return { ...prev, posOutlets: [...prev.posOutlets, outletId] };
      }
    });
  };

  const handleSubmit = async () => {
    if (!formData.firstName || !formData.lastName) {
      toast.error('Name is required');
      return;
    }
    if (!formData.email) {
      toast.error('Email is required');
      return;
    }
    
    if (formData.posPin && formData.posPin.length !== 4) {
      toast.error('POS PIN must be exactly 4 digits');
      return;
    }

    setIsSaving(true);
    try {
      const url = isEditing ? `/api/v1/staff/${staff.id}` : '/api/v1/staff';
      const method = isEditing ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save staff member');
      }

      toast.success(`Staff member ${isEditing ? 'updated' : 'created'} successfully.`);
      onSaved();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. name@lodgecore.com"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                placeholder="e.g. Food & Beverage"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                placeholder="e.g. Waiter"
                value={formData.position}
                onChange={(e) => handleChange('position', e.target.value)}
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-2">
            <h4 className="font-medium mb-3">POS Settings</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="posPin">POS Access PIN</Label>
                <Input
                  id="posPin"
                  type="password"
                  placeholder={isEditing && staff?.posPinHash ? '•••• (Enter new to override)' : 'Enter 4-digit PIN'}
                  maxLength={4}
                  value={formData.posPin}
                  onChange={(e) => handleChange('posPin', e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-muted-foreground">
                  4 digits. Staff will use this to authenticate on the POS terminal. 
                  {isEditing && ' Existing PINs cannot be viewed, only overridden.'}
                </p>
              </div>

              <div className="space-y-3">
                <Label>Allowed Outlets</Label>
                {outlets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No POS outlets configured yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {outlets.map((outlet) => (
                      <div key={outlet.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`outlet-${outlet.id}`}
                          checked={formData.posOutlets.includes(outlet.id)}
                          onCheckedChange={() => handleOutletToggle(outlet.id)}
                        />
                        <Label htmlFor={`outlet-${outlet.id}`} className="font-normal">
                          {outlet.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="border-t pt-4 mt-2 flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Allow this staff member to log in.
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange('isActive', checked)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Staff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
