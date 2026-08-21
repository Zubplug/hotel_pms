'use client';

import { useState } from 'react';
import { ShieldAlert, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function RoleForm({
  role,
  permissionsDictionary,
  onClose,
  onSaved
}: {
  role?: any;
  permissionsDictionary: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isSystem = role?.isSystem;
  
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [selectedPerms, setSelectedPerms] = useState<string[]>(
    role?.permissions?.map((p: any) => p.permission.id) || []
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');

  const togglePermission = (permId: string) => {
    setSelectedPerms((prev) => 
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  const hasHighRiskChanges = () => {
    // Collect all permissions matching the selected IDs
    const allPerms = Object.values(permissionsDictionary).flat() as any[];
    const selected = allPerms.filter(p => selectedPerms.includes(p.id));
    return selected.some(p => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL');
  };

  const handleSaveInit = () => {
    if (!name) {
      toast.error('Role name is required');
      return;
    }

    if (hasHighRiskChanges()) {
      setShowConfirm(true);
    } else {
      setReason('Standard role update');
      submitData('Standard role update');
    }
  };

  const submitData = async (auditReason: string) => {
    setIsSubmitting(true);
    try {
      const url = role ? `/api/v1/roles/${role.id}` : '/api/v1/roles';
      const method = role ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          permissions: selectedPerms,
          reason: auditReason
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save role');
      }

      toast.success('Role saved successfully');
      onSaved();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRiskBadge = (level: string) => {
    if (level === 'CRITICAL') return <Badge variant="destructive" className="ml-2 bg-red-600 text-[10px] h-4">CRITICAL</Badge>;
    if (level === 'HIGH') return <Badge variant="destructive" className="ml-2 bg-orange-500 text-[10px] h-4">HIGH</Badge>;
    if (level === 'MEDIUM') return <Badge variant="secondary" className="ml-2 bg-yellow-500/20 text-yellow-700 text-[10px] h-4">MED</Badge>;
    return null;
  };

  if (showConfirm) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              High-Risk Permissions Selected
            </DialogTitle>
            <DialogDescription>
              This role includes permissions that can perform sensitive financial operations or administrative actions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 p-3 rounded-md text-red-800 text-sm">
              Please provide a reason for granting these permissions. This action will be permanently recorded in the audit log.
            </div>
            <div className="space-y-2">
              <Label>Reason for Change</Label>
              <Textarea 
                value={reason} 
                onChange={(e) => setReason(e.target.value)} 
                placeholder="e.g. Updated duty manager responsibilities"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Back</Button>
            <Button 
              variant="destructive" 
              onClick={() => submitData(reason)} 
              disabled={isSubmitting || reason.trim().length < 5}
            >
              {isSubmitting ? 'Saving...' : 'Confirm & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? (isSystem ? 'Edit System Baseline' : 'Edit Custom Role') : 'Create Custom Role'}</DialogTitle>
          <DialogDescription>
            {isSystem 
              ? 'Warning: You are modifying a LodgeCore system baseline. Customizing this may affect default features.' 
              : 'Configure the capabilities and permissions for this custom role.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                disabled={isSystem} // Cannot rename system roles
                placeholder="e.g. Senior Auditor"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                disabled={isSystem}
                placeholder="e.g. Internal audit team"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-4">Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(permissionsDictionary).map(([resource, perms]: [string, any]) => (
                <div key={resource} className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider">{resource}</h4>
                  <div className="space-y-3">
                    {perms.map((p: any) => (
                      <div key={p.id} className="flex items-start space-x-3">
                        <Checkbox 
                          id={p.id} 
                          checked={selectedPerms.includes(p.id)}
                          onCheckedChange={() => togglePermission(p.id)}
                        />
                        <div className="leading-none flex-1">
                          <Label htmlFor={p.id} className="text-sm font-medium cursor-pointer flex items-center">
                            {p.description || p.name}
                            {renderRiskBadge(p.riskLevel)}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">{p.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSaveInit} disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Save Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
