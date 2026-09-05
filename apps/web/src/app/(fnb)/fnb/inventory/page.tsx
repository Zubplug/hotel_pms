import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, AlertCircle, Percent } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata: Metadata = {
  title: 'Outlet Inventory & AvT | F&B Management',
};

const mockInventory = [
  { id: 'STK-001', name: 'Premium Gin (750ml)', category: 'Spirits', currentStock: '2.5 btl', theoretical: '3.1 btl', variance: '-0.6 btl', varPercent: '-19.3%' },
  { id: 'STK-002', name: 'Salmon Fillet (kg)', category: 'Seafood', currentStock: '12.0 kg', theoretical: '12.5 kg', variance: '-0.5 kg', varPercent: '-4.0%' },
  { id: 'STK-003', name: 'Tomatoes (kg)', category: 'Produce', currentStock: '45.0 kg', theoretical: '42.0 kg', variance: '+3.0 kg', varPercent: '+7.1%' },
  { id: 'STK-004', name: 'Coca Cola (can)', category: 'Beverages', currentStock: '144 can', theoretical: '144 can', variance: '0', varPercent: '0.0%' },
];

export default function FnbInventoryPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outlet Inventory & AvT</h1>
          <p className="text-muted-foreground mt-1">Track actual vs theoretical (AvT) consumption and outlet stock levels.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Variance Value</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">- ₦45,200</div>
            <p className="text-xs text-muted-foreground">Estimated loss in period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Items Counted</CardTitle>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">142 / 450</div>
            <p className="text-xs text-muted-foreground">31.5% of outlet items audited this week</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search stock items..." className="pl-8" />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Stock Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Actual Stock</TableHead>
                <TableHead className="text-right">Theoretical</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Var %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInventory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-6 font-medium text-muted-foreground">{item.id}</TableCell>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="text-right font-medium">{item.currentStock}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{item.theoretical}</TableCell>
                  <TableCell className={`text-right font-semibold ${item.variance.startsWith('-') ? 'text-red-500' : item.variance.startsWith('+') ? 'text-blue-500' : ''}`}>
                    {item.variance}
                  </TableCell>
                  <TableCell className={`text-right ${item.variance.startsWith('-') ? 'text-red-500' : ''}`}>
                    {item.varPercent}
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
