'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, DollarSign, Receipt, TrendingUp, CreditCard, Banknote, User } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface MySalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  operatorToken: string;
  staffName: string;
}

export function MySalesModal({ isOpen, onClose, operatorToken, staffName }: MySalesModalProps) {
  const [salesData, setSalesData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && operatorToken) {
      fetchSales();
    }
  }, [isOpen, operatorToken]);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/pos/reports/server-sales', {
        headers: {
          'Authorization': `Bearer ${operatorToken}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch sales data');
      const data = await res.json();
      setSalesData(data.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load shift sales');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-slate-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            My Sales - {staffName}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading your sales data...</p>
            </div>
          ) : !salesData ? (
            <div className="text-center text-slate-500 py-8">
              No sales data found for current shift.
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Highlight Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-indigo-100 bg-indigo-50/50">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Gross Sales</p>
                      <h4 className="text-2xl font-bold text-slate-900">{formatCurrency(salesData.grossSales)}</h4>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-emerald-100 bg-emerald-50/50">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Net Sales</p>
                      <h4 className="text-2xl font-bold text-slate-900">{formatCurrency(salesData.netSales)}</h4>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Breakdown */}
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <Receipt className="w-5 h-5 text-slate-400" />
                        <span className="font-medium text-slate-700">Total Orders Processed</span>
                      </div>
                      <span className="font-bold text-slate-900">{salesData.ordersCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <Banknote className="w-5 h-5 text-slate-400" />
                        <span className="font-medium text-slate-700">Cash Received</span>
                      </div>
                      <span className="font-bold text-slate-900">{formatCurrency(salesData.cashSales)}</span>
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-slate-400" />
                        <span className="font-medium text-slate-700">Card Payments</span>
                      </div>
                      <span className="font-bold text-slate-900">{formatCurrency(salesData.cardSales)}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-slate-400" />
                        <span className="font-medium text-slate-700">Room Charges</span>
                      </div>
                      <span className="font-bold text-slate-900">{formatCurrency(salesData.roomCharges)}</span>
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <span className="font-medium text-red-600">Total Discounts Given</span>
                      <span className="font-bold text-red-600">-{formatCurrency(salesData.totalDiscounts)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={onClose} variant="outline">
                  Close
                </Button>
                <Button onClick={() => window.print()} className="ml-2">
                  Print Report
                </Button>
              </div>

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
