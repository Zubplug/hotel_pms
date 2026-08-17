using System.Text.Json;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Handles local database mutations and automatically records SyncEvents for cloud replication.
/// </summary>
public class LocalRepository
{
    private readonly LocalDbContext _dbContext;

    public LocalRepository(LocalDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<LocalReservation> CreateReservationAsync(LocalReservation reservation, string userId, string deviceId)
    {
        _dbContext.Reservations.Add(reservation);
        
        // Bundle the mutation with an immutable SyncEvent
        var syncEvent = new LocalSyncEvent
        {
            EntityType = "RESERVATION",
            EntityId = reservation.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(reservation),
            UserId = userId,
            DeviceId = deviceId
        };
        
        _dbContext.SyncEvents.Add(syncEvent);
        
        // This transaction ensures the local DB and the Sync Queue are atomically updated
        await _dbContext.SaveChangesAsync();
        
        return reservation;
    }
    
    public async Task<List<LocalReservation>> GetActiveReservationsAsync()
    {
        return await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
            .Where(r => r.Status != "CANCELLED")
            .ToListAsync();
    }
    
    public async Task<bool> AssignRoomAsync(string reservationId, string roomId, string roomNumber, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;

        res.RoomId = roomId;
        res.RoomNumber = roomNumber;
        res.UpdatedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "RESERVATION",
            EntityId = reservationId,
            OperationType = "ASSIGN_ROOM",
            PayloadJson = JsonSerializer.Serialize(new { roomId, roomNumber }),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CancelReservationAsync(string reservationId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;

        res.Status = "CANCELLED";
        res.UpdatedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "RESERVATION",
            EntityId = reservationId,
            OperationType = "CANCEL",
            PayloadJson = JsonSerializer.Serialize(new { status = "CANCELLED" }),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> IsRoomAvailableAsync(string roomNumber, DateTime checkIn, DateTime checkOut)
    {
        // Simple overlap check
        var overlapping = await _dbContext.Reservations
            .Where(r => r.RoomNumber == roomNumber && r.Status != "CANCELLED")
            .Where(r => r.CheckInDate < checkOut && r.CheckOutDate > checkIn)
            .AnyAsync();

        return !overlapping;
    }

    public async Task<bool> RecordChargeAsync(string folioId, decimal amount, string description, string userId, string deviceId)
    {
        var folio = await _dbContext.Folios.FindAsync(folioId);
        if (folio == null) return false;

        folio.TotalCharges += amount;
        folio.UpdatedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "FOLIO",
            EntityId = folioId,
            OperationType = "ADD_CHARGE",
            PayloadJson = JsonSerializer.Serialize(new { amount, description }),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RecordPaymentAsync(string folioId, decimal amount, string method, string userId, string deviceId)
    {
        var folio = await _dbContext.Folios.FindAsync(folioId);
        if (folio == null) return false;

        folio.TotalPayments += amount;
        folio.UpdatedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "FOLIO",
            EntityId = folioId,
            OperationType = "ADD_PAYMENT",
            PayloadJson = JsonSerializer.Serialize(new { amount, method }),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ProcessCheckInAsync(string reservationId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null || res.Status != "PENDING") return false;

        res.Status = "CHECKED_IN";
        res.UpdatedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "RESERVATION",
            EntityId = reservationId,
            OperationType = "CHECK_IN",
            PayloadJson = JsonSerializer.Serialize(new { status = "CHECKED_IN" }),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ProcessCheckOutAsync(string reservationId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.Include(r => r.Folio).FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null || res.Status != "CHECKED_IN") return false;

        if (res.Folio != null && res.Folio.OutstandingBalance > 0)
        {
            throw new InvalidOperationException("Cannot check out with an outstanding balance.");
        }

        res.Status = "CHECKED_OUT";
        res.UpdatedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "RESERVATION",
            EntityId = reservationId,
            OperationType = "CHECK_OUT",
            PayloadJson = JsonSerializer.Serialize(new { status = "CHECKED_OUT" }),
            UserId = userId,
            DeviceId = deviceId
        });
        
        // Also auto-generate a cleaning task upon checkout
        var cleaningTask = new LocalHousekeepingTask
        {
            RoomId = res.RoomId ?? "",
            RoomNumber = res.RoomNumber ?? "",
            TaskType = "CLEANING",
            Status = "PENDING"
        };
        _dbContext.HousekeepingTasks.Add(cleaningTask);
        
        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "HOUSEKEEPING_TASK",
            EntityId = cleaningTask.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(cleaningTask),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateHousekeepingTaskStatusAsync(string taskId, string status, string userId, string deviceId)
    {
        var task = await _dbContext.HousekeepingTasks.FindAsync(taskId);
        if (task == null) return false;

        task.Status = status;
        task.UpdatedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "HOUSEKEEPING_TASK",
            EntityId = taskId,
            OperationType = "UPDATE_STATUS",
            PayloadJson = JsonSerializer.Serialize(new { status }),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<LocalMaintenanceTicket> CreateMaintenanceTicketAsync(LocalMaintenanceTicket ticket, string userId, string deviceId)
    {
        _dbContext.MaintenanceTickets.Add(ticket);
        
        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "MAINTENANCE_TICKET",
            EntityId = ticket.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(ticket),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return ticket;
    }

    public async Task<bool> ResolveMaintenanceTicketAsync(string ticketId, string userId, string deviceId)
    {
        var ticket = await _dbContext.MaintenanceTickets.FindAsync(ticketId);
        if (ticket == null) return false;

        ticket.Status = "RESOLVED";
        ticket.RequiresRoomRestriction = false;
        ticket.UpdatedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "MAINTENANCE_TICKET",
            EntityId = ticketId,
            OperationType = "RESOLVE",
            PayloadJson = JsonSerializer.Serialize(new { status = "RESOLVED", requiresRoomRestriction = false }),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task EnsureDatabaseCreatedAsync()
    {
        await _dbContext.Database.EnsureCreatedAsync();
        
        // Seed Stanzel Grand Resort for the pilot if it doesn't exist
        if (!await _dbContext.Properties.AnyAsync())
        {
            _dbContext.Properties.Add(new LocalProperty
            {
                Id = "prop_stanzel_001",
                Name = "Stanzel Grand Resort",
                Code = "SGR",
                City = "Los Angeles",
                Currency = "USD",
                Timezone = "America/Los_Angeles",
                BusinessDate = DateTime.UtcNow.Date,
                IsActive = true
            });
            await _dbContext.SaveChangesAsync();
        }
    }

    public async Task<List<LocalProperty>> GetPropertiesAsync()
    {
        return await _dbContext.Properties.Where(p => p.IsActive).ToListAsync();
    }

    public async Task<List<LocalGuest>> GetGuestsAsync()
    {
        return await _dbContext.Guests.ToListAsync();
    }

    public async Task<List<LocalRoomType>> GetRoomTypesAsync(string propertyId)
    {
        return await _dbContext.RoomTypes.Where(rt => rt.PropertyId == propertyId).ToListAsync();
    }

    public async Task<List<LocalRoom>> GetRoomsAsync(string propertyId)
    {
        return await _dbContext.Rooms.Where(r => r.PropertyId == propertyId).ToListAsync();
    }

    public async Task<object> GetDashboardAsync(string propertyId)
    {
        var today = DateTime.UtcNow.Date;
        
        var arrivals = await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
            .Where(r => r.PropertyId == propertyId && r.Status == "CONFIRMED" && r.CheckInDate.Date == today)
            .Select(r => new {
                id = r.Id,
                guestName = r.Guest != null ? r.Guest.FirstName + " " + r.Guest.LastName : "Unknown",
                roomName = r.RoomNumber ?? "Unassigned",
                balance = r.Folio != null ? r.Folio.TotalCharges - r.Folio.TotalPayments : 0,
                status = r.Status,
                roomStatus = "AVAILABLE"
            })
            .ToListAsync();

        var departures = await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
            .Where(r => r.PropertyId == propertyId && r.Status == "CHECKED_IN" && r.CheckOutDate.Date == today)
            .Select(r => new {
                id = r.Id,
                guestName = r.Guest != null ? r.Guest.FirstName + " " + r.Guest.LastName : "Unknown",
                roomName = r.RoomNumber ?? "Unassigned",
                balance = r.Folio != null ? r.Folio.TotalCharges - r.Folio.TotalPayments : 0,
                status = r.Status
            })
            .ToListAsync();

        var inHouse = await _dbContext.Reservations.CountAsync(r => r.PropertyId == propertyId && r.Status == "CHECKED_IN");
        var totalRooms = await _dbContext.Rooms.CountAsync(r => r.PropertyId == propertyId);
        
        return new {
            kpis = new {
                arrivals = arrivals.Count,
                departures = departures.Count,
                inHouse = inHouse,
                roomsAvailable = totalRooms - inHouse,
                roomsTotal = totalRooms
            },
            arrivals,
            departures,
            hardware = new { status = "ONLINE" },
            businessDate = today.ToString("yyyy-MM-dd")
        };
    }

    public async Task<List<LocalRoom>> GetAvailableRoomsAsync(string propertyId, string roomTypeId, DateTime checkIn, DateTime checkOut)
    {
        var allRoomsQuery = _dbContext.Rooms
            .Where(r => r.PropertyId == propertyId && r.Status != "OUT_OF_ORDER" && r.Status != "MAINTENANCE");

        if (!string.IsNullOrEmpty(roomTypeId))
        {
            allRoomsQuery = allRoomsQuery.Where(r => r.RoomTypeId == roomTypeId);
        }

        var allRooms = await allRoomsQuery.ToListAsync();

        var conflictingReservations = await _dbContext.Reservations
            .Where(r => r.PropertyId == propertyId && (r.Status == "CONFIRMED" || r.Status == "CHECKED_IN"))
            .Where(r => r.CheckInDate < checkOut && r.CheckOutDate > checkIn)
            .Select(r => r.RoomId)
            .Where(id => id != null)
            .ToListAsync();

        var outOfOrderRooms = await _dbContext.MaintenanceTickets
            .Where(m => m.PropertyId == propertyId && m.Status != "RESOLVED" && m.RequiresRoomRestriction)
            .Select(m => m.RoomId)
            .Where(id => id != null)
            .ToListAsync();

        var availableRooms = allRooms
            .Where(r => !conflictingReservations.Contains(r.Id))
            .Where(r => !outOfOrderRooms.Contains(r.Id))
            .ToList();

        return availableRooms;
    }

    public async Task<LocalPosOrder> CreatePosOrderAsync(LocalPosOrder order, string userId, string deviceId)
    {
        // 1. Generate Deterministic Operation ID
        string operationId = $"op_{deviceId}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        order.Id = Guid.NewGuid().ToString();
        
        // Mark everything with the operation ID and device attribution
        foreach (var item in order.Items)
        {
            item.Id = Guid.NewGuid().ToString();
            item.OrderId = order.Id;
        }

        foreach (var payment in order.Payments)
        {
            payment.Id = Guid.NewGuid().ToString();
            payment.OrderId = order.Id;
            payment.Method = payment.Method == "CARD" ? "CARD_OFFLINE" : payment.Method;
            payment.Status = payment.Method == "CASH" ? "CONFIRMED" : "PENDING";
        }

        foreach (var kot in order.Kots)
        {
            kot.Id = Guid.NewGuid().ToString();
            kot.OrderId = order.Id;
            kot.OperationId = operationId;
            kot.BusinessDate = order.BusinessDate;
        }

        _dbContext.PosOrders.Add(order);
        
        var syncEvent = new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_ORDER",
            EntityId = order.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(order),
            UserId = userId,
            DeviceId = deviceId
        };
        
        _dbContext.SyncEvents.Add(syncEvent);
        
        if (!string.IsNullOrEmpty(order.FolioId))
        {
            var folioChargeEvent = new LocalSyncEvent
            {
                OperationId = $"op_folio_{operationId}",
                EntityType = "FOLIO",
                EntityId = order.FolioId,
                OperationType = "ADD_ROOM_CHARGE",
                PayloadJson = JsonSerializer.Serialize(new { amount = order.Total, description = $"POS Order #{order.OrderNumber}" }),
                UserId = userId,
                DeviceId = deviceId
            };
            _dbContext.SyncEvents.Add(folioChargeEvent);
            
            var folio = await _dbContext.Folios.FindAsync(order.FolioId);
            if (folio != null)
            {
                folio.TotalCharges += order.Total;
                folio.UpdatedAt = DateTime.UtcNow;
            }
        }
        
        await _dbContext.SaveChangesAsync();
        return order;
    }
    public async Task<LocalPosOrder> UpdateOrderStatusAsync(string orderId, string status, string reason, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders.FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) throw new Exception("Order not found");

        order.Status = status;
        if (!string.IsNullOrEmpty(reason))
        {
            order.Notes = string.IsNullOrEmpty(order.Notes) ? $"Status Reason: {reason}" : $"{order.Notes}\nStatus Reason: {reason}";
        }
        order.UpdatedAt = DateTime.UtcNow;

        string operationId = $"op_order_status_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var syncEvent = new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_ORDER",
            EntityId = order.Id,
            OperationType = "UPDATE",
            PayloadJson = JsonSerializer.Serialize(new { status = order.Status, notes = order.Notes, updatedAt = order.UpdatedAt }),
            UserId = userId,
            DeviceId = deviceId
        };
        
        _dbContext.SyncEvents.Add(syncEvent);
        await _dbContext.SaveChangesAsync();

        return order;
    }


    public async Task<LocalPosKot> FireKotAsync(string orderId, List<string> itemIds, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception("Order not found");

        var itemsToFire = order.Items.Where(i => itemIds.Contains(i.Id)).ToList();
        if (!itemsToFire.Any()) throw new Exception("No valid items selected for KOT");

        string operationId = $"op_kot_{deviceId}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        
        var kot = new LocalPosKot
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            OutletId = order.OutletId,
            DeviceId = deviceId,
            CreatedBy = userId,
            KotNumber = $"{order.OrderNumber}-{Guid.NewGuid().ToString("N").Substring(0, 4)}",
            Status = "PENDING",
            PrintStatus = "QUEUED",
            OperationId = operationId,
            BusinessDate = order.BusinessDate,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosKots.Add(kot);

        foreach (var item in itemsToFire)
        {
            item.KotId = kot.Id;
            item.KitchenStatus = "PENDING";
            item.SentToKitchenAt = DateTime.UtcNow;
        }

        var syncEvent = new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_KOT",
            EntityId = kot.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(new { kot, itemIds }),
            UserId = userId,
            DeviceId = deviceId
        };
        _dbContext.SyncEvents.Add(syncEvent);
        await _dbContext.SaveChangesAsync();

        return kot;
    }

    public async Task<LocalPosCheck> SplitCheckAsync(string orderId, List<string> orderItemIds, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception("Order not found");

        var itemsToSplit = order.Items.Where(i => orderItemIds.Contains(i.Id)).ToList();
        if (!itemsToSplit.Any()) throw new Exception("No valid items selected for split");

        string operationId = $"op_split_{deviceId}_{DateTime.UtcNow.Ticks}";

        var newCheck = new LocalPosCheck
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            CheckNumber = $"{order.OrderNumber}-{order.Checks.Count + 1}",
            Status = "OPEN",
            Total = itemsToSplit.Sum(i => i.Total),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.PosChecks.Add(newCheck);

        foreach (var item in itemsToSplit)
        {
            item.CheckId = newCheck.Id;
        }

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_ORDER",
            EntityId = order.Id,
            OperationType = "UPDATE", // Re-sync the order to update checks and item checkIds
            PayloadJson = JsonSerializer.Serialize(order),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return newCheck;
    }

    public async Task<List<LocalPosProduct>> GetPosProductsAsync(string propertyId)
    {
        return await _dbContext.PosProducts.Where(p => p.PropertyId == propertyId && p.IsActive).ToListAsync();
    }

    public async Task<LocalPosSession> OpenPosSessionAsync(string propertyId, decimal openingBalance, string userId, string deviceId)
    {
        var session = new LocalPosSession
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            DeviceId = deviceId,
            UserId = userId,
            Status = "OPEN",
            OpenedAt = DateTime.UtcNow,
            OpeningBalance = openingBalance
        };

        _dbContext.PosSessions.Add(session);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = $"op_session_open_{session.Id}",
            EntityType = "POS_SESSION",
            EntityId = session.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(session),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return session;
    }

