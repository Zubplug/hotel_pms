import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePOS } from '@/contexts/POSContext';
import { useDataProvider } from '@/lib/desktop/DataProviderContext';
import { toast } from 'sonner';

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
  const { provider } = useDataProvider();
  const { menuCategories } = usePOS();
  
  const [activeTab, setActiveTab] = useState('replace');
  const [managerPin, setManagerPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Void State
  const [voidReason, setVoidReason] = useState('Customer changed mind');
  const [inventoryAction, setInventoryAction] = useState<'RESTOCK' | 'WASTE'>('RESTOCK');
  
  // Replace State
  const [replacementProduct, setReplacementProduct] = useState<any>(null);
  
  if (!item) return null;

  // Flatten products for dropdown
  const allProducts = menuCategories?.flatMap((c: any) => c.products) || [];
  
  const handleReplace = async () => {
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
        reason: 'Customer changed mind',
        inventoryAction: 'RESTOCK',
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
        toast.error('This replacement requires a Manager PIN (exceeds threshold or is free).');
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

  const handleVoid = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        action: 'VOID',
        orderId,
        originalOrderItemId: item.id,
        reason: voidReason,
        inventoryAction,
        managerPin
      };
      
      const result = await provider.approvals.requestItemModification(payload);
      
      if (result.requiresApproval) {
        toast.error('Invalid Manager PIN');
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

  const isBarItem = item.station === 'BAR';
  const requiresVoidPin = !isBarItem;

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
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-md">
                <div className="text-sm">Price difference: 
                  <span className={`font-semibold ml-2 ${priceDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {priceDiff > 0 ? '-' : '+'}₦{Math.abs(priceDiff).toLocaleString()}
                  </span>
                </div>
                {priceDiff > 0 && (
                  <div className="text-xs text-blue-700 mt-1">
                    Large reductions may require a manager PIN.
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Manager PIN (if required)</Label>
              <Input 
                type="password" 
                placeholder="****" 
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="void" className="space-y-4 pt-4">
            {requiresVoidPin ? (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <strong>Manager Approval Required</strong>
                  <p>Kitchen/Restaurant voids require a PIN.</p>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <strong>Bar Item Auto-Approval</strong>
                  <p>Bar items can be voided without a Manager PIN.</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={voidReason} onValueChange={setVoidReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Customer changed mind">Customer changed mind</SelectItem>
                  <SelectItem value="Entry error">Entry error</SelectItem>
                  <SelectItem value="Spilled/Ruined">Spilled/Ruined</SelectItem>
                  <SelectItem value="Quality issue">Quality issue</SelectItem>
                  <SelectItem value="Duplicate order">Duplicate order</SelectItem>
                </SelectContent>
              </Select>
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

            {requiresVoidPin && (
              <div className="space-y-2">
                <Label>Manager PIN</Label>
                <Input 
                  type="password" 
                  placeholder="Enter Manager PIN..." 
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {activeTab === 'replace' ? (
            <Button onClick={handleReplace} disabled={isSubmitting || !replacementProduct}>
              {isSubmitting ? 'Replacing...' : 'Replace Item'}
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleVoid} disabled={isSubmitting || (requiresVoidPin && !managerPin)}>
              {isSubmitting ? 'Voiding...' : 'Confirm Void'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
