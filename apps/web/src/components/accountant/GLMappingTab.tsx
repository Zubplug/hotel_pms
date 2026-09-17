'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertCircle, Link2, CheckCircle2 } from 'lucide-react';

export function GLMappingTab({ cashAccounts, chartOfAccounts }: { cashAccounts: any[], chartOfAccounts: any[] }) {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  const handleMappingChange = async (cashAccountId: string, glAccountId: string) => {
    // Show a confirm dialog before changing an existing mapping
    const existingAccount = cashAccounts.find(a => a.id === cashAccountId);
    if (existingAccount?.glAccountId && existingAccount.glAccountId !== glAccountId) {
      if (!window.confirm(`Warning: You are about to change the GL Mapping for ${existingAccount.name}. Are you sure?`)) {
        // Reset the value - we'd need more complex state to fully reset Shadcn select visually without reload,
        // but reloading is the easiest fallback for a cancelled action here.
        window.location.reload(); 
        return;
      }
    }

    setIsUpdating(cashAccountId);
    try {
      const response = await fetch('/api/v1/cash-management/gl-mapping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cashAccountId, glAccountId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update mapping');
      }

      toast.success('GL Mapping updated successfully');
      window.location.reload(); // Refresh server data
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg text-slate-100 flex items-center">
              <Link2 className="w-5 h-5 mr-2 text-emerald-400" />
              General Ledger Mappings
            </CardTitle>
            <CardDescription className="text-slate-400">
              Map physical cash registers and safes to their corresponding Chart of Accounts ID (Asset/Cash accounts only).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400 w-1/3">Physical Cash Account</TableHead>
              <TableHead className="text-slate-400">Type</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400 w-1/2">GL Account Mapping</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashAccounts.map((account) => (
              <TableRow key={account.id} className="border-white/10 hover:bg-white/5">
                <TableCell className="font-medium text-slate-200">
                  {account.name}
                </TableCell>
                <TableCell className="text-slate-400">
                  <Badge variant="outline" className="border-white/10 text-slate-300">
                    {account.type.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {account.glAccountId ? (
                    <span className="flex items-center text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Mapped
                    </span>
                  ) : (
                    <span className="flex items-center text-xs text-amber-400 font-medium">
                      <AlertCircle className="w-3 h-3 mr-1" /> Mapping Required
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Select 
                    disabled={isUpdating === account.id}
                    defaultValue={account.glAccountId || undefined}
                    onValueChange={(val) => handleMappingChange(account.id, val)}
                  >
                    <SelectTrigger className="w-full bg-slate-950 border-white/10 text-slate-200">
                      <SelectValue placeholder="Select a GL Account (Asset)" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
                      {chartOfAccounts.map(coa => (
                        <SelectItem key={coa.id} value={coa.id} className="focus:bg-white/10">
                          {coa.code} - {coa.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {cashAccounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                  No Cash Accounts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
