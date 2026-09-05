'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { RequestResolutionModal } from '@/components/cash-management/request-resolution-modal';
import { ApproveResolutionModal } from '@/components/cash-management/approve-resolution-modal';

export default function TransactionExceptionsPage() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const user = session?.user as any;
  const [activeTab, setActiveTab] = useState('OPEN');
  
  const [selectedException, setSelectedException] = useState<any>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  const canApprove = ['MANAGER', 'ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');

  // Fetch exceptions based on active tab status
  // We map tabs to status: 'OPEN' -> OPEN & REJECTED, 'PENDING_APPROVAL' -> PENDING_APPROVAL, 'RESOLVED' -> APPROVED
  const queryStatus = activeTab === 'OPEN' ? 'OPEN' : activeTab;
  
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['transaction-exceptions', propertyId],
    queryFn: async () => {
      if (!propertyId) return { data: [] };
      const res = await fetch(`/api/v1/cash-management/transaction-exceptions?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!propertyId
  });

  if (!propertyId) return null;

  const exceptions = data?.data || [];
  
  const openExceptions = exceptions.filter((e: any) => e.status === 'OPEN' || e.status === 'REJECTED');
  const pendingExceptions = exceptions.filter((e: any) => e.status === 'PENDING_APPROVAL');
  const resolvedExceptions = exceptions.filter((e: any) => e.status === 'APPROVED');

  const getDisplayList = () => {
    if (activeTab === 'OPEN') return openExceptions;
    if (activeTab === 'PENDING_APPROVAL') return pendingExceptions;
    return resolvedExceptions;
  };

  const displayList = getDisplayList();

  const handleRequestResolution = (exception: any) => {
    setSelectedException(exception);
    setIsRequestModalOpen(true);
  };

  const handleApproveResolution = (exception: any) => {
    setSelectedException(exception);
    setIsApproveModalOpen(true);
  };

  const onActionComplete = () => {
    refetch();
    setIsRequestModalOpen(false);
    setIsApproveModalOpen(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Transaction Exceptions</h1>
        <p className="text-sm text-gray-500 mt-1">Review and resolve questioned transactions from the Night Audit.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="OPEN">
            Awaiting Resolution
            {openExceptions.length > 0 && (
              <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0">{openExceptions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="PENDING_APPROVAL">
            Awaiting Approval
            {pendingExceptions.length > 0 && (
              <Badge variant="destructive" className="ml-2 rounded-full px-1.5 py-0">{pendingExceptions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="APPROVED">History</TabsTrigger>
        </TabsList>

        <div className="mt-6 border rounded-lg overflow-hidden bg-white shadow-sm">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500 flex flex-col items-center">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              Failed to load exceptions.
            </div>
          ) : displayList.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No exceptions found in this category.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayList.map((exc: any) => {
                  const tx = exc.payment || exc.posPayment;
                  const isPayment = !!exc.payment;
                  const currency = tx?.currency || 'NGN';
                  const amount = tx?.amount || 0;
                  const source = isPayment ? 'Front Desk' : 'POS';

                  return (
                    <tr key={exc.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(exc.questionedAt), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatCurrency(amount, currency)}</div>
                        <div className="text-xs text-gray-500">{tx?.method} • {tx?.reference || 'No Ref'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {source}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={exc.status === 'REJECTED' ? 'destructive' : exc.status === 'PENDING_APPROVAL' ? 'secondary' : 'outline'}>
                          {exc.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {(exc.status === 'OPEN' || exc.status === 'REJECTED') && (
                          <Button size="sm" variant="outline" onClick={() => handleRequestResolution(exc)}>
                            Resolve
                          </Button>
                        )}
                        {exc.status === 'PENDING_APPROVAL' && canApprove && (
                          <Button size="sm" onClick={() => handleApproveResolution(exc)}>
                            Review
                          </Button>
                        )}
                        {exc.status === 'PENDING_APPROVAL' && !canApprove && (
                          <span className="text-gray-400 text-xs">Waiting Approval</span>
                        )}
                        {exc.status === 'APPROVED' && (
                          <span className="text-green-600 text-xs font-medium">Resolved</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Tabs>

      {isRequestModalOpen && selectedException && (
        <RequestResolutionModal
          exception={selectedException}
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          onSuccess={onActionComplete}
        />
      )}

      {isApproveModalOpen && selectedException && (
        <ApproveResolutionModal
          exception={selectedException}
          isOpen={isApproveModalOpen}
          onClose={() => setIsApproveModalOpen(false)}
          onSuccess={onActionComplete}
        />
      )}
    </div>
  );
}
