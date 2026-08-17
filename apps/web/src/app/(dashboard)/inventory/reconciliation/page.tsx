'use client';
import React, { useState } from 'react';

export default function InventoryReconciliationPage() {
  const [physicalCount, setPhysicalCount] = useState('');
  const [reason, setReason] = useState('MISCOUNT');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');

  const handleReconcile = async () => {
    setStatus('Submitting...');
    try {
      const res = await fetch('/api/v1/inventory/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: '',
          stockItemId: 'test-item-id', // Would be pulled from URL query or selection
          physicalCount: Number(physicalCount),
          reason,
          notes,
          userId: 'test-user-id'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Success! Variance adjusted: ${data.data.variance}`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Inventory Reconciliation</h1>
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="font-semibold mb-4 text-lg">Adjust Stock Item</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Physical Count</label>
            <input 
              type="number" 
              value={physicalCount}
              onChange={(e) => setPhysicalCount(e.target.value)}
              className="w-full border rounded-md p-2" 
              placeholder="Enter physical count..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason Code</label>
            <select 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded-md p-2"
            >
              <option value="SPOILAGE">Spoilage</option>
              <option value="THEFT">Theft</option>
              <option value="DAMAGE">Damage</option>
              <option value="MISCOUNT">Miscount</option>
              <option value="WASTE">Waste</option>
              <option value="EXPIRY">Expiry</option>
              <option value="OPENING_BALANCE">Opening Balance</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Required for OTHER)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-md p-2" 
              rows={3}
              placeholder="Additional details..."
            />
          </div>
          
          <button 
            onClick={handleReconcile}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Submit for Manager Approval
          </button>
          
          {status && <p className="mt-4 text-sm font-medium">{status}</p>}
        </div>
      </div>
    </div>
  );
}
