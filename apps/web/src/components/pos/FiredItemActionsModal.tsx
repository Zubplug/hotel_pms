import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { ManagerOverrideModal } from './ManagerOverrideModal';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export default function FiredItemActionsModal({
  isOpen,
  onClose,
  item,
  orderId,
  allProducts,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  orderId: string;
  allProducts: any[];
  onSuccess: (order: any) => void;
}) {
  const { provider } = useLodgeCoreProvider();
  
  const [activeTab, setActiveTab] = useState('replace');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Void State
  const [inventoryAction, setInventoryAction] = useState<'RESTOCK' | 'WASTE'>('RESTOCK');
  
  // Replace State
  const [replacementProduct, setReplacementProduct] = useState<any>(null);

  // Override State
  const [showOverride, setShowOverride] = useState(false);
  const [pendingAction, setPendingAction] = useState<'VOID' | 'REPLACE' | null>(null);
  
  if (!item) return null;
  
  const handleReplace = async (managerId?: string, managerPin?: string, reason?: string) => {
    if (!replacementProduct) {
      toast.error('Please select a replacement product');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        action: 'REPLACE',
        orderId,
        originalOrderItemId: item.id,
        reason: reason || 'Customer changed mind',
        inventoryAction: 'RESTOCK',
        managerId,
        managerPin,
        replacementItem: {
          id: crypto.randomUUID(),
          productId: replacementProduct.id,
          productName: replacementProduct.name,
          unitPrice: replacementProduct.price,
          quantity: 1 // For now, 1 to 1 replacement
        }
      };
      
      const result = await provider.approvals.requestItemModification(payload);
      
      if (result.requiresApproval) {
        setPendingAction('REPLACE');
        setShowOverride(true);
        setIsSubmitting(false);
        return;
      }
      
      if (result.success) {
        toast.success('Item replaced successfully');
        onSuccess(result.order);
        onClose();
      } else {
        toast.error(result.error || 'Failed to replace item');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = async (managerId?: string, managerPin?: string, reason?: string) => {
    setIsSubmitting(true);
    try {
      const payload = {
        action: 'VOID',
        orderId,
        originalOrderItemId: item.id,
        reason: reason || 'Customer changed mind',
        inventoryAction,
        managerId,
        managerPin
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

  const priceDiff = replacementProduct 
    ? (item.unitPrice * item.quantity) - replacementProduct.price 
    : 0;

  const handleOverrideAuthorized = (managerId: string, managerPin: string, reason: string) => {
    setShowOverride(false);
    if (pendingAction === 'REPLACE') {
      handleReplace(managerId, managerPin, reason);
    } else if (pendingAction === 'VOID') {
      handleVoid(managerId, managerPin, reason);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modify Fired Item</DialogTitle>
        </DialogHeader>

        <div className="bg-gray-100 p-3 rounded-md mb-4">
          <div className="font-semibold text-gray-800">{item.productName}</div>
          <div className="text-sm text-gray-500">Qty: {item.quantity} • ₦{(item.unitPrice * item.quantity).toLocaleString()}</div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="replace"><RefreshCcw className="w-4 h-4 mr-2" /> Replace</TabsTrigger>
            <TabsTrigger value="void"><Trash className="w-4 h-4 mr-2" /> Void</TabsTrigger>
          </TabsList>
          
          <TabsContent value="replace" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Select Replacement</Label>
              <Select onValueChange={(val) => {
                const prod = allProducts.find((p: any) => p.id === val);
                setReplacementProduct(prod);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product..." />
                </SelectTrigger>
                <SelectContent>
                  {allProducts.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (₦{p.price.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {replacementProduct && (
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-md mb-2">
                <div className="text-sm">Price difference: 
                  <span className={`font-semibold ml-2 ${priceDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {priceDiff > 0 ? '-' : '+'}₦{Math.abs(priceDiff).toLocaleString()}
                  </span>
                </div>
                {priceDiff > 0 && (
                  <div className="text-xs text-blue-700 mt-1">
                    Large reductions require manager approval.
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="void" className="space-y-4 pt-4">
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <strong>Manager Approval Required</strong>
                <p>All voids require Manager override.</p>
              </div>
            </div>

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
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {activeTab === 'replace' ? (
            <Button onClick={() => handleReplace()} disabled={isSubmitting || !replacementProduct}>
              {isSubmitting ? 'Replacing...' : 'Replace Item'}
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => handleVoid()} disabled={isSubmitting}>
              {isSubmitting ? 'Voiding...' : 'Confirm Void'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      <ManagerOverrideModal
        isOpen={showOverride}
        actionName={pendingAction === 'VOID' ? 'Void Item' : 'Replace Item'}
        onAuthorized={handleOverrideAuthorized}
        onCancel={() => setShowOverride(false)}
      />
    </Dialog>
  );
}
