import { invokeDesktop } from './IpcBridge';

export interface ReceiptData {
  orderNumber: string;
  tableNumber?: string;
  items: { name: string; quantity: number; unitPrice: number; total: number; modifiers?: string[] }[];
  subtotal: number;
  taxAmount: number;
  serviceCharge?: number;
  tipAmount?: number;
  total: number;
  paymentMethod: string;
  currency: string;
  serverName?: string;
  outletName: string;
  propertyName?: string;
  propertyAddress?: string;
  printedAt: string;
  isReprint?: boolean;
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

/** Converts both the desktop audit receipt and the online order receipt into
 * the stable printer payload. The desktop audit shape intentionally differs
 * from the customer-facing print shape. */
export function toReceiptPrintData(source: any, isReprint = false): ReceiptData {
  const receipt = source?.data ?? source ?? {};
  const payment = receipt.payments?.[receipt.payments.length - 1] ?? {};
  const audit = receipt.auditChain ?? {};
  const outlet = receipt.outlet ?? {};
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const orderId = String(receipt.orderNumber ?? receipt.OrderNumber ?? receipt.id ?? receipt.orderId ?? 'UNKNOWN');
  const paymentReceiptNumber = payment.receiptNumber ?? payment.ReceiptNumber;
  const paymentId = String(payment.id ?? payment.Id ?? '');
  const receiptNumber = String(
    paymentReceiptNumber ||
    (paymentId ? `RCP-${paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase()}` : '') ||
    (orderId && orderId !== 'UNKNOWN' ? `RCP-${orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-12).toUpperCase()}` : 'RCP-UNKNOWN')
  );

  return {
    // The desktop print contract historically uses OrderNumber for the
    // printed Receipt # field. Feed it the immutable receipt reference so
    // legacy orders with a blank order number still print an auditable ID.
    orderNumber: receiptNumber,
    tableNumber: receipt.tableNumber ?? receipt.tableName,
    items: items.map((item: any) => ({
      name: item.productName ?? item.name ?? 'Item',
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      total: Number(item.total ?? 0),
      modifiers: (item.modifiers ?? []).map((modifier: any) => modifier.name ?? modifier.Name ?? String(modifier)),
    })),
    subtotal: Number(receipt.subtotal ?? 0),
    taxAmount: Number(receipt.taxAmount ?? receipt.tax ?? 0),
    serviceCharge: Number(receipt.serviceCharge ?? 0),
    tipAmount: Number(receipt.tipAmount ?? 0),
    total: Number(receipt.total ?? 0),
    paymentMethod: payment.method ?? payment.Method ?? receipt.paymentMethod ?? 'PAID',
    currency: payment.currency ?? receipt.currency ?? 'NGN',
    serverName: receipt.serverName ?? audit.serverName ?? 'POS Operator',
    outletName: receipt.outletName ?? audit.outletName ?? outlet.name ?? 'LodgeCore POS',
    propertyName: receipt.propertyName ?? audit.propertyName,
    propertyAddress: receipt.propertyAddress ?? audit.propertyAddress,
    printedAt: receipt.printedAt ?? new Date().toISOString(),
    isReprint,
  };
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

  printGuestFolio: async (data: { guestName: string, roomNumber: string, folioNumber: string, arrivalDate: string, departureDate: string, transactions: any[], totalCharges: number, totalPayments: number, balanceDue: number, currency: string, propertyName?: string, propertyAddress?: string, printedAt: string }) => {
    return invokeDesktop('hardware.printGuestFolio', { data });
  },

  printPaymentReceipt: async (data: { receiptNumber: string, guestName: string, roomNumber: string, folioNumber: string, amountPaid: number, paymentMethod: string, paymentReference?: string, previousBalance: number, remainingBalance: number, cashierName: string, currency: string, propertyName: string, propertyAddress?: string, printedAt: string }) => {
    return invokeDesktop('hardware.printPaymentReceipt', { data });
  },

  printShiftReport: async (data: { staffName: string, ordersCount: number, grossSales: number, netSales: number, cashSales: number, cardSales: number, roomCharges: number, totalDiscounts: number, currency: string, printedAt: string }) => {
    return invokeDesktop('hardware.printShiftReport', { data });
  },

  testPrinter: async (printerConfig: any) => {
    return invokeDesktop('hardware.testPrinter', { config: JSON.stringify(printerConfig) });
  },

  getAvailablePrinters: async () => {
    return invokeDesktop('hardware.getAvailableHardwarePrinters');
  },

  getPrinterStatus: async () => {
    return invokeDesktop('hardware.getPrinterStatus');
  },
};
