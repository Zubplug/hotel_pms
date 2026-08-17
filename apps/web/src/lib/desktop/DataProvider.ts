export interface LodgeCoreDataProvider {
  auth: {
    getSession: () => Promise<any>;
    provisionDevice: (userId: string, propertyId: string, role: string, deviceToken: string, permissions?: string[], sessionVersion?: number) => Promise<any>;
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
    encode(roomId: string, guestName: string, checkIn: string, checkOut: string): Promise<any>;
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
    authenticateOperator(staffId: string, pin: string, propertyId: string, sessionId: string): Promise<{ data: any, error: string | null }>;
  };
}
