import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface BypassCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorized: (acknowledgedByStaffId: string, reason: string) => void;
  propertyId: string;
}

export function BypassCheckInModal({ isOpen, onClose, onAuthorized, propertyId }: BypassCheckInModalProps) {
  const { provider } = useLodgeCoreProvider();
  
  const [acknowledgedByStaffId, setAcknowledgedByStaffId] = useState('');
  const [reason, setReason] = useState('');
  
  const { data: staffRes, isLoading } = useQuery({
    queryKey: ['active-staff', propertyId],
    queryFn: () => provider.auth.getActiveStaff(),
    enabled: isOpen && !!propertyId,
  });

  const staffList = (staffRes as any)?.data || [];

  const handleConfirm = () => {
    if (!acknowledgedByStaffId || !reason.trim()) return;
    onAuthorized(acknowledgedByStaffId, reason);
    // Reset state for next time
    setAcknowledgedByStaffId('');
    setReason('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bypass Deposit Check</DialogTitle>
          <DialogDescription>
            This action will bypass the advance deposit requirement and check the guest in. A Night Audit exception will be created and MUST be verified.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Acknowledged By</label>
            <Select value={acknowledgedByStaffId} onValueChange={(val) => setAcknowledgedByStaffId(val || '')}>
              <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                <SelectValue placeholder={isLoading ? "Loading staff..." : "Select staff member"} />
              </SelectTrigger>
              <SelectContent className="z-[999]">
                {staffList.map((staff: any) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.firstName} {staff.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g. Approved by GM, Company to pay, etc."
              className="bg-slate-50 border-slate-200"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <DialogClose render={<Button variant="outline" type="button">Cancel</Button>} />
          <Button 
            onClick={handleConfirm} 
            disabled={!acknowledgedByStaffId || !reason.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm"
          >
            Authorize Bypass
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
