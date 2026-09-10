import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Building, 
  Monitor, 
  Car, 
  Search, 
  Plus, 
  TrendingDown, 
  Wallet,
  Activity
} from 'lucide-react';

const assets = [
  { id: 'AST-1045', name: 'MacBook Pro M3 Max', category: 'IT Equipment', value: 4500, depreciation: 1500, bookValue: 3000, status: 'Active', icon: Monitor },
  { id: 'AST-1046', name: 'Dell XPS 15', category: 'IT Equipment', value: 2500, depreciation: 500, bookValue: 2000, status: 'Active', icon: Monitor },
  { id: 'AST-1047', name: 'Delivery Van - Transit', category: 'Vehicles', value: 45000, depreciation: 15000, bookValue: 30000, status: 'Active', icon: Car },
  { id: 'AST-1048', name: 'HQ Office Furniture', category: 'Furniture', value: 12000, depreciation: 8000, bookValue: 4000, status: 'Maintenance', icon: Building },
  { id: 'AST-1049', name: 'Server Rack Alpha', category: 'IT Equipment', value: 25000, depreciation: 10000, bookValue: 15000, status: 'Active', icon: Monitor },
];

const stats = [
  { label: 'Total Assets Value', value: '$89,000', icon: Wallet, trend: '+4.5%' },
  { label: 'Accumulated Depreciation', value: '$35,000', icon: TrendingDown, trend: '+12.3%' },
  { label: 'Net Book Value', value: '$54,000', icon: Activity, trend: '-2.1%' },
];

export default function AssetsPage() {
  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600">
            Fixed Assets
          </h1>
          <p className="text-slate-400 mt-1">Manage corporate fixed assets and depreciation</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:text-slate-50">
            Export Register
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-white/5 border-slate-800/60 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                  <h3 className="text-3xl font-semibold mt-2 text-slate-100">{stat.value}</h3>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <stat.icon className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className={stat.trend.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}>
                  {stat.trend}
                </span>
                <span className="text-slate-500 ml-2">vs last year</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Asset Register */}
      <Card className="bg-white/5 border-slate-800/60 backdrop-blur-md shadow-xl">
        <CardHeader className="border-b border-slate-800/60 pb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl text-slate-100">Asset Register</CardTitle>
              <CardDescription className="text-slate-400">Detailed view of all registered fixed assets</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search assets..." 
                className="pl-9 bg-slate-900/50 border-slate-800 text-slate-200 placeholder:text-slate-500 focus-visible:ring-emerald-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-900/40">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 font-medium">Asset</TableHead>
                <TableHead className="text-slate-400 font-medium">Category</TableHead>
                <TableHead className="text-slate-400 font-medium text-right">Original Value</TableHead>
                <TableHead className="text-slate-400 font-medium text-right">Depreciation</TableHead>
                <TableHead className="text-slate-400 font-medium text-right">Book Value</TableHead>
                <TableHead className="text-slate-400 font-medium text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id} className="border-slate-800/60 hover:bg-white/[0.02] transition-colors">
                  <TableCell className="font-medium text-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-800/50 rounded-md">
                        <asset.icon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div>{asset.name}</div>
                        <div className="text-xs text-slate-500">{asset.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">{asset.category}</TableCell>
                  <TableCell className="text-right text-slate-300">${asset.value.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-400">-${asset.depreciation.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-emerald-400 font-medium">${asset.bookValue.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={
                      asset.status === 'Active' 
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' 
                        : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                    }>
                      {asset.status}
                    </Badge>
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
