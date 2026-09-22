import React from 'react';
import FnbAnalyticsClient from './client';

export const metadata = { title: 'F&B Dashboard' };

export default function FnbGeneralDashboardPage() {
  return <div className="fnb-dark-surface min-h-full"><FnbAnalyticsClient /></div>;
}
