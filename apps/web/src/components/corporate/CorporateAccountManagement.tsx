'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Search, Plus, ExternalLink, Pencil, Ban } from 'lucide-react';
import { CorporateAccountDialog } from './CorporateAccountDialog';
import { toast } from 'sonner';

interface CorporateAccountManagementProps {
  propertyId: string;
  canCreate: boolean;
  canEdit: boolean;
  canChangeFinancials: boolean;
  canChangeDepositPolicy: boolean;
  canDeactivate: boolean;
  canViewCityLedger: boolean;
}

export function CorporateAccountManagement({ 
  propertyId, 
  canCreate, 
  canEdit, 
  canChangeFinancials,
  canChangeDepositPolicy,
  canDeactivate,
  canViewCityLedger,
}: CorporateAccountManagementProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [depositPolicy, setDepositPolicy] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const endpoint = propertyId ? `/api/v1/corporate-accounts?propertyId=${propertyId}&status=${status}${depositPolicy ? `&depositPolicy=${depositPolicy}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}` : null;
  const loadAccounts = async () => {
    if (!endpoint) return;
    setIsLoading(true);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Unable to load corporate accounts');
      setResponse(await res.json());
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => { void loadAccounts(); }, [endpoint]);

  const accounts = response?.data || [];

  const filteredAccounts = accounts;

  const totalCreditExposure = accounts.reduce((sum: number, acc: any) => sum + Number(acc.creditLimit || 0), 0);
  const totalOutstanding = accounts.reduce((sum: number, acc: any) => sum + Number(acc.cityLedgerAccount?.balance || 0), 0);

  const handleCreate = () => {
    setSelectedAccount(null);
    setDialogOpen(true);
  };

  const handleEdit = (account: any) => {
    setSelectedAccount(account);
    setDialogOpen(true);
  };

  const handleDeactivate = async (id: string) => {
    const reason = window.prompt('Reason for deactivation (required):');
    if (!reason || reason.trim().length < 5) return toast.error('A deactivation reason is required.');
    try {
      const res = await fetch(`/api/v1/corporate-accounts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) throw new Error('Failed to deactivate');
      toast.success('Account deactivated');
      void loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const formatCurrency = (val: number, currency: string = 'NGN') => 
    new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(val);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="text-sm text-slate-400">Total Accounts</div>
          <div className="mt-2 text-3xl font-bold">{accounts.length}</div>
        </div>
        <div className="flex gap-2">
          <select className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="active">Active accounts</option><option value="inactive">Inactive accounts</option><option value="">All statuses</option>
          </select>
          <select className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" value={depositPolicy} onChange={e => setDepositPolicy(e.target.value)}>
            <option value="">All deposit policies</option><option value="WAIVED">Waived</option><option value="STANDARD">Standard</option>
          </select>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="text-sm text-slate-400">Active Accounts</div>
          <div className="mt-2 text-3xl font-bold">{accounts.filter((a: any) => a.isActive).length}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="text-sm text-slate-400">Total Credit Exposure</div>
          <div className="mt-2 text-3xl font-bold text-blue-400">{formatCurrency(totalCreditExposure)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="text-sm text-slate-400">Total Outstanding</div>
          <div className="mt-2 text-3xl font-bold text-rose-400">{formatCurrency(totalOutstanding)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search company or code..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {canCreate && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Account
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-900/50">
            <TableRow>
              <TableHead>Corporate</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Credit Limit</TableHead>
              <TableHead className="text-right">Outstanding AR</TableHead>
              <TableHead className="text-right">Available Credit</TableHead>
              <TableHead>Deposit Policy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-400">Loading...</TableCell>
              </TableRow>
            ) : filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-400">No corporate accounts found.</TableCell>
              </TableRow>
            ) : filteredAccounts.map((account: any) => {
              const balance = Number(account.cityLedgerAccount?.balance || 0);
              const limit = Number(account.creditLimit || 0);
              const available = Math.max(0, limit - balance);
              
              return (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="font-medium text-slate-200">{account.name}</div>
                    <div className="text-xs text-slate-500">{account.code}</div>
                    {account.cityLedgerAccountId && <div className="text-[10px] text-slate-600">Ledger: {account.cityLedgerAccountId}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{account.contactPerson || '-'}</div>
                    <div className="text-xs text-slate-500">{account.contactEmail}</div>
                  </TableCell>
                  <TableCell className="text-right text-slate-300 font-medium">
                    {formatCurrency(limit)}
                  </TableCell>
                  <TableCell className="text-right text-rose-400">
                    {formatCurrency(balance)}
                  </TableCell>
                  <TableCell className="text-right text-emerald-400">
                    {formatCurrency(available)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      account.depositPolicy === 'WAIVED' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {account.depositPolicy}
                    </span>
                  </TableCell>
                  <TableCell>
                    {account.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400">
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(account)}>
                      {canEdit ? <Pencil className="h-4 w-4 text-slate-400 hover:text-white" /> : <Search className="h-4 w-4 text-slate-400 hover:text-white" />}
                    </Button>
                    
                    {canViewCityLedger && account.cityLedgerAccountId && (
                      <Button variant="ghost" size="sm" asChild title="View City Ledger">
                        {/* We use a relative link assuming the parent component might provide context, but typically we route to a shared AR view or specific shell AR view */}
                        <a href={`/accountant/city-ledger/${account.cityLedgerAccountId}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 text-slate-400 hover:text-blue-400" />
                        </a>
                      </Button>
                    )}

                    {canDeactivate && account.isActive && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeactivate(account.id)} title="Deactivate">
                        <Ban className="h-4 w-4 text-slate-400 hover:text-rose-400" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CorporateAccountDialog 
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => void loadAccounts()}
        account={selectedAccount}
        propertyId={propertyId}
        canEdit={canEdit}
        canChangeFinancials={canChangeFinancials}
        canChangeDepositPolicy={canChangeDepositPolicy}
      />
    </div>
  );
}
