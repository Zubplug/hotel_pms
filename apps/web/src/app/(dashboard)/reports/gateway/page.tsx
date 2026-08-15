'use client';

import { useState } from 'react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { Loader2, Download, Printer, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function GatewayReconciliationPage() {
  const { propertyId } = useProperty();
  
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [provider, setProvider] = useState('PAYSTACK');

  const fetchReconciliation = async () => {
    if (!propertyId) return null;
    const start = startOfDay(new Date(startDate)).toISOString();
    const end = endOfDay(new Date(endDate)).toISOString();
    
    const res = await fetch(`/api/v1/reports/gateway-reconciliation?propertyId=${propertyId}&startDate=${start}&endDate=${end}&provider=${provider}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch report');
    return data.data.reconciliation;
  };

  const { data: reconciliation, isLoading, error } = useQuery({
    queryKey: ['gatewayReconciliation', propertyId, startDate, endDate, provider],
    queryFn: fetchReconciliation,
    enabled: !!propertyId,
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  // Aggregations
  let systemTotal = 0;
  let providerTotal = 0;
  let countMatched = 0;
  let countMissingProvider = 0;
  let countMissingPMS = 0;
  let countAmountMismatch = 0;
  let countStatusMismatch = 0;

  (reconciliation || []).forEach((r: any) => {
    if (r.pmsAmount) systemTotal += r.pmsAmount;
    if (r.providerAmount) providerTotal += r.providerAmount;

    if (r.reconciliationStatus === 'MATCHED') countMatched++;
    else if (r.reconciliationStatus === 'MISSING_PROVIDER_TRANSACTION') countMissingProvider++;
    else if (r.reconciliationStatus === 'MISSING_PMS_TRANSACTION') countMissingPMS++;
    else if (r.reconciliationStatus === 'AMOUNT_MISMATCH') countAmountMismatch++;
    else if (r.reconciliationStatus === 'STATUS_MISMATCH') countStatusMismatch++;
  });

  const difference = Math.abs(systemTotal - providerTotal);
  
  const isReconciled = 
    difference === 0 && 
    countMissingProvider === 0 && 
    countMissingPMS === 0 && 
    countAmountMismatch === 0;

  const hasMismatch = countAmountMismatch > 0 || countMissingPMS > 0 || countMissingProvider > 0;

  const renderStatusBadge = (status: string) => {
    switch(status) {
      case 'MATCHED':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">MATCHED</Badge>;
      case 'MISSING_PROVIDER_TRANSACTION':
        return <Badge variant="destructive">MISSING IN PROVIDER</Badge>;
      case 'MISSING_PMS_TRANSACTION':
        return <Badge variant="destructive">MISSING IN PMS</Badge>;
      case 'AMOUNT_MISMATCH':
        return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">AMOUNT MISMATCH</Badge>;
      case 'STATUS_MISMATCH':
        return <Badge variant="secondary" className="bg-amber-500 text-white hover:bg-amber-600">STATUS MISMATCH</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gateway Reconciliation</h1>
          <p className="text-muted-foreground mt-1">
            Audit LodgeCore records against payment gateway settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline"><Printer className="w-4 h-4 mr-2" /> Print</Button>
          <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">Gateway</label>
            <Select value={provider} onValueChange={(val) => setProvider(val || 'PAYSTACK')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PAYSTACK">Paystack</SelectItem>
                <SelectItem value="FLUTTERWAVE" disabled>Flutterwave (Coming Soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Start Date</label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">End Date</label>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="w-40"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 text-red-800 rounded-lg border border-red-200">
          Error loading report: {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Reconciliation Status</CardTitle>
              </CardHeader>
              <CardContent>
                {isReconciled ? (
                  <div className="flex items-center text-emerald-600">
                    <CheckCircle2 className="w-10 h-10 mr-3" />
                    <div>
                      <div className="text-2xl font-bold">RECONCILED</div>
                      <div className="text-sm font-medium opacity-80">All transactions matched</div>
                    </div>
                  </div>
                ) : hasMismatch ? (
                  <div className="flex items-center text-red-600">
                    <XCircle className="w-10 h-10 mr-3" />
                    <div>
                      <div className="text-2xl font-bold">MISMATCH</div>
                      <div className="text-sm font-medium opacity-80">Requires manual review</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center text-amber-500">
                    <AlertTriangle className="w-10 h-10 mr-3" />
                    <div>
                      <div className="text-2xl font-bold">REVIEW REQUIRED</div>
                      <div className="text-sm font-medium opacity-80">Discrepancies found</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-1 md:col-span-2">
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase mb-1">System Total</p>
                    <p className="text-3xl font-bold">{formatCurrency(systemTotal)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase mb-1">Provider Total</p>
                    <p className="text-3xl font-bold">{formatCurrency(providerTotal)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase mb-1">Difference</p>
                    <p className={`text-3xl font-bold ${difference > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(difference)}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-5 gap-4 mt-6 pt-6 border-t">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase">Matched</p>
                    <p className="text-xl font-semibold text-emerald-600">{countMatched}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase">Missing PMS</p>
                    <p className="text-xl font-semibold text-red-600">{countMissingPMS}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase">Missing Prov.</p>
                    <p className="text-xl font-semibold text-red-600">{countMissingProvider}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase">Amt Mismatch</p>
                    <p className="text-xl font-semibold text-orange-500">{countAmountMismatch}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase">Stat Mismatch</p>
                    <p className="text-xl font-semibold text-amber-500">{countStatusMismatch}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transaction Ledger</CardTitle>
              <CardDescription>Line-by-line comparison of System and Provider records</CardDescription>
            </CardHeader>
            <CardContent>
              {(!reconciliation || reconciliation.length === 0) ? (
                <p className="text-muted-foreground text-center p-6">No online transactions found for this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Transaction Date</TableHead>
                      <TableHead>Settlement Date</TableHead>
                      <TableHead>Status Match</TableHead>
                      <TableHead className="text-right">System Amt</TableHead>
                      <TableHead className="text-right">Provider Amt</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliation.map((r: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{r.providerReference}</TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(r.transactionDate), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.settlementDate ? format(new Date(r.settlementDate), 'yyyy-MM-dd HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] w-20 justify-center truncate" title={`PMS: ${r.pmsStatus}`}>
                              {r.pmsStatus || 'NONE'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">vs</span>
                            <Badge variant="outline" className="text-[10px] w-20 justify-center truncate" title={`Gateway: ${r.providerStatus}`}>
                              {r.providerStatus || 'NONE'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(r.pmsAmount)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(r.providerAmount)}</TableCell>
                        <TableCell>
                          {renderStatusBadge(r.reconciliationStatus)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
