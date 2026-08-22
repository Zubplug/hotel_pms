import { invokeDesktop } from './IpcBridge';

export interface ReceiptData {
  orderNumber: string;
  tableName?: string;
  items: { name: string; quantity: number; unitPrice: number; total: number; modifiers?: string[] }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  cashTendered?: number;
  change?: number;
  operatorName: string;
  outletName: string;
  printedAt: string;
}

export interface KitchenTicketData {
  orderNumber: string;
  tableName?: string;
  station: 'KITCHEN' | 'BAR';
  items: { name: string; quantity: number; modifiers?: string[]; course?: number }[];
  firedAt: string;
  operatorName: string;
  batchNumber: number;
}

export interface KdsOrderData {
  orderId: string;
  orderNumber: string;
  tableName?: string;
  items: { id: string; name: string; quantity: number; station: string; modifiers?: string[]; course?: number }[];
  firedAt: string;
  status: string;
}

export const HardwareBridge = {
  isAvailable: () => typeof window !== 'undefined' && !!(window as any).chrome?.webview,
  
  readCard: async () => {
    return invokeDesktop('hardware.readCard');
  },
  
  encodeCard: async (lockCode: string) => {
    return invokeDesktop('hardware.encodeCard', { lockCode });
  },
  
  cancelCard: async () => {
    return invokeDesktop('hardware.cancelCard');
  },

  // Cash Drawer
  openCashDrawer: async () => {
    return invokeDesktop('hardware.openCashDrawer');
  },

  // Receipt Printer
  printReceipt: async (receiptData: ReceiptData) => {
    return invokeDesktop('hardware.printReceipt', { receipt: receiptData });
  },

  printKitchenTicket: async (ticketData: KitchenTicketData) => {
    return invokeDesktop('hardware.printKitchenTicket', { ticket: ticketData });
  },

  // KDS (Kitchen Display System)
  sendToKds: async (orderData: KdsOrderData) => {
    return invokeDesktop('hardware.sendToKds', { order: orderData });
  },

  updateKdsStatus: async (orderId: string, itemId: string, status: string) => {
    return invokeDesktop('hardware.updateKdsStatus', { orderId, itemId, status });
  },

  // Front Desk Printing
  printRegistrationCard: async (data: { reservationId: string, guestName: string, checkInVersion: number, details: any }) => {
    return invokeDesktop('hardware.printRegistrationCard', { data });
  },

  printGuestFolio: async (data: { folioId: string, guestName: string, version: number, details: any }) => {
    return invokeDesktop('hardware.printGuestFolio', { data });
  },

  printPaymentReceipt: async (data: { paymentId: string, amount: number, method: string, guestName: string, version: number }) => {
    return invokeDesktop('hardware.printPaymentReceipt', { data });
  },

  testPrinter: async () => {
    return invokeDesktop('hardware.testPrinter');
  },

  getPrinterStatus: async () => {
    return invokeDesktop('hardware.getPrinterStatus');
  },
};