    public async Task<LocalPosOrder> GetOrderAsync(string orderId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .Include(o => o.Checks)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == orderId);
            
        if (order != null && order.Checks != null)
        {
            foreach (var check in order.Checks)
            {
                check.Items = order.Items.Where(i => i.CheckId == check.Id).ToList();
            }
        }
        
        return order;
    }

    public async Task<LocalPosPayment> PayOrderAsync(string orderId, string method, decimal amount, string currency, string checkId, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders.FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) throw new Exception("Order not found");

        string operationId = $"op_pay_{deviceId}_{DateTime.UtcNow.Ticks}";

        var payment = new LocalPosPayment
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            CheckId = checkId,
            SessionId = order.SessionId,
            Method = method,
            Amount = amount,
            Currency = currency,
            Status = "CONFIRMED",
            OperationId = operationId,
            BusinessDate = order.BusinessDate,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosPayments.Add(payment);

        var syncEvent = new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_PAYMENT",
            EntityId = payment.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(payment),
            UserId = userId,
            DeviceId = deviceId
        };
        _dbContext.SyncEvents.Add(syncEvent);

        if (!string.IsNullOrEmpty(checkId))
        {
            var check = await _dbContext.PosChecks.FirstOrDefaultAsync(c => c.Id == checkId);
            if (check != null)
            {
                var checkPayments = await _dbContext.PosPayments.Where(p => p.CheckId == checkId).SumAsync(p => p.Amount);
                if (checkPayments + amount >= check.Total)
                {
                    check.Status = "PAID";
                    
                    _dbContext.SyncEvents.Add(new LocalSyncEvent
                    {
                        OperationId = $"op_chk_status_{deviceId}_{DateTime.UtcNow.Ticks}",
                        EntityType = "POS_CHECK",
                        EntityId = check.Id,
                        OperationType = "UPDATE",
                        PayloadJson = JsonSerializer.Serialize(new { status = "PAID" }),
                        UserId = userId,
                        DeviceId = deviceId
                    });
                }
            }
        }

        var orderPayments = await _dbContext.PosPayments.Where(p => p.OrderId == orderId).SumAsync(p => p.Amount);
        if (orderPayments + amount >= order.Total)
        {
            order.Status = "COMPLETED";
            
            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                OperationId = $"op_ord_status_{deviceId}_{DateTime.UtcNow.Ticks}",
                EntityType = "POS_ORDER",
                EntityId = order.Id,
                OperationType = "UPDATE",
                PayloadJson = JsonSerializer.Serialize(new { status = "COMPLETED" }),
                UserId = userId,
                DeviceId = deviceId
            });
        }

        await _dbContext.SaveChangesAsync();
        return payment;
    }

    public async Task<LocalPosSession> ClosePosSessionAsync(string sessionId, decimal actualCash, decimal cashPaidOut, string userId, string deviceId)
    {
        var session = await _dbContext.PosSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");

        session.Status = "CLOSED";
        session.ClosedAt = DateTime.UtcNow;
        session.ActualCash = actualCash;
        session.CashPaidOut = cashPaidOut;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = $"op_session_close_{sessionId}",
            EntityType = "POS_SESSION",
            EntityId = session.Id,
            OperationType = "UPDATE",
            PayloadJson = JsonSerializer.Serialize(session),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return session;
    }

    public async Task<LocalPosVoid> AuthorizeVoidAsync(string orderId, string orderItemId, string reason, string authorizerId, string userId, string deviceId)
    {
        string operationId = $"op_void_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var posVoid = new LocalPosVoid
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            OrderItemId = orderItemId,
            Reason = reason,
            AuthorizerId = authorizerId,
            OperationId = operationId,
            DeviceId = deviceId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosVoids.Add(posVoid);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_VOID",
            EntityId = posVoid.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(posVoid),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return posVoid;
    }

    public async Task<LocalPosPayment> RecordRefundAsync(string orderId, decimal amount, string method, string authorizerId, string userId, string deviceId)
    {
        string operationId = $"op_refund_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var payment = new LocalPosPayment
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            Method = method,
            Status = method == "CASH" ? "CONFIRMED" : "PENDING_GATEWAY",
            Amount = -amount, // Negative for refund
            OperationId = operationId,
            DeviceId = deviceId,
            PaidAt = DateTime.UtcNow
        };

        _dbContext.PosPayments.Add(payment);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_PAYMENT",
            EntityId = payment.Id,
            OperationType = "CREATE", // Might map to a REFUND type eventually, but for now treating as negative payment
            PayloadJson = JsonSerializer.Serialize(payment),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return payment;
    }

    public async Task<LocalPosCashMovement> RecordCashMovementAsync(string propertyId, string sessionId, decimal amount, string type, string reasonCode, string? notes, string? receiptReference, string? authorizedBy, string userId, string deviceId)
    {
        string operationId = $"op_cashmvt_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var movement = new LocalPosCashMovement
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            PosSessionId = sessionId,
            DeviceId = deviceId,
            UserId = userId,
            Amount = amount,
            Type = type,
            ReasonCode = reasonCode,
            Notes = notes,
            ReceiptReference = receiptReference,
            OperationId = operationId,
            AuthorizedBy = authorizedBy,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosCashMovements.Add(movement);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_CASH_MOVEMENT",
            EntityId = movement.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(movement),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return movement;
    }

    public async Task<LocalPosReceiptAudit> RecordReceiptPrintAsync(string propertyId, string? orderId, string? sessionId, string type, string? reason, int printCount, string userId, string deviceId)
    {
        string operationId = $"op_receipt_{deviceId}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        
        var audit = new LocalPosReceiptAudit
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            OrderId = orderId,
            DeviceId = deviceId,
            PosSessionId = sessionId,
            UserId = userId,
            Type = type,
            Reason = reason,
            PrintCount = printCount,
            OperationId = operationId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosReceiptAudits.Add(audit);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_RECEIPT_AUDIT",
            EntityId = audit.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(audit),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return audit;
    }

    public async Task<List<LocalStaff>> GetActiveStaffAsync(string propertyId)
    {
        return await _dbContext.Staff
            .Where(s => s.PropertyId == propertyId && s.IsActive && s.HasPosAccess)
            .ToListAsync();
    }

    public async Task<LocalStaff?> AuthenticateOperatorAsync(string staffId, string pin, string propertyId)
    {
        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == staffId && s.PropertyId == propertyId);
        if (staff == null || !staff.IsActive || !staff.HasPosAccess) return null;

        // In a production environment, PosPinHash must be properly hashed on creation (e.g., using bcrypt)
        // and verified here. Assuming the UI/Sync provides the verified hash correctly.
        if (staff.PosPinHash != pin) return null; 

        return staff;
    }

    public async Task<LocalStaff?> ValidateSupervisorPinAsync(string pin, string propertyId)
    {
        // Locate an active supervisor matching this PIN in this property.
        // Again, assuming 'pin' here is the hashed value expected to match the database.
        var supervisor = await _dbContext.Staff
            .FirstOrDefaultAsync(s => s.PosPinHash == pin && s.PropertyId == propertyId && s.IsActive && s.Role == "MANAGER");

        return supervisor;
    }

    public async Task<LocalPosOperatorSession> SwitchOperatorAsync(string deviceId, string posSessionId, string staffId, string operationId)
    {
        // End current operator session if any
        var currentSession = await _dbContext.PosOperatorSessions
            .Where(s => s.DeviceId == deviceId && s.PosSessionId == posSessionId && s.EndedAt == null)
            .FirstOrDefaultAsync();

        if (currentSession != null)
        {
            currentSession.EndedAt = DateTime.UtcNow;
            
            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                EntityType = "OPERATOR_SESSION",
                EntityId = currentSession.Id,
                OperationType = "SWITCH_OUT",
                PayloadJson = JsonSerializer.Serialize(new { endedAt = currentSession.EndedAt }),
                UserId = currentSession.StaffId,
                DeviceId = deviceId
            });
        }

        var newSession = new LocalPosOperatorSession
        {
            Id = Guid.NewGuid().ToString(),
            DeviceId = deviceId,
            PosSessionId = posSessionId,
            StaffId = staffId,
            StartedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow,
            OperationId = operationId
        };

        _dbContext.PosOperatorSessions.Add(newSession);
        
        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "OPERATOR_SESSION",
            EntityId = newSession.Id,
            OperationType = "SWITCH_IN",
            PayloadJson = JsonSerializer.Serialize(newSession),
            UserId = staffId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return newSession;
    }

    public async Task<object?> GetCurrentOperatorSessionAsync(string deviceId, string posSessionId)
    {
        var currentSession = await _dbContext.PosOperatorSessions
            .Where(s => s.DeviceId == deviceId && s.PosSessionId == posSessionId && s.EndedAt == null)
            .FirstOrDefaultAsync();

        if (currentSession == null) return null;

        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == currentSession.StaffId);
        if (staff == null) return null;

        return new { operatorSession = currentSession, staff };
    }

    public async Task<LocalPosAuthorizationAudit> LogAuthorizationAsync(string propertyId, string? sessionId, string requestedBy, string authorizedBy, string action, string? reason, string operationId, string deviceId)
    {
        var audit = new LocalPosAuthorizationAudit
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            DeviceId = deviceId,
            SessionId = sessionId,
            RequestedBy = requestedBy,
            AuthorizedBy = authorizedBy,
            Action = action,
            Reason = reason,
            OperationId = operationId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosAuthorizationAudits.Add(audit);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_AUTH_AUDIT",
            EntityId = audit.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(audit),
            UserId = requestedBy,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return audit;
    }
}
