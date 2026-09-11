import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Download, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Reports (DSS) | F&B Management',
};

export default function FnbReportsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">F&B Reports (DSS)</h1>
          <p className="text-muted-foreground mt-1">Daily Sales Summaries & Night Audit Reconciliation.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline"><RefreshCcw className="mr-2 h-4 w-4" /> Sync PMS</Button>
          <Button><Download className="mr-2 h-4 w-4" /> Export Report</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Tender Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Room Charges (PMS)</span>
                <span className="font-bold">₦450,000</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Credit/Debit Cards</span>
                <span className="font-bold">₦620,000</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Cash Payments</span>
                <span className="font-bold">₦120,500</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold">Gross Total</span>
                <span className="font-bold text-lg text-primary">₦1,190,500</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-destructive" />
              Adjustments & Discrepancies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Manager Discounts</span>
                <span className="font-bold text-red-500">- ₦45,000</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Voided Transactions</span>
                <span className="font-bold text-red-500">- ₦22,500</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold">Net Total</span>
                <span className="font-bold text-lg">₦1,123,000</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
