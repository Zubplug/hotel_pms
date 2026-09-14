'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, ArrowLeft, Save, AlertCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { UnitOfMeasure, KitchenWasteReason } from '@hotel-pms/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NewWasteEntryPage() {
  const router = useRouter();
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [formData, setFormData] = useState({
    stockItemId: '',
    quantity: '',
    unitOfMeasure: 'KG',
    reason: 'SPOILAGE' as KitchenWasteReason,
    notes: '',
  });

  useEffect(() => {
    fetch('/api/v1/inventory/stock-items')
      .then(res => res.json())
      .then(res => {
        setStockItems(res.data || []);
      })
      .finally(() => setFetching(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit waste');
      
      router.push('/fnb/inventory/waste');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = stockItems.find(i => i.id === formData.stockItemId);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50/50 dark:bg-slate-950/20 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/fnb/inventory/waste" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Waste Log
        </Link>
        
        <PageHeader 
          title="Log Waste & Spoilage" 
          description="Record discarded items to ensure accurate inventory valuation and cost control."
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                Item Details & Quantity
              </CardTitle>
              <CardDescription>Select the stock item and the exact amount being discarded.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2.5">
                <Label>Stock Item</Label>
                <Select 
                  disabled={fetching} 
                  value={formData.stockItemId} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, stockItemId: val || '' }))}
                  required
                >
                  <SelectTrigger className="w-full h-11 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder={fetching ? "Loading items..." : "Search or select a stock item..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {stockItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} <span className="text-slate-400 text-xs ml-2">({item.quantityOnHand} {item.baseUnit} available)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="0.00"
                    className="h-11 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
                <div className="space-y-2.5">
                  <Label>Unit of Measure</Label>
                  <Select 
                    value={formData.unitOfMeasure} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, unitOfMeasure: val || '' }))}
                    required
                  >
                    <SelectTrigger className="h-11 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(UnitOfMeasure).map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                Reason & Evidence
              </CardTitle>
              <CardDescription>Provide operational context for why this item is being discarded.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2.5">
                <Label>Reason Code</Label>
                <Select 
                  value={formData.reason} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, reason: val as KitchenWasteReason }))}
                  required
                >
                  <SelectTrigger className="w-full h-11 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(KitchenWasteReason).map(reason => (
                      <SelectItem key={reason} value={reason}>{reason.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label>Notes & Operational Context (Optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="E.g. Dropped during service, found expired in walk-in..."
                  className="min-h-[120px] bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-4 pt-2">
            <Link href="/fnb/inventory/waste">
              <Button variant="ghost" className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading || !formData.stockItemId || !formData.quantity}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border border-emerald-700/50 px-8 h-11"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Submit for Approval
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
