'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter, MoreHorizontal, Loader2, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

export function FnbMenuClient() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchMenu = async () => {
    setLoading(true);
    try {
      // ?all=true ensures we see inactive (86'd) items as well
      const res = await fetch('/api/v1/pos/products?all=true');
      if (!res.ok) throw new Error('Failed to fetch menu');
      const data = await res.json();
      setProducts(data.data || []);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Could not load menu items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    const itemCode = p.itemCode || p.id.slice(0, 8);
    return (
      itemCode.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.category?.name?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (product: any) => {
    if (!product.isActive) {
      return <Badge variant="destructive">86'd</Badge>;
    }
    switch (product.stockStatus) {
      case 'OUT_OF_STOCK':
        return <Badge variant="destructive">Out of Stock</Badge>;
      case 'LOW_STOCK':
        return <Badge variant="secondary">Low Stock</Badge>;
      default:
        return <Badge variant="default">Available</Badge>;
    }
  };

  const formatInventoryMode = (mode: string) => {
    switch (mode) {
      case 'PREPARED_RECIPE': return 'Prepared';
      case 'STOCK': return 'Stock';
      case 'NON_STOCK': return 'Non-Stock';
      default: return mode;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Management</h1>
          <p className="text-muted-foreground mt-1">Manage POS products, categories, pricing, and availability.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchMenu} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search menu items..." 
                  className="pl-8" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
                <TableHead>Availability</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No menu items found.
                  </TableCell>
                </TableRow>
              )}
              {filteredProducts.map((item) => (
                <TableRow key={item.id} className={!item.isActive ? 'opacity-60' : ''}>
                  <TableCell className="pl-6 font-medium text-muted-foreground">
                    {item.itemCode || item.id.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell>{item.category?.name || 'Uncategorized'}</TableCell>
                  <TableCell>{formatInventoryMode(item.inventoryMode)}</TableCell>
                  <TableCell>
                    {getStatusBadge(item)}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(item.price))}</TableCell>
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
