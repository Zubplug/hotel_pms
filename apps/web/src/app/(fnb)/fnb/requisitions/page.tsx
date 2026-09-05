import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter, MoreHorizontal, ArrowRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata: Metadata = {
  title: 'Stock Requisitions | F&B Management',
};

const mockRequisitions = [
  { id: 'REQ-2023-089', date: 'Oct 12, 10:45 AM', from: 'Main Warehouse', to: 'Restaurant Bar', status: 'PENDING_APPROVAL', items: 12 },
  { id: 'REQ-2023-088', date: 'Oct 11, 09:15 AM', from: 'Main Warehouse', to: 'Main Kitchen', status: 'ISSUED', items: 45 },
  { id: 'REQ-2023-087', date: 'Oct 10, 14:30 PM', from: 'Main Warehouse', to: 'Restaurant Bar', status: 'COMPLETED', items: 8 },
  { id: 'REQ-2023-086', date: 'Oct 10, 08:00 AM', from: 'Main Warehouse', to: 'Main Kitchen', status: 'REJECTED', items: 3 },
];

export default function FnbRequisitionsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Requisitions</h1>
          <p className="text-muted-foreground mt-1">Manage internal stock transfers and requests from the main warehouse.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Requisition
        </Button>
      </div>

      <div className="flex space-x-2 pb-2">
        <Badge variant="default" className="px-3 py-1 text-sm cursor-pointer">All</Badge>
        <Badge variant="outline" className="px-3 py-1 text-sm cursor-pointer">Drafts</Badge>
        <Badge variant="outline" className="px-3 py-1 text-sm cursor-pointer border-yellow-500 text-yellow-600 bg-yellow-50">Pending Approval</Badge>
        <Badge variant="outline" className="px-3 py-1 text-sm cursor-pointer border-blue-500 text-blue-600 bg-blue-50">Issued (Awaiting Receipt)</Badge>
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
                <TableHead>Date Requested</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockRequisitions.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="pl-6 font-semibold">{req.id}</TableCell>
                  <TableCell className="text-muted-foreground">{req.date}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">{req.from}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-sm">{req.to}</span>
                    </div>
                  </TableCell>
                  <TableCell>{req.items} items</TableCell>
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
