import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Trash, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { ManagerOverrideModal } from './ManagerOverrideModal';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export default function FiredItemActionsModal({
  isOpen,
  onClose,
  item,
  orderId,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  orderId: string;
  onSuccess: (order: any) => void;
}) {
  const { provider } = useLodgeCoreProvider();
  
  // Determine if this item is a bar item (no manager override needed)
  const itemStation = (item?.station || '').toUpperCase();
  const isBarItem = itemStation === 'BAR';

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Void State
  const [inventoryAction, setInventoryAction] = useState<'RESTOCK' | 'WASTE'>('RESTOCK');
  
  // Override State
  const [showOverride, setShowOverride] = useState(false);
  const [pendingAction, setPendingAction] = useState<'VOID' | null>(null);
  
  if (!item) return null;
  
  const handleVoid = async (managerId?: string, managerPin?: string, reason?: string) => {
    setIsSubmitting(true);
    try {
      const payload = {
        action: 'VOID',
        orderId,
        originalOrderItemId: item.id,
        productId: item.productId,
        productName: item.productName ?? item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? item.price,
        reason: reason || 'Customer changed mind',
        inventoryAction,
        managerId,
        managerPin,
        station: item?.station || '',   // sent so backend can skip approval for BAR
      };
      
      const result = await provider.approvals.requestItemModification(payload);
      
      if (result.requiresApproval) {
        setPendingAction('VOID');
        setShowOverride(true);
        setIsSubmitting(false);
        return;
      }
      
      if (result.success) {
        toast.success('Item voided successfully');
        onSuccess(result.order);
        onClose();
      } else {
        toast.error(result.error || 'Failed to void item');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverrideAuthorized = (managerId: string, managerPin: string, reason: string) => {
    setShowOverride(false);
    if (pendingAction === 'VOID') {
      handleVoid(managerId, managerPin, reason);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Void Fired Item</DialogTitle>
        </DialogHeader>

        <div className="bg-gray-100 p-3 rounded-md mb-4">
          <div className="font-semibold text-gray-800">{item.productName}</div>
          <div className="text-sm text-gray-500">Qty: {item.quantity} • ₦{(item.unitPrice * item.quantity).toLocaleString()}</div>
        </div>

        <div className="space-y-4 pt-4">
            {isBarItem ? (
              <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-blue-500" />
                <div>
                  <strong>No Manager Approval Required</strong>
                  <p>Bar items can be voided directly by the server.</p>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <strong>Manager Approval Required</strong>
                  <p>All kitchen voids require Manager override.</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border p-3 rounded-md">
              <div className="space-y-0.5">
                <Label>Record as Waste?</Label>
                <div className="text-sm text-gray-500">
                  {inventoryAction === 'WASTE' 
                    ? "Item was ruined. Inventory will be depleted." 
                    : "Item is intact. Will be returned to stock."}
                </div>
              </div>
              <Switch 
                checked={inventoryAction === 'WASTE'}
                onCheckedChange={(c) => setInventoryAction(c ? 'WASTE' : 'RESTOCK')}
              />
            </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => handleVoid()}
            disabled={isSubmitting}
            className="min-w-36 font-bold uppercase shadow-md"
          >
            {isSubmitting ? 'Voiding...' : 'VOID ITEM'}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      <ManagerOverrideModal
        isOpen={showOverride}
        actionName="Void Item"
        onAuthorized={handleOverrideAuthorized}
        onCancel={() => setShowOverride(false)}
      />

    </Dialog>
  );
}
