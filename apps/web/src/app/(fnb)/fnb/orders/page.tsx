import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Clock, Receipt, MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata: Metadata = {
  title: 'Live Orders | F&B Management',
};

const mockOrders = [
  { id: 'ORD-001', table: 'T-12', server: 'Jane Doe', status: 'PREPARING', amount: '₦45,000', time: '14 mins ago' },
  { id: 'ORD-002', table: 'T-04', server: 'John Smith', status: 'SUBMITTED', amount: '₦12,500', time: '2 mins ago' },
  { id: 'ORD-003', table: 'Bar-01', server: 'Alice B.', status: 'SERVED', amount: '₦8,000', time: '35 mins ago' },
  { id: 'ORD-004', table: 'T-09', server: 'Jane Doe', status: 'PAYMENT_PENDING', amount: '₦110,000', time: '1h 5m ago' },
];

export default function FnbOrdersPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Orders</h1>
          <p className="text-muted-foreground mt-1">Monitor Kitchen Order Tickets (KOT) and order statuses.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders, tables..." className="pl-8" />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Order ID</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="pl-6 font-medium">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      {order.id}
                    </div>
                  </TableCell>
                  <TableCell>{order.table}</TableCell>
                  <TableCell>{order.server}</TableCell>
                  <TableCell>
                    <Badge variant={order.status === 'PREPARING' ? 'secondary' : order.status === 'SERVED' ? 'default' : 'outline'}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {order.time}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{order.amount}</TableCell>
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
