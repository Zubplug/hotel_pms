/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { CorporateAccountManagement } from '@/components/corporate/CorporateAccountManagement';
import { redirect } from 'next/navigation';

export async function CorporatePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  
  const propertyId = (session.user as any).propertyId;
  if (!propertyId) {
    return <div className="p-6 text-white">No active property context.</div>;
  }

  const userId = session.user.id;
  const canView = await hasPermission(userId, propertyId, 'corporate_account:view');
  if (!canView) {
    return <div className="p-6 text-white">You do not have permission to view corporate accounts.</div>;
  }

  const canCreate = await hasPermission(userId, propertyId, 'corporate_account:create');
  const canEdit = await hasPermission(userId, propertyId, 'corporate_account:edit');
  const canChangeFinancials = await hasPermission(userId, propertyId, 'corporate_account:change_credit_limit');
  const canChangeDepositPolicy = await hasPermission(userId, propertyId, 'corporate_account:change_deposit_policy');
  const canDeactivate = await hasPermission(userId, propertyId, 'corporate_account:deactivate');
  const canViewCityLedger = await hasPermission(userId, propertyId, 'corporate_account:view_city_ledger');

  return (
    <div>
      <CorporateAccountManagement 
        propertyId={propertyId} 
        canCreate={canCreate}
        canEdit={canEdit}
        canChangeFinancials={canChangeFinancials}
        canChangeDepositPolicy={canChangeDepositPolicy}
        canDeactivate={canDeactivate}
        canViewCityLedger={canViewCityLedger}
      />
    </div>
  );
}
