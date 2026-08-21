import { LodgeCoreDataProvider } from './DataProvider';
import { invokeDesktop } from './IpcBridge';

export const DesktopDataProvider: LodgeCoreDataProvider = {
  auth: {
    getSession: async () => {
      return invokeDesktop('auth.getSession');
    },
    provisionDevice: async (deviceToken: string) => {
      return invokeDesktop('auth.provisionDevice', { deviceToken });
    },
    getActiveStaff: async () => {
      return invokeDesktop('auth.getActiveStaff');
    },
    login: async (staffId: string, pin: string, bankingModel?: string) => {
      return invokeDesktop('auth.login', { staffId, pin, bankingModel });
    },
    logout: async () => {
      return invokeDesktop('auth.logout');
    },
    lock: async () => {
      return invokeDesktop('auth.lock');
    },
    clearSession: async () => {
      return invokeDesktop('auth.clearSession');
    }
  },
  system: {
    getTerminalStatus: async () => {
      return invokeDesktop('system.getTerminalStatus');
    },
    provisionTerminal: async (data: any) => {
      return invokeDesktop('system.provisionTerminal', data);
    }
  },
  properties: {
    list: () => invokeDesktop('properties.list')
  },
  hardware: {
    poll: async (operationId) => {
      // In offline mode, hardware operations are usually synchronous or handled directly via IPC,
      // but we return success to mimic the polling interface if used.
      return { status: 'COMPLETED' };
    }
  },
  dashboard: {
    async get(propertyId: string) {
      return invokeDesktop('dashboard.get', { propertyId });
    }
  },
  guests: {
    async list() {
      return invokeDesktop('guests.list');
    }
  },
  roomTypes: {
    async list(propertyId: string) {
      return invokeDesktop('roomTypes.list', { propertyId });
    }
  },
  reservations: {
    list: async (propertyId, params) => {
      return invokeDesktop('reservations.list', { propertyId, ...params });
    },
    get: async (id) => {
      return invokeDesktop('reservations.get', { id });
    },
    lookupByRoom: async (roomNo, propertyId) => {
      return invokeDesktop('reservations.lookupByRoom', { roomNo, propertyId });
    },
    create: async (data) => {
      return invokeDesktop('reservations.create', { data });
    },
    update: async (id, data) => {
      return invokeDesktop('reservations.update', { id, data });
    },
    cancel: async (id, reason) => {
      return invokeDesktop('reservations.cancel', { id, reason });
    },
    checkIn: async (id, userId, deviceId) => {
      return invokeDesktop('reservations.checkIn', { reservationId: id, userId, deviceId });
    },
    checkOut: async (id, userId, deviceId) => {
      return invokeDesktop('reservations.checkOut', { reservationId: id, userId, deviceId });
    },
    extendStay: async (id, newCheckOutDate) => {
      return invokeDesktop('reservations.extendStay', { reservationId: id, newCheckOutDate });
    }
  },
  rooms: {
    list: async (propertyId, params) => {
      return invokeDesktop('rooms.list', { propertyId, ...params });
    },
    getAvailable: async (propertyId, roomTypeId, checkIn, checkOut) => {
      return invokeDesktop('rooms.getAvailable', { propertyId, roomTypeId, checkIn, checkOut });
    },
    getActiveReservation: async (roomId) => {
      return invokeDesktop('rooms.getActiveReservation', { roomId });
    }
  },
  folios: {
    get: async (id) => {
      return invokeDesktop('folios.get', { id });
    },
    addCharge: async (folioId, charge) => {
      return invokeDesktop('folios.addCharge', { folioId, charge });
    },
    addPayment: async (folioId, payment) => {
      return invokeDesktop('folios.addPayment', { folioId, payment });
    }
  },
  keycards: {
    encode: async (roomId, lockCode, reservationId) => {
      return invokeDesktop('keycards.encode', { roomId, lockCode, reservationId });
    },
    read: async () => {
      return invokeDesktop('keycards.read');
    },
    cancel: async () => {
      return invokeDesktop('keycards.cancel');
    }
  },
  housekeeping: {
    list: async (propertyId) => {
      return invokeDesktop('housekeeping.list', { propertyId });
    },
    updateTask: async (taskId, status) => {
      return invokeDesktop('housekeeping.updateTask', { taskId, status });
    }
  },
  maintenance: {
    list: async (propertyId) => {
      return invokeDesktop('maintenance.list', { propertyId });
    },
    createTicket: async (data) => {
      return invokeDesktop('maintenance.createTicket', { data });
    },
    resolveTicket: async (ticketId) => {
      return invokeDesktop('maintenance.resolveTicket', { ticketId });
    }
  },
  receipts: {
    generate: async (folioId) => {
      return invokeDesktop('receipts.generate', { folioId });
    }
  },
  pos: {
    getProducts: async (propertyId: string) => {
      return invokeDesktop('pos.getProducts', { propertyId });
    },
    getCategories: async (propertyId: string) => {
      return invokeDesktop('pos.getCategories', { propertyId });
    },
    getActiveStaff: async (propertyId: string) => {
      return invokeDesktop('pos.getActiveStaff', { propertyId });
    },
    validateSupervisorPin: async (pin: string, propertyId?: string) => { return invokeDesktop("pos.validateSupervisorPin", { pin, propertyId }); },

    getCurrentOperator: async (sessionId: string, operatorToken?: string | null) => {
      return invokeDesktop('pos.getCurrentOperator', { sessionId });
    },
    authenticateOperator: async (staffId: string, pin: string, propertyId: string, sessionId: string, outletId: string, deviceId: string) => {
      return invokeDesktop('pos.authenticateOperator', { staffId, pin, propertyId, sessionId, outletId, deviceId });
    },
    startSession: async (data: { userId: string; propertyId: string; deviceId: string; outletId: string; openingCash: number }) => {
      return invokeDesktop('pos.startSession', data);
    },
    startEmergencyBank: async (pin: string, reason: string, operatorToken: string) => {
      return invokeDesktop('pos.startEmergencyBank', { pin, reason, operatorToken });
    },
    getSessionContext: async (sessionId: string) => {
      return invokeDesktop('pos.getSessionContext', { sessionId });
    },
    getAuthorizedOutlets: async (propertyId: string, deviceId: string) => {
      return invokeDesktop('pos.getAuthorizedOutlets', { propertyId, deviceId });
    },
    getFloorPlans: async (outletId: string, operatorToken?: string | null) => {
      return invokeDesktop('pos.getFloorPlans', { outletId });
    },
    getTables: async (floorPlanId: string) => {
      return invokeDesktop('pos.getTables', { floorPlanId });
    },
    getProductModifiers: async (productId: string) => {
      return invokeDesktop('pos.getProductModifiers', { productId });
    },
    splitCheck: async (orderId: string, itemIds: string[], userId: string) => {
      return invokeDesktop('pos.splitCheck', { orderId, itemIds, userId });
    },
    fireKot: async (orderId: string, itemIds: string[], operatorToken: string) => {
      return invokeDesktop('pos.fireKot', { orderId, itemIds, operatorToken });
    },
    createOrder: async (data: any, operatorToken: string) => {
      return invokeDesktop('pos.createOrder', { data, operatorToken });
    },
    updateOrderStatus: async (orderId: string, status: string, reason?: string) => {
      return invokeDesktop('pos.updateOrderStatus', { orderId, status, reason });
    },
    payOrder: async (orderId: string, paymentData: any, operatorToken: string) => {
      return invokeDesktop('pos.payOrder', { orderId, paymentData, operatorToken });
    },
    getOrder: async (orderId: string) => {
      return invokeDesktop('pos.getOrder', { orderId });
    },
    getReceipt: async (orderId: string) => {
      return invokeDesktop('pos.getReceipt', { orderId });
    },
    getServerOrders: async (range: string, statusFilter: string, sessionId?: string, operatorToken?: string) => {
      return invokeDesktop('pos.getServerOrders', { range, statusFilter, sessionId, operatorToken });
    },
    getServerSales: async (range: string, sessionId?: string, operatorToken?: string) => {
      return invokeDesktop('pos.getServerSales', { range, sessionId, operatorToken });
    },
    getCashMovements: async (sessionId: string) => {
      return invokeDesktop('pos.getCashMovements', { sessionId });
    },
    createCashMovement: async (propertyId: string, sessionId: string, amount: number, type: string, reasonCode: string, notes?: string, receiptReference?: string, authorizerId?: string) => {
      return invokeDesktop('pos.createCashMovement', { propertyId, sessionId, amount, type, reasonCode, notes, receiptReference, authorizerId });
    },
    getSessionSettlementDetails: async (sessionId: string) => {
      return invokeDesktop('pos.getSessionSettlementDetails', { sessionId });
    },
    settleSession: async (sessionId: string, actualCash: number, operatorId: string, authorizerId?: string) => {
      // In offline mode, we just pass actualCash. cashPaidOut is legacy.
      return invokeDesktop('pos.closeSession', { sessionId, actualCash, cashPaidOut: 0 });
    },
    confirmHandover: async (sessionId: string, managerPin: string) => {
      return invokeDesktop('pos.confirmHandover', { sessionId, managerPin });
    },
    getPendingHandovers: async (propertyId: string) => {
      return invokeDesktop('pos.getPendingHandovers', { propertyId });
    },
    getCashOfficeOverview: async (propertyId: string) => {
      return invokeDesktop('pos.getCashOfficeOverview', { propertyId });
    },
    openSafe: async (propertyId: string, amount: number, managerPin: string) => {
      return invokeDesktop('pos.openSafe', { propertyId, amount, managerPin });
    },
    getSafeLedger: async (propertyId: string) => {
      return invokeDesktop('pos.getSafeLedger', { propertyId });
    },
    recordBankDeposit: async (propertyId: string, amount: number, reference: string, managerPin: string) => {
      return invokeDesktop('pos.recordBankDeposit', { propertyId, amount, reference, managerPin });
    },
    // Service-first waiter flow
    fireItems: async (orderId: string, items: any[], operatorToken: string) => {
      return invokeDesktop('pos.fireItems', { orderId, items, operatorToken });
    },
    getActiveOrders: async (sessionId: string, operatorToken: string, filter?: string) => {
      return invokeDesktop('pos.getActiveOrders', { sessionId, operatorToken, filter });
    },
    getProductionBatches: async (outletId: string, station: string) => {
      return invokeDesktop('pos.getProductionBatches', { outletId, station });
    },
    updateBatchStatus: async (batchId: string, status: string) => {
      return invokeDesktop('pos.updateBatchStatus', { batchId, status });
    },
  }
};
