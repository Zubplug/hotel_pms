import React from 'react';
import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';
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
import { RegisterAssetForm } from '@/components/accountant/RegisterAssetForm';

export default async function AssetsPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  const assets = propertyId ? await prisma.fixedAsset.findMany({ 
    where: { propertyId },
    include: { category: true }
  }) : [];
  
  const categories = propertyId ? await prisma.fixedAssetCategory.findMany({
    where: { propertyId }
  }) : [];

  const totalAssetsValue = assets.reduce((sum, a) => sum + Number(a.acquisitionCost || 0), 0);
  const totalDepreciation = assets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation || 0), 0);
  const netBookValue = assets.reduce((sum, a) => sum + Number(a.currentBookValue || 0), 0);

  const stats = [
    { label: 'Total Assets Value', value: `₦${totalAssetsValue.toLocaleString()}`, icon: Wallet, trend: '+4.5%' },
    { label: 'Accumulated Depreciation', value: `₦${totalDepreciation.toLocaleString()}`, icon: TrendingDown, trend: '+12.3%' },
    { label: 'Net Book Value', value: `₦${netBookValue.toLocaleString()}`, icon: Activity, trend: '-2.1%' },
  ];

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
          <RegisterAssetForm categories={categories.map(c => ({ id: c.id, name: c.name }))} />
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
              {assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-4">No data</TableCell>
                </TableRow>
              ) : assets.map((asset) => {
                const statusStr = asset.status.replace(/_/g, ' ');
                const displayStatus = statusStr.charAt(0).toUpperCase() + statusStr.slice(1).toLowerCase();
                const Icon = asset.category?.name?.toLowerCase().includes('vehicle') ? Car : asset.category?.name?.toLowerCase().includes('furniture') ? Building : Monitor;
                
                return (
                  <TableRow key={asset.id} className="border-slate-800/60 hover:bg-white/[0.02] transition-colors">
                    <TableCell className="font-medium text-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800/50 rounded-md">
                          <Icon className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <div>{asset.name || 'N/A'}</div>
                          <div className="text-xs text-slate-500">{asset.assetNumber || 'N/A'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{asset.category?.name || 'N/A'}</TableCell>
                    <TableCell className="text-right text-slate-300">₦{asset.acquisitionCost ? Number(asset.acquisitionCost).toLocaleString() : '0'}</TableCell>
                    <TableCell className="text-right text-red-400">-₦{asset.accumulatedDepreciation ? Number(asset.accumulatedDepreciation).toLocaleString() : '0'}</TableCell>
                    <TableCell className="text-right text-emerald-400 font-medium">₦{asset.currentBookValue ? Number(asset.currentBookValue).toLocaleString() : '0'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={
                        asset.status === 'ACTIVE' 
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' 
                          : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      }>
                        {displayStatus}
                      </Badge>
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
