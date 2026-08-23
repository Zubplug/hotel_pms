import re
import sys

def main():
    file_path = "apps/web/src/app/api/v1/pos/sync/push/route.ts"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # The block we want to replace is ORDER_CREATED and add ORDER_UPDATED for closing
    # We will find: else if (event.eventType === 'ORDER_CREATED') { ... }
    
    order_created_start = content.find("else if (event.eventType === 'ORDER_CREATED') {")
    order_created_end = content.find("else if (event.eventType === 'PAYMENT_RECORDED') {")
    
    if order_created_start == -1 or order_created_end == -1:
        print("Could not find ORDER_CREATED block")
        sys.exit(1)
        
    new_order_created = """          else if (event.eventType === 'ORDER_CREATED') {
             const existingOrder = await tx.posOrder.findUnique({ where: { id: event.aggregateId }});
             if (!existingOrder) {
                 const tableId = payload.TableId || null;
                 
                 // If the order has a table, try to occupy it atomically
                 if (tableId) {
                     const updateResult = await tx.posTable.updateMany({
                         where: {
                             id: tableId,
                             OR: [
                                 { currentOrderId: null },
                                 { currentOrderId: event.aggregateId }
                             ]
                         },
                         data: { currentOrderId: event.aggregateId }
                     });
                     
                     if (updateResult.count === 0) {
                         // Table is already occupied by someone else! Conflict.
                         await tx.syncConflict.create({
                             data: {
                                 propertyId,
                                 aggregateType: 'POS_ORDER',
                                 aggregateId: event.aggregateId,
                                 conflictReason: `Table ${tableId} is already occupied by another order.`,
                                 localData: payload,
                                 cloudData: {},
                                 status: 'PENDING'
                             }
                         });
                         // We must throw to trigger the CONFLICT state in the desktop's sync engine
                         const e = new Error('CONCURRENCY_CONFLICT');
                         (e as any).currentVersion = currentVersion;
                         throw e;
                     }
                 }
                 
                 await tx.posOrder.create({
                     data: {
                         id: event.aggregateId,
                         propertyId: propertyId,
                         outletId: payload.OutletId || terminal.outletId,
                         sessionId: payload.SessionId,
                         orderNumber: payload.OrderNumber,
                         status: payload.Status || 'SUBMITTED',
                         subtotal: payload.Subtotal || 0,
                         taxAmount: payload.TaxAmount || 0,
                         total: payload.Total || 0,
                         tableId: tableId,
                         businessDate: new Date(payload.BusinessDate || new Date()),
                         serverStaffId: event.operatorId,
                         createdAt: new Date(event.occurredAt)
                     }
                 });
             }
          }
          else if (event.eventType === 'ORDER_UPDATED') {
              await tx.posOrder.update({
                  where: { id: event.aggregateId },
                  data: { status: payload.status || payload.Status, notes: payload.notes || payload.Notes, updatedAt: new Date() }
              });
              
              const newStatus = payload.status || payload.Status;
              if (newStatus === 'CLOSED' || newStatus === 'CANCELLED' || newStatus === 'VOIDED') {
                  await tx.posTable.updateMany({
                      where: { currentOrderId: event.aggregateId },
                      data: { currentOrderId: null }
                  });
              }
          }
          """
    
    new_content = content[:order_created_start] + new_order_created + content[order_created_end:]
    
    # We also need to patch ORDER_CLOSED to release the table
    order_closed_start = new_content.find("else if (event.eventType === 'ORDER_CLOSED') {")
    order_closed_end = new_content.find("else if (event.eventType === 'ORDER_ITEMS_ADDED') {")
    
    if order_closed_start != -1 and order_closed_end != -1:
        new_order_closed = """else if (event.eventType === 'ORDER_CLOSED') {
              await tx.posOrder.update({
                  where: { id: event.aggregateId },
                  data: { status: "CLOSED", updatedAt: new Date() }
              });
              await tx.posTable.updateMany({
                  where: { currentOrderId: event.aggregateId },
                  data: { currentOrderId: null }
              });
          }
          """
        new_content = new_content[:order_closed_start] + new_order_closed + new_content[order_closed_end:]

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print("Successfully patched route.ts")

if __name__ == "__main__":
    main()
