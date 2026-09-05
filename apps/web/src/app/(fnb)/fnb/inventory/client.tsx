'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, AlertCircle, Percent, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

function buildHierarchy(warehouses: any[]) {
  const map = new Map();
  warehouses.forEach(w => map.set(w.id, { ...w, children: [] }));
  const roots: any[] = [];
  warehouses.forEach(w => {
    if (w.parentWarehouseId && map.has(w.parentWarehouseId)) {
      map.get(w.parentWarehouseId).children.push(map.get(w.id));
    } else {
      roots.push(map.get(w.id));
    }
  });
  
  const flattened: any[] = [];
  const traverse = (node: any, depth: number) => {
    flattened.push({ ...node, depth });
    node.children.forEach((child: any) => traverse(child, depth + 1));
  };
  roots.forEach(r => traverse(r, 0));
  return flattened;
}

export function FnbInventoryClient() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch Warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/v1/inventory/warehouses');
        if (res.ok) {
          const json = await res.json();
          const items = json.data?.items || json.data || [];
          const hierarchy = buildHierarchy(items);
          setWarehouses(hierarchy);
          if (hierarchy.length > 0) {
            setSelectedWarehouseId(hierarchy[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadWarehouses();
  }, []);

  // Fetch Report
  const fetchReport = async () => {
    if (!selectedWarehouseId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/reports/avt?warehouseId=${selectedWarehouseId}`);
      if (!res.ok) throw new Error('Failed to load report');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedWarehouseId]);

  const items = data?.items || [];
  const summary = data?.summary || { totalItems: 0, itemsCounted: 0, shortageValue: 0, overageValue: 0, netVarianceValue: 0 };
  
  const filteredItems = items.filter((item: any) => {
    const q = search.toLowerCase();
    return (
      item.itemCode.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Physical vs Book Stock</h1>
          <p className="text-muted-foreground mt-1">Compare actual counts to system quantities for {data?.warehouse?.name || 'the selected outlet'}.</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedWarehouseId} onValueChange={(v) => setSelectedWarehouseId(v || '')}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select Warehouse..." />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map(w => (
                <SelectItem key={w.id} value={w.id}>
                  {'\u00A0'.repeat(w.depth * 4)}
                  {w.depth > 0 ? '├─ ' : ''}
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchReport} disabled={loading || !selectedWarehouseId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Net Variance Value</CardTitle>
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.netVarianceValue < 0 ? 'text-red-500' : summary.netVarianceValue > 0 ? 'text-blue-500' : ''}`}>
              {formatCurrency(summary.netVarianceValue)}
            </div>
            <p className="text-xs text-muted-foreground">Overall financial impact</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Shortage Value</CardTitle>
            <ArrowDownRight className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{formatCurrency(summary.shortageValue)}</div>
            <p className="text-xs text-muted-foreground">Loss / Shrinkage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Overage Value</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{formatCurrency(summary.overageValue)}</div>
            <p className="text-xs text-muted-foreground">Found / Unrecorded Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Items Counted</CardTitle>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.itemsCounted} / {summary.totalItems}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalItems > 0 ? ((summary.itemsCounted / summary.totalItems) * 100).toFixed(1) : 0}% of items audited
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search stock items..." 
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
                <TableHead className="pl-6">Stock Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Physical Stock</TableHead>
                <TableHead className="text-right">Book Stock</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Var %</TableHead>
                <TableHead className="text-right">Var Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    No items found for this warehouse.
                  </TableCell>
                </TableRow>
              )}
              {filteredItems.map((item: any) => {
                const hasCount = item.physicalQuantity !== null;
                const varianceLabel = hasCount ? (item.varianceQuantity > 0 ? `+${item.varianceQuantity}` : item.varianceQuantity) : '--';
                const percentLabel = hasCount ? (item.variancePercentage > 0 ? `+${item.variancePercentage.toFixed(1)}%` : `${item.variancePercentage.toFixed(1)}%`) : '--';
                const isShortage = hasCount && item.varianceQuantity < 0;
                const isOverage = hasCount && item.varianceQuantity > 0;
                
                return (
                  <TableRow key={item.stockItemId}>
                    <TableCell className="pl-6 font-medium text-muted-foreground">{item.itemCode}</TableCell>
                    <TableCell className="font-semibold">
                      {item.name}
                      {item.lastStocktakeAt && (
                        <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                          Counted: {format(new Date(item.lastStocktakeAt), 'dd MMM yyyy')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right font-medium">
                      {hasCount ? `${item.physicalQuantity} ${item.unit}` : '--'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.bookQuantity} {item.unit}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${isShortage ? 'text-red-500' : isOverage ? 'text-blue-500' : ''}`}>
                      {varianceLabel}
                    </TableCell>
                    <TableCell className={`text-right ${isShortage ? 'text-red-500' : isOverage ? 'text-blue-500' : ''}`}>
                      {percentLabel}
                    </TableCell>
                    <TableCell className={`text-right ${isShortage ? 'text-red-500' : isOverage ? 'text-blue-500' : ''}`}>
                      {hasCount ? formatCurrency(item.varianceValue) : '--'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
