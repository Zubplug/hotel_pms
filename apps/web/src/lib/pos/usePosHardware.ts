import { HardwareBridge, ReceiptData, KitchenTicketData, KdsOrderData } from '@/lib/desktop/HardwareBridge';

/**
 * React hook that wraps HardwareBridge for use in POS components.
 * All methods are safe no-ops when running outside the desktop app.
 */
export function usePosHardware() {
  const isDesktopApp = HardwareBridge.isAvailable();

  const openCashDrawer = async (): Promise<void> => {
    if (!isDesktopApp) return;
    try {
      await HardwareBridge.openCashDrawer();
    } catch (err) {
      console.error('[HardwareBridge] openCashDrawer failed:', err);
    }
  };

  const printReceipt = async (data: ReceiptData): Promise<void> => {
    if (!isDesktopApp) return;
    try {
      await HardwareBridge.printReceipt(data);
    } catch (err) {
      console.error('[HardwareBridge] printReceipt failed:', err);
    }
  };

  const printKitchenTicket = async (data: KitchenTicketData): Promise<void> => {
    if (!isDesktopApp) return;
    try {
      await HardwareBridge.printKitchenTicket(data);
    } catch (err) {
      console.error('[HardwareBridge] printKitchenTicket failed:', err);
    }
  };

  const sendToKds = async (data: KdsOrderData): Promise<void> => {
    if (!isDesktopApp) return;
    try {
      await HardwareBridge.sendToKds(data);
    } catch (err) {
      console.error('[HardwareBridge] sendToKds failed:', err);
    }
  };

  const updateKdsStatus = async (orderId: string, itemId: string, status: string): Promise<void> => {
    if (!isDesktopApp) return;
    try {
      await HardwareBridge.updateKdsStatus(orderId, itemId, status);
    } catch (err) {
      console.error('[HardwareBridge] updateKdsStatus failed:', err);
    }
  };

  return {
    isDesktopApp,
    openCashDrawer,
    printReceipt,
    printKitchenTicket,
    sendToKds,
    updateKdsStatus,
  };
}
