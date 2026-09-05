import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter, MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata: Metadata = {
  title: 'Menu Management | F&B Management',
};

const mockMenu = [
  { id: 'ITM-001', name: 'Grilled Salmon', category: 'Mains', price: '₦24,000', status: 'AVAILABLE', type: 'PREPARED' },
  { id: 'ITM-002', name: 'Caesar Salad', category: 'Starters', price: '₦12,500', status: 'AVAILABLE', type: 'PREPARED' },
  { id: 'ITM-003', name: 'Premium Gin (Shot)', category: 'Spirits', price: '₦4,500', status: 'LOW_STOCK', type: 'POURED' },
  { id: 'ITM-004', name: 'T-Bone Steak', category: 'Mains', price: '₦35,000', status: 'UNAVAILABLE', type: 'PREPARED' }, // 86'd
];

export default function FnbMenuPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Management</h1>
          <p className="text-muted-foreground mt-1">Manage POS products, categories, pricing, and availability.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search menu items..." className="pl-8" />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Item Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockMenu.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-6 font-medium text-muted-foreground">{item.id}</TableCell>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'AVAILABLE' ? 'default' : item.status === 'LOW_STOCK' ? 'secondary' : 'destructive'}>
                      {item.status === 'UNAVAILABLE' ? "86'd" : item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{item.price}</TableCell>
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
