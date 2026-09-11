'use client';

import { LaundryOrdersClient } from '@/app/(frontdesk)/laundry/orders/client';

export default function GeneralManagerLaundryOrdersPage() {
  return <LaundryOrdersClient managementMode />;
}
