import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { Users, TrendingUp, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Staff Performance | F&B Management',
};

const staffPerformance = [
  { name: 'John Doe', role: 'Senior Waiter', sales: '₦450,500', covers: 84, voids: 2, tips: '₦22,000', rating: 'Excellent' },
  { name: 'Jane Smith', role: 'Waitress', sales: '₦320,000', covers: 62, voids: 1, tips: '₦15,500', rating: 'Good' },
  { name: 'Michael T.', role: 'Bartender', sales: '₦510,000', covers: 45, voids: 5, tips: '₦45,000', rating: 'Review Voids' },
];

export default function FnbStaffPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Performance</h1>
          <p className="text-muted-foreground mt-1">Track shift performance, sales per waiter, and void frequencies.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        {staffPerformance.map((staff, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center font-semibold text-secondary-foreground">
                {staff.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <CardTitle className="text-lg">{staff.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{staff.role}</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Sales</span>
                  <span className="text-sm font-medium">{staff.sales}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Covers Served</span>
                  <span className="text-sm font-medium">{staff.covers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Collected Tips</span>
                  <span className="text-sm font-medium text-green-600">{staff.tips}</span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Voided Items</span>
                  <Badge variant={staff.voids > 3 ? 'destructive' : 'secondary'} className="font-mono">
                    {staff.voids} items
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
