'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter, MoreHorizontal, ArrowRight, Save, Send, Trash, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';

export default function RequisitionsClient() {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  
  // New Requisition Form State
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [selectedItems, setSelectedItems] = useState<{itemId: string, name: string, quantity: string}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive propertyId from the first warehouse or stock item for the POST request
  const inferredPropertyId = warehouses[0]?.propertyId || stockItems[0]?.propertyId || '';

  useEffect(() => {
    fetchRequisitions();
    fetchWarehouses();
    fetchStockItems();
  }, []);

  const fetchRequisitions = async () => {
    try {
      const res = await fetch(`/api/v1/fnb/inventory/requisitions`);
      if (res.ok) {
        const json = await res.json();
        setRequisitions(json.data.requisitions);
      }
    } catch (error) {
      console.error('Failed to fetch requisitions', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`/api/v1/inventory/warehouses`);
      if (res.ok) {
        const json = await res.json();
        setWarehouses(json.data || json.data?.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses', error);
    }
  };

  const fetchStockItems = async () => {
    try {
      const res = await fetch(`/api/v1/inventory/items`);
      if (res.ok) {
        const json = await res.json();
        setStockItems(json.data || json.data?.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch stock items', error);
    }
  };

  const filteredRequisitions = requisitions.filter(req => {
    if (filter === 'ALL') return true;
    if (filter === 'DRAFT' && req.status === 'DRAFT') return true;
    if (filter === 'PENDING' && req.status === 'PENDING_APPROVAL') return true;
    if (filter === 'ISSUED' && req.status === 'ISSUED') return true;
    return false;
  });

  const addItem = (itemId: string) => {
    const item = stockItems.find(i => i.id === itemId);
    if (!item) return;
    if (selectedItems.find(i => i.itemId === itemId)) return;
    setSelectedItems([...selectedItems, { itemId: item.id, name: item.name, quantity: '1' }]);
  };

  const updateQuantity = (itemId: string, qty: string) => {
    setSelectedItems(selectedItems.map(i => i.itemId === itemId ? { ...i, quantity: qty } : i));
  };

  const removeItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(i => i.itemId !== itemId));
  };

  const handleSubmit = async (action: 'DRAFT' | 'SUBMIT') => {
    if (!fromWarehouseId || !toWarehouseId) {
      toast.error('Please select source and destination warehouses');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    for (const item of selectedItems) {
      if (!item.quantity || Number(item.quantity) <= 0) {
        toast.error('All quantities must be greater than 0');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const requestId = crypto.randomUUID();
      const res = await fetch('/api/v1/fnb/inventory/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: inferredPropertyId,
          fromWarehouseId,
          toWarehouseId,
          items: selectedItems,
          action,
          requestId
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create requisition');

      toast.success(action === 'DRAFT' ? 'Draft saved!' : 'Requisition submitted for approval!');
      setIsNewOpen(false);
      setFromWarehouseId('');
      setToWarehouseId('');
      setSelectedItems([]);
      fetchRequisitions();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Requisitions</h1>
          <p className="text-muted-foreground mt-1">Manage internal stock transfers and requests.</p>
        </div>
        
        <Button onClick={() => setIsNewOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Requisition</Button>
        
        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create Stock Requisition</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Destination (Requesting For)</Label>
                <Select value={toWarehouseId} onValueChange={(v) => setToWarehouseId(v || '')}>
                  <SelectTrigger><SelectValue placeholder="Select your outlet..." /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source (Requesting From)</Label>
                <Select value={fromWarehouseId} onValueChange={(v) => setFromWarehouseId(v || '')}>
                  <SelectTrigger><SelectValue placeholder="Select source store..." /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Request Items</Label>
              <Select onValueChange={(v) => v && addItem(v)} value="">
                <SelectTrigger><SelectValue placeholder="Add an item..." /></SelectTrigger>
                <SelectContent>
                  {stockItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedItems.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-[150px]">Quantity</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.map(item => (
                      <TableRow key={item.itemId}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min="0.1" 
                            step="any"
                            value={item.quantity} 
                            onChange={(e) => updateQuantity(item.itemId, e.target.value)} 
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.itemId)}>
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <DialogFooter className="mt-6 flex justify-between sm:justify-between">
              <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={isSubmitting} onClick={() => handleSubmit('DRAFT')}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Draft
                </Button>
                <Button disabled={isSubmitting} onClick={() => handleSubmit('SUBMIT')}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Submit for Approval
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex space-x-2 pb-2">
        <Badge variant={filter === 'ALL' ? 'default' : 'outline'} className="px-3 py-1 text-sm cursor-pointer" onClick={() => setFilter('ALL')}>All</Badge>
        <Badge variant={filter === 'DRAFT' ? 'default' : 'outline'} className="px-3 py-1 text-sm cursor-pointer" onClick={() => setFilter('DRAFT')}>Drafts</Badge>
        <Badge variant={filter === 'PENDING' ? 'default' : 'outline'} className={`px-3 py-1 text-sm cursor-pointer ${filter !== 'PENDING' ? 'border-yellow-500 text-yellow-600 bg-yellow-50' : ''}`} onClick={() => setFilter('PENDING')}>Pending Approval</Badge>
        <Badge variant={filter === 'ISSUED' ? 'default' : 'outline'} className={`px-3 py-1 text-sm cursor-pointer ${filter !== 'ISSUED' ? 'border-blue-500 text-blue-600 bg-blue-50' : ''}`} onClick={() => setFilter('ISSUED')}>Issued (Awaiting Receipt)</Badge>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search requisitions..." className="pl-8" />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Requisition ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading requisitions...</TableCell>
                </TableRow>
              ) : filteredRequisitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No requisitions found.</TableCell>
                </TableRow>
              ) : filteredRequisitions.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="pl-6 font-semibold">{req.transferRef}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                  <TableCell className="font-medium text-sm">{req.toWarehouse?.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{req.fromWarehouse?.name}</TableCell>
                  <TableCell>{req.items?.length || 0} items</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{/* Need requested by name, just show ID or leave blank for now */ req.requestedBy?.substring(0, 8)}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        req.status === 'COMPLETED' ? 'default' : 
                        req.status === 'REJECTED' ? 'destructive' :
                        req.status === 'PENDING_APPROVAL' ? 'secondary' : 'outline'
                      }
                      className={
                        req.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' :
                        req.status === 'ISSUED' ? 'border-blue-200 bg-blue-50 text-blue-700' : ''
                      }
                    >
                      {req.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
