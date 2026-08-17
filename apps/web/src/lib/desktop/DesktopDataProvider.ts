import { LodgeCoreDataProvider } from './DataProvider';
import { invokeDesktop } from './IpcBridge';

export const DesktopDataProvider: LodgeCoreDataProvider = {
  auth: {
    getSession: async () => {
      return invokeDesktop('auth.getSession');
    },
    provisionDevice: async (userId: string, propertyId: string, role: string, deviceToken: string, permissions: string[] = [], sessionVersion: number = 1) => {
      return invokeDesktop('auth.provisionDevice', { userId, propertyId, role, deviceToken, permissions, sessionVersion });
    },
    clearSession: async () => {
      return invokeDesktop('auth.clearSession');
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
    encode: async (roomId, guestName, checkIn, checkOut) => {
      return invokeDesktop('keycards.encode', { roomId, guestName, checkIn, checkOut });
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
    getCurrentOperator: async (sessionId: string) => {
      return invokeDesktop('pos.getCurrentOperator', { sessionId });
    },
    authenticateOperator: async (staffId: string, pin: string, propertyId: string, sessionId: string) => {
      return invokeDesktop('pos.authenticateOperator', { staffId, pin, propertyId, sessionId });
    },
    startSession: async (data: { userId: string; propertyId: string; deviceId: string; outletId: string; openingCash: number }) => {
      return invokeDesktop('pos.startSession', data);
    },
    getSessionContext: async (sessionId: string) => {
      return invokeDesktop('pos.getSessionContext', { sessionId });
    },
    getAuthorizedOutlets: async (propertyId: string, deviceId: string) => {
      return invokeDesktop('pos.getAuthorizedOutlets', { propertyId, deviceId });
    },
    getFloorPlans: async (outletId: string) => {
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
      return invokeDesktop('pos.settleSession', { sessionId, actualCash, operatorId, authorizerId });
    },
  }
};
