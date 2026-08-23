import sys
import re

def main():
    file_path = "apps/desktop/LodgeCore.Desktop/Services/LocalRepository.cs"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update CreatePosOrderAsync
    # We want to find:
    #         if (!string.IsNullOrEmpty(order.FolioId))
    # And insert our Table occupancy check before it, right after adding the order and its outbox event.
    
    order_created_sync = 'AppendSyncEvent("POS_ORDER", order.Id, "ORDER_CREATED", order, deviceId, order.OutletId, order.SessionId, userId);'
    if order_created_sync not in content:
        print("Could not find order_created_sync in LocalRepository.cs")
        sys.exit(1)
        
    table_occupancy_logic = """
        if (!string.IsNullOrEmpty(order.TableId))
        {
            var table = await _dbContext.PosTables.FirstOrDefaultAsync(t => t.Id == order.TableId);
            if (table != null)
            {
                if (!string.IsNullOrEmpty(table.CurrentOrderId) && table.CurrentOrderId != order.Id)
                {
                    throw new Exception("Table is already occupied by another order");
                }
                table.CurrentOrderId = order.Id;
                table.UpdatedAt = DateTime.UtcNow;
                // Note: we don't need a separate sync event for table update since cloud ORDER_CREATED takes care of it
            }
        }
"""
    
    content = content.replace(order_created_sync, order_created_sync + "\n" + table_occupancy_logic)

    # 2. Update UpdateOrderStatusAsync
    # We want to clear table if status == CLOSED | CANCELLED | VOIDED
    
    status_updated_sync = 'AppendSyncEvent("POS_ORDER", order.Id, status == "CLOSED" ? "ORDER_CLOSED" : "ORDER_UPDATED", new { status = order.Status, notes = order.Notes, updatedAt = order.UpdatedAt }, deviceId, order.OutletId, order.SessionId, userId);'
    
    if status_updated_sync not in content:
        print("Could not find status_updated_sync in LocalRepository.cs")
        sys.exit(1)
        
    table_release_logic = """
        if (status == "CLOSED" || status == "CANCELLED" || status == "VOIDED")
        {
            var table = await _dbContext.PosTables.FirstOrDefaultAsync(t => t.CurrentOrderId == order.Id);
            if (table != null)
            {
                table.CurrentOrderId = null;
                table.UpdatedAt = DateTime.UtcNow;
            }
        }
"""
    content = content.replace(status_updated_sync, status_updated_sync + "\n" + table_release_logic)

    # 3. Update GetTablesAsync
    # Replace the existing Task<List<LocalPosTable>> GetTablesAsync with Task<List<object>>
    
    get_tables_orig = """    public async Task<List<LocalPosTable>> GetTablesAsync(string floorPlanId)
    {
        return await _dbContext.PosTables
            .Where(t => t.FloorPlanId == floorPlanId)
            .ToListAsync();
    }"""
    
    get_tables_new = """    public async Task<List<object>> GetTablesAsync(string floorPlanId)
    {
        var tables = await _dbContext.PosTables
            .Where(t => t.FloorPlanId == floorPlanId)
            .ToListAsync();
            
        var orderIds = tables.Where(t => !string.IsNullOrEmpty(t.CurrentOrderId)).Select(t => t.CurrentOrderId).Distinct().ToList();
        var activeOrders = new List<LocalPosOrder>();
        
        if (orderIds.Any())
        {
            activeOrders = await _dbContext.PosOrders
                .Where(o => orderIds.Contains(o.Id))
                .ToListAsync();
        }

        var result = new List<object>();
        foreach (var t in tables)
        {
            var o = activeOrders.FirstOrDefault(ord => ord.Id == t.CurrentOrderId);
            result.Add(new
            {
                id = t.Id,
                floorPlanId = t.FloorPlanId,
                name = t.Name,
                capacity = t.Capacity,
                positionX = t.PositionX,
                positionY = t.PositionY,
                currentOrderId = t.CurrentOrderId,
                isActive = t.IsActive,
                currentOrder = o == null ? null : new
                {
                    id = o.Id,
                    orderNumber = o.OrderNumber,
                    status = o.Status,
                    total = o.Total,
                    guestCount = o.GuestCount,
                    serverStaff = new { firstName = "Offline", lastName = "Operator" } // Ideally join with Staff, but this matches UI expectations
                }
            });
        }
        return result;
    }"""
    
    if get_tables_orig not in content:
        print("Could not find get_tables_orig in LocalRepository.cs")
        sys.exit(1)
        
    content = content.replace(get_tables_orig, get_tables_new)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print("Successfully patched LocalRepository.cs")

if __name__ == "__main__":
    main()
