export interface LodgeCoreDataProvider {
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
    list(propertyId: string, params?: { search?: string, filter?: string }): Promise<any[]>;
    get(id: string): Promise<any>;
    lookupByRoom(roomNo: string, propertyId: string): Promise<any | null>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    cancel(id: string, reason: string): Promise<void>;
    checkIn(id: string, userId: string, deviceId: string): Promise<void>;
    checkOut(id: string, userId: string, deviceId: string): Promise<void>;
    extendStay(id: string, newCheckOutDate: string): Promise<void>;
  };
  rooms: {
    list(propertyId: string, params?: { filter?: string }): Promise<any[]>;
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
}
