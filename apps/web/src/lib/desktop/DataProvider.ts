export interface LodgeCoreDataProvider {
  auth: {
    getSession: () => Promise<any>;
    provisionDevice: (deviceToken: string) => Promise<any>;
    getActiveStaff: () => Promise<any>;
    login: (staffId: string, pin: string) => Promise<any>;
    clearSession?: () => Promise<any>;
  };
  properties: {
    list(): Promise<any[]>;
  };
  hardware: {
    poll(operationId: string): Promise<any>;
  };
  dashboard: {
    get(propertyId: string): Promise<any>;
  };
  guests: {
    list(): Promise<any[]>;
  };
  roomTypes: {
    list(propertyId: string): Promise<any[]>;
  };
  reservations: {
    list(propertyId: string, params?: any): Promise<any>;
    get(id: string): Promise<any>;
    lookupByRoom(roomNo: string, propertyId: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    cancel(id: string, reason: string): Promise<any>;
    checkIn(id: string, userId: string, deviceId: string): Promise<any>;
    checkOut(id: string, userId: string, deviceId: string): Promise<any>;
    extendStay(id: string, newCheckOutDate: string): Promise<any>;
  };
  rooms: {
    list(propertyId: string, params?: { filter?: string }): Promise<any>;
    getAvailable(propertyId: string, roomTypeId: string, checkIn: string, checkOut: string): Promise<any[]>;
    getActiveReservation(roomId: string): Promise<any | null>;
  };
  folios: {
    get(id: string): Promise<any>;
    addCharge(folioId: string, charge: any): Promise<void>;
    addPayment(folioId: string, payment: any): Promise<void>;
  };
  keycards: {
    encode(roomId: string, lockCode: string, reservationId: string): Promise<any>;
    read(): Promise<any>;
    cancel(): Promise<any>;
  };
  housekeeping: {
    list(propertyId: string): Promise<any[]>;
    updateTask(taskId: string, status: string): Promise<void>;
  };
  maintenance: {
    list(propertyId: string): Promise<any[]>;
    createTicket(data: any): Promise<any>;
    resolveTicket(ticketId: string): Promise<void>;
  };
  receipts: {
    generate(folioId: string): Promise<any>;
  };
  pos: {
    getProducts(propertyId: string): Promise<{ data: any[], error: string | null }>;
    getCategories(propertyId: string): Promise<{ data: any[], error: string | null }>;
    getActiveStaff(propertyId: string): Promise<{ data: any[], error: string | null }>;
    getCurrentOperator(sessionId: string): Promise<{ data: any, error: string | null }>;
    authenticateOperator(staffId: string, pin: string, propertyId: string, sessionId: string, outletId: string, deviceId: string): Promise<{ data: any, error: string | null }>;
    startSession(data: { userId: string; propertyId: string; deviceId: string; outletId: string; openingCash: number }): Promise<{ data: any, error: string | null }>;
    getSessionContext(sessionId: string): Promise<{ data: any, error: string | null }>;
    getAuthorizedOutlets(propertyId: string, deviceId: string): Promise<{ data: { outlets: any[], device: any } | null, error: string | null }>;
    // Phase 1.8 — Restaurant Operations
    getFloorPlans(outletId: string): Promise<{ data: any[], error: string | null }>;
    getTables(floorPlanId: string): Promise<{ data: any[], error: string | null }>;
    getProductModifiers(productId: string): Promise<{ data: any[], error: string | null }>;
    splitCheck(orderId: string, itemIds: string[], userId: string): Promise<{ data: any, error: string | null }>;
    fireKot(orderId: string, itemIds: string[], operatorToken: string): Promise<{ data: any, error: string | null }>;
    createOrder(data: any, operatorToken: string): Promise<{ data: any, error: string | null }>;
    updateOrderStatus(orderId: string, status: string, reason?: string): Promise<{ data: any, error: string | null }>;
    payOrder(orderId: string, paymentData: any, operatorToken: string): Promise<{ data: any, error: string | null }>;
    getOrder(orderId: string): Promise<{ data: any, error: string | null }>;
    getReceipt(orderId: string): Promise<{ data: any, error: string | null }>;
    getServerOrders(range: string, statusFilter: string, sessionId?: string, operatorToken?: string): Promise<{ data: any[], error: string | null }>;
    getServerSales(range: string, sessionId?: string, operatorToken?: string): Promise<{ data: any, error: string | null }>;
    getCashMovements(sessionId: string): Promise<{ data: any[], error: string | null }>;
    createCashMovement(propertyId: string, sessionId: string, amount: number, type: string, reasonCode: string, notes?: string, receiptReference?: string, authorizerId?: string): Promise<{ data: any, error: string | null }>;
    getSessionSettlementDetails(sessionId: string): Promise<{ data: any, error: string | null }>;
    settleSession(sessionId: string, actualCash: number, operatorId: string, authorizerId?: string): Promise<{ data: any, error: string | null }>;
    // Service-first waiter flow
    fireItems(orderId: string, items: any[], operatorToken: string): Promise<{ data: any, error: string | null }>;
    getOpenOrders(sessionId: string, operatorToken?: string): Promise<{ data: any[], error: string | null }>;
    getProductionBatches(outletId: string, station: string): Promise<{ data: any[], error: string | null }>;
    updateBatchStatus(batchId: string, status: string): Promise<{ data: any, error: string | null }>;
  };
}
