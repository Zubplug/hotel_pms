import React, { useState } from 'react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { toast } from 'sonner';
import { ManagerOverrideModal } from './ManagerOverrideModal';

interface EmergencyCashBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
  operatorToken: string;
}

export function EmergencyCashBankModal({ isOpen, onClose, onSuccess, operatorToken }: EmergencyCashBankModalProps) {
  const provider = useLodgeCoreProvider();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAuthorized = async (managerId: string, managerPin: string, reason: string) => {
    setIsProcessing(true);
    try {
      const openRes = await provider.pos.startEmergencyBank(
        managerId,
        managerPin,
        reason,
        operatorToken
      );

      if (openRes.error) {
        toast.error(openRes.error);
      } else if (openRes.data?.sessionId) {
        toast.success('Emergency Bank Opened Successfully');
        onSuccess(openRes.data.sessionId);
        onClose();
      } else {
        toast.error('Failed to open emergency bank.');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ManagerOverrideModal
      isOpen={isOpen && !isProcessing}
      actionName="Open Emergency POS Bank"
      onAuthorized={handleAuthorized}
      onCancel={onClose}
    />
  );
}
