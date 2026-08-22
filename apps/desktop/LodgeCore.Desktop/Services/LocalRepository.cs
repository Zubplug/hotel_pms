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
        reservation.IsDirty = true;
        _dbContext.Reservations.Add(reservation);
        
        // Bundle the mutation with an immutable OutboxEvent
        var outboxEvent = new LocalOutboxEvent
        {
            PropertyId = reservation.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservation.Id,
            AggregateVersion = reservation.Version,
            EventType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(reservation)
        };
        
        _dbContext.OutboxEvents.Add(outboxEvent);
        
        // This transaction ensures the local DB and the Sync Queue are atomically updated
        await _dbContext.SaveChangesAsync();
        
        return reservation;
    }

    public async Task<List<LocalOutboxEvent>> GetOutboxEventsAsync()
    {
        return await _dbContext.OutboxEvents
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
    }
    
    public async Task<List<LocalReservation>> GetActiveReservationsAsync()
    {
        return await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
            .Where(r => r.Status != "CANCELLED")
            .ToListAsync();
    }

    public async Task<LocalReservation?> GetReservationAsync(string id)
    {
        return await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
                .ThenInclude(f => f.Items)
            .Include(r => r.Folio)
                .ThenInclude(f => f.Payments)
            .FirstOrDefaultAsync(r => r.Id == id);
    }
    
    public async Task<bool> AssignRoomAsync(string reservationId, string roomId, string roomNumber, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;

        var oldRoomId = res.RoomId;
        res.RoomId = roomId;
        res.RoomNumber = roomNumber;
        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "REASSIGN_ROOM",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new { newRoomId = roomId, newRoomNumber = roomNumber, oldRoomId })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CancelReservationAsync(string reservationId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.Include(r => r.Folio).FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null) return false;

        // Guard: already cancelled is a no-op (idempotent)
        if (res.Status == "CANCELLED") return true;

        // Guard: cannot cancel a checked-out reservation
        if (res.Status == "CHECKED_OUT")
            throw new InvalidOperationException("Cannot cancel a reservation that has already been checked out.");

        // Guard: cannot cancel with an unsettled folio
        if (res.Folio != null && res.Folio.OutstandingBalance > 0)
            throw new InvalidOperationException("Cannot cancel reservation with an outstanding balance. Settle the folio first.");

        res.Status = "CANCELLED";
        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "CANCEL",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new { status = "CANCELLED", roomId = res.RoomId })
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

    public async Task<bool> ExtendStayAsync(string reservationId, DateTime newCheckOut, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;

        if (res.Status != "CHECKED_IN" && res.Status != "PENDING")
            throw new InvalidOperationException($"Cannot extend a reservation with status '{res.Status}'.");

        if (newCheckOut <= res.CheckInDate)
            throw new InvalidOperationException("New checkout date must be after the check-in date.");

        if (newCheckOut <= res.CheckOutDate)
            throw new InvalidOperationException("New checkout date must be after the current checkout date.");

        // Overlap check: is the room taken by another reservation during the extension window?
        if (!string.IsNullOrEmpty(res.RoomNumber))
        {
            var conflict = await _dbContext.Reservations
                .Where(r => r.Id != reservationId
                         && r.RoomNumber == res.RoomNumber
                         && r.Status != "CANCELLED"
                         && r.CheckInDate < newCheckOut
                         && r.CheckOutDate > res.CheckOutDate)
                .AnyAsync();

            if (conflict)
                throw new InvalidOperationException("The room is not available for the extended period.");
        }

        res.CheckOutDate = newCheckOut;
        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "EXTEND_STAY",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new
            {
                newCheckOutDate = newCheckOut.ToString("o"),
                roomId = res.RoomId
            })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> EditReservationAsync(string reservationId, LocalReservationPatch patch, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;

        if (res.Status == "CHECKED_OUT" || res.Status == "CANCELLED")
            throw new InvalidOperationException($"Cannot edit a {res.Status} reservation.");

        // Apply non-null patches
        if (patch.GuestId        != null) res.GuestId         = patch.GuestId;
        if (patch.CheckIn        != null) res.CheckInDate      = patch.CheckIn.Value;
        if (patch.CheckOut       != null) res.CheckOutDate     = patch.CheckOut.Value;
        if (patch.RoomId         != null) res.RoomId           = patch.RoomId;
        if (patch.RoomTypeId     != null) res.RoomTypeId       = patch.RoomTypeId;
        if (patch.Adults         != null) res.Adults           = patch.Adults.Value;
        if (patch.Children       != null) res.Children         = patch.Children.Value;
        if (patch.SpecialRequests != null) res.SpecialRequests = patch.SpecialRequests;

        if (res.CheckOutDate <= res.CheckInDate)
            throw new InvalidOperationException("Check-out must be after check-in.");

        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "EDIT",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new
            {
                guestId         = patch.GuestId,
                checkIn         = patch.CheckIn?.ToString("o"),
                checkOut        = patch.CheckOut?.ToString("o"),
                roomId          = patch.RoomId,
                roomTypeId      = patch.RoomTypeId,
                adults          = patch.Adults,
                children        = patch.Children,
                specialRequests = patch.SpecialRequests
            })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RecordChargeAsync(string folioId, decimal amount, string description, string userId, string deviceId)
    {
        var folio = await _dbContext.Folios.FindAsync(folioId);
        if (folio == null) return false;

        folio.TotalCharges += amount;
        folio.UpdatedAt = DateTime.UtcNow;
        folio.IsDirty = true;
        folio.LocalSequence++;
        int eventVersion = folio.Version;
        folio.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = folio.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "FOLIO",
            AggregateId = folioId,
            AggregateVersion = eventVersion,
            EventType = "ROOM_CHARGE",
            Sequence = folio.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new { amount, description, currency = "NGN", businessDate = DateTime.UtcNow, originalBusinessDate = DateTime.UtcNow })
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
        folio.IsDirty = true;
        folio.LocalSequence++;
        int eventVersion = folio.Version;
        folio.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = folio.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "FOLIO",
            AggregateId = folioId,
            AggregateVersion = eventVersion,
            EventType = "POST_PAYMENT",
            Sequence = folio.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new { amount, method, currency = "NGN", businessDate = DateTime.UtcNow, originalBusinessDate = DateTime.UtcNow })
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
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "CHECK_IN",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new { roomId = res.RoomId })
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
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "CHECK_OUT",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new { roomId = res.RoomId })
        });
        
        // Also auto-generate a cleaning task upon checkout
        var cleaningTask = new LocalHousekeepingTask
        {
            PropertyId = res.PropertyId,
            RoomId = res.RoomId ?? "",
            RoomNumber = res.RoomNumber ?? "",
            TaskType = "CLEANING",
            Status = "PENDING"
        };
        _dbContext.HousekeepingTasks.Add(cleaningTask);
        
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = cleaningTask.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "HOUSEKEEPING_TASK",
            AggregateId = cleaningTask.Id,
            AggregateVersion = 1,
            EventType = "CREATE",
            Sequence = 1,
            PayloadJson = JsonSerializer.Serialize(cleaningTask)
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
        task.IsDirty = true;
        int eventVersion = task.Version;
        task.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = task.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "HOUSEKEEPING_TASK",
            AggregateId = taskId,
            AggregateVersion = eventVersion,
            EventType = "UPDATE_STATUS",
            Sequence = task.Version,
            PayloadJson = JsonSerializer.Serialize(new { status })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<LocalMaintenanceTicket> CreateMaintenanceTicketAsync(LocalMaintenanceTicket ticket, string userId, string deviceId)
    {
        _dbContext.MaintenanceTickets.Add(ticket);
        
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = ticket.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "MAINTENANCE_TICKET",
            AggregateId = ticket.Id,
            AggregateVersion = 1,
            EventType = "CREATE",
            Sequence = 1,
            PayloadJson = JsonSerializer.Serialize(ticket)
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
        ticket.IsDirty = true;
        int eventVersion = ticket.Version;
        ticket.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = ticket.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "MAINTENANCE_TICKET",
            AggregateId = ticketId,
            AggregateVersion = eventVersion,
            EventType = "RESOLVE",
            Sequence = ticket.Version,
            PayloadJson = JsonSerializer.Serialize(new { status = "RESOLVED", requiresRoomRestriction = false })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<LocalFolio?> GetFolioAsync(string folioId)
    {
        return await _dbContext.Folios
            .Include(f => f.Reservation)
            .FirstOrDefaultAsync(f => f.Id == folioId);
    }

    public async Task<LocalReservation?> GetReservationByRoomNumberAsync(string roomNumber)
    {
        return await _dbContext.Reservations
            .FirstOrDefaultAsync(r => r.RoomNumber == roomNumber && (r.Status == "CHECKED_IN" || r.Status == "CONFIRMED"));
    }

    public async Task<List<LocalHousekeepingTask>> GetHousekeepingTasksAsync(string propertyId)
    {
        return await _dbContext.HousekeepingTasks
            .Where(t => t.PropertyId == propertyId || t.PropertyId == "") // Also include tasks without propertyId for fallback
            .ToListAsync();
    }

    public async Task<List<LocalMaintenanceTicket>> GetMaintenanceTicketsAsync(string propertyId)
    {
        return await _dbContext.MaintenanceTickets
            .Where(t => t.PropertyId == propertyId)
            .ToListAsync();
    }

    public async Task EnsureDatabaseCreatedAsync()
    {
        await _dbContext.ApplyRuntimeMigrationsAsync();
        
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
                IsActive = true,
                EarlyCheckinWindowHours = 2, // Configurable; synced from cloud settings
                BankingModel = "SERVER_BANKING"
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

    public async Task<bool> UpdateGuestAsync(string guestId, string firstName, string lastName, string? email, string? phone, string operatorId, string deviceId)
    {
        var guest = await _dbContext.Guests.FindAsync(guestId);
        if (guest == null) return false;

        guest.FirstName = firstName;
        guest.LastName = lastName;
        guest.Email = email;
        guest.Phone = phone;
        guest.UpdatedAt = DateTime.UtcNow;
        guest.Version++;

        var payload = new 
        {
            guestId = guest.Id,
            firstName = guest.FirstName,
            lastName = guest.LastName,
            email = guest.Email,
            phone = guest.Phone
        };

        var evt = new LocalOutboxEvent
        {
            Id = Guid.NewGuid().ToString(),
            AggregateType = "GUEST",
            AggregateId = guest.Id,
            AggregateVersion = guest.Version,
            EventType = "EDIT_GUEST",
            PayloadJson = JsonSerializer.Serialize(payload),
            OperatorId = operatorId,
            DeviceId = deviceId
        };
        _dbContext.OutboxEvents.Add(evt);
        await _dbContext.SaveChangesAsync();
        return true;
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
        var availableRooms = await _dbContext.Rooms.CountAsync(r => r.PropertyId == propertyId && (r.Status == "AVAILABLE" || r.Status == "CLEAN"));
        
        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);

        return new {
            property = property != null ? new { name = property.Name } : null,
            kpis = new {
                arrivals = arrivals.Count,
                departures = departures.Count,
                inHouse = inHouse,
                roomsAvailable = availableRooms,
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
        
        AppendSyncEvent("POS_ORDER", order.Id, "ORDER_CREATED", order, deviceId, order.OutletId, order.SessionId, userId);
        
        if (!string.IsNullOrEmpty(order.FolioId))
        {
            var folioEventData = new { amount = order.Total, description = $"POS Order #{order.OrderNumber}" };
            AppendSyncEvent("FOLIO", order.FolioId, "ADD_ROOM_CHARGE", folioEventData, deviceId, order.OutletId, order.SessionId, userId);
            
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

        AppendSyncEvent("POS_ORDER", order.Id, status == "CLOSED" ? "ORDER_CLOSED" : "ORDER_UPDATED", new { status = order.Status, notes = order.Notes, updatedAt = order.UpdatedAt }, deviceId, order.OutletId, order.SessionId, userId);
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

        AppendSyncEvent("POS_KOT", kot.Id, "KOT_CREATED", new { kot, itemIds }, deviceId, order.OutletId, order.SessionId, userId);
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

        AppendSyncEvent("POS_ORDER", order.Id, "ORDER_CHECK_SPLIT", order, deviceId, order.OutletId, order.SessionId, userId);

        await _dbContext.SaveChangesAsync();
        return newCheck;
    }

    public async Task<List<LocalPosProduct>> GetPosProductsAsync(string propertyId)
    {
        return await _dbContext.PosProducts.Where(p => p.PropertyId == propertyId && p.IsActive).ToListAsync();
    }

    public async Task<LocalPosSession> OpenPosSessionAsync(string propertyId, string outletId, string bankType, string bankingModel, decimal openingBalance, string userId, string deviceId)
    {
        // 1. Idempotency check: if there is already an active session for this specific context, return it.
        if (bankType == "SERVER")
        {
            var existingServerBank = await GetActiveServerBankAsync(userId, propertyId, outletId);
            if (existingServerBank != null) return existingServerBank;
        }
        else 
        {
            var existingDeviceBank = await GetActiveSessionForDeviceAsync(deviceId);
            if (existingDeviceBank != null) return existingDeviceBank;
        }

        var session = new LocalPosSession
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            OutletId = outletId,
            DeviceId = deviceId,
            UserId = userId,
            PrimaryOperatorId = userId,
            BankType = bankType,
            BankingModel = bankingModel,
            Status = "OPEN",
            OpenedAt = DateTime.UtcNow,
            OpeningBalance = openingBalance
        };

        _dbContext.PosSessions.Add(session);

        AppendSyncEvent("POS_SESSION", session.Id, "POS_SESSION_STARTED", session, deviceId, "", session.Id, userId);

        await _dbContext.SaveChangesAsync();
        return session;
    }

    public async Task<LocalPosOrder?> GetOrderAsync(string orderId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .ThenInclude(i => i.Modifiers)
            .Include(o => o.Checks)
            .Include(o => o.Payments)
            .Include(o => o.Voids)
            .Include(o => o.Kots)
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

    public async Task<List<LocalPosOrder>> GetActiveOrdersAsync(string sessionId, string filter = "my_orders", string? staffId = null)
    {
        var query = _dbContext.PosOrders
            .Include(o => o.Items)
            .Include(o => o.Checks)
            .Where(o => o.SessionId == sessionId && o.Status != "CLOSED" && o.Status != "VOIDED");

        if (filter == "my_orders" && !string.IsNullOrEmpty(staffId))
        {
            query = query.Where(o => o.ServerStaffId == staffId);
        }

        return await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
    }

    public async Task<(LocalPosOrder Order, LocalPosKot Kot)> FireItemsAsync(string orderId, List<LocalPosOrderItem> itemsToFire, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception("Order not found");

        var newItems = new List<LocalPosOrderItem>();

        foreach (var item in itemsToFire)
        {
            item.Id = Guid.NewGuid().ToString();
            item.OrderId = order.Id;
            item.CheckId = order.Checks?.FirstOrDefault(c => c.Status == "OPEN")?.Id;
            item.KitchenStatus = "PENDING";
            item.CreatedAt = DateTime.UtcNow;
            
            _dbContext.PosOrderItems.Add(item);
            newItems.Add(item);

            if (item.Modifiers != null)
            {
                foreach (var mod in item.Modifiers)
                {
                    mod.Id = Guid.NewGuid().ToString();
                    mod.OrderItemId = item.Id;
                    _dbContext.PosOrderItemModifiers.Add(mod);
                }
            }
        }

        order.Subtotal += newItems.Sum(i => i.UnitPrice * i.Quantity);
        order.TaxAmount += newItems.Sum(i => i.TaxAmount);
        order.Total += newItems.Sum(i => i.Total);
        order.UpdatedAt = DateTime.UtcNow;

        var kot = new LocalPosKot
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = order.Id,
            OrderNumber = order.OrderNumber,
            KotNumber = $"{order.OrderNumber}-{order.Kots?.Count + 1 ?? 1}",
            TableNumber = order.TableNumber,
            ServerName = "Server", // Ideally fetch server name
            Status = "PENDING",
            FiredAt = DateTime.UtcNow,
            ItemIdsJson = JsonSerializer.Serialize(newItems.Select(i => i.Id))
        };
        _dbContext.PosKots.Add(kot);

        AppendSyncEvent("POS_ORDER", order.Id, "ORDER_ITEMS_ADDED", new { order, kot }, deviceId, order.OutletId, order.SessionId, userId);

        await _dbContext.SaveChangesAsync();
        return (order, kot);
    }

    /// <summary>
    /// Reconstructs the full receipt audit chain from SQLite — works 100% offline.
    /// Produces a rich receipt document with server identity, payment trail, KOT history, and
    /// a deterministic verification token that matches what the cloud would generate.
    /// </summary>
    public async Task<object> GetReceiptAsync(string orderId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .ThenInclude(i => i.Modifiers)
            .Include(o => o.Payments)
            .Include(o => o.Voids)
            .Include(o => o.Kots)
            .Include(o => o.Checks)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception($"Order {orderId} not found in local database.");

        // Resolve staff names locally
        var serverStaff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == order.ServerStaffId);
        
        // Resolve outlet name
        var outlet = await _dbContext.PosOutlets.FirstOrDefaultAsync(o => o.Id == order.OutletId);
        
        // Resolve session ownership
        var session = await _dbContext.PosSessions.FirstOrDefaultAsync(s => s.Id == order.SessionId);
        var sessionOwner = session != null 
            ? await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == session.StaffId)
            : null;

        // Build the verification token deterministically from immutable order data
        // This must match the algorithm used by the cloud for cross-verification
        var rawToken = $"{order.Id}:{order.OrderNumber}:{order.Total}:{order.BusinessDate:yyyyMMdd}:{order.PropertyId}:{order.SessionId}";
        var tokenBytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken));
        var verificationToken = $"LOC-{BitConverter.ToString(tokenBytes).Replace("-", "")[..24]}";

        var receipt = new
        {
            orderId = order.Id,
            orderNumber = order.OrderNumber,
            status = order.Status,
            businessDate = order.BusinessDate,
            tableNumber = order.TableNumber,
            guestCount = order.GuestCount,
            notes = order.Notes,

            // Financials
            subtotal = order.Subtotal,
            taxAmount = order.TaxAmount,
            serviceCharge = order.ServiceCharge,
            tipAmount = order.TipAmount,
            total = order.Total,

            // Items with modifiers
            items = order.Items.Select(i => new
            {
                id = i.Id,
                productName = i.ProductName,
                quantity = i.Quantity,
                unitPrice = i.UnitPrice,
                taxAmount = i.TaxAmount,
                total = i.Total,
                kitchenStatus = i.KitchenStatus,
                course = i.Course,
                voidReason = i.VoidReason,
                checkId = i.CheckId,
                modifiers = i.Modifiers.Select(m => new { m.Name, m.Price })
            }),

            // Payments trail
            payments = order.Payments.Select(p => new
            {
                p.Id,
                p.Method,
                p.Amount,
                p.Currency,
                p.Status,
                p.BusinessDate,
                receiptNumber = $"RCP-{p.OperationId?.Split('_').LastOrDefault() ?? p.Id[..8].ToUpper()}"
            }),

            // Voids (audit trail)
            voids = order.Voids.Select(v => new
            {
                v.Id,
                v.OrderItemId,
                v.Reason,
                v.AuthorizerId,
                v.BusinessDate
            }),

            // KOT history
            kots = order.Kots.Select(k => new
            {
                k.KotNumber,
                k.Status,
                k.PrintStatus,
                k.PrintedAt,
                k.BusinessDate
            }),

            // Audit chain — the forensic trail
            auditChain = new
            {
                serverName = serverStaff != null ? $"{serverStaff.FirstName} {serverStaff.LastName}" : "Unknown",
                serverStaffId = order.ServerStaffId,
                sessionId = order.SessionId,
                sessionOwnerName = sessionOwner != null ? $"{sessionOwner.FirstName} {sessionOwner.LastName}" : "Unknown",
                outletName = outlet?.Name ?? "Unknown Outlet",
                deviceId = order.DeviceId,
                operationId = order.OperationId
            },

            // Verification
            verificationToken,
            verificationMode = "OFFLINE_LOCAL_SHA256",
            outlet = outlet == null ? null : new { outlet.Id, outlet.Name }
        };

        return receipt;
    }

    /// <summary>Returns a single staff member by Id.</summary>
    public async Task<LocalStaff?> GetStaffByIdAsync(string staffId)
    {
        return await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == staffId);
    }

    public async Task<LocalPosPayment> PayOrderAsync(string orderId, string method, decimal amount, string currency, string checkId, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders.FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) throw new Exception("Order not found");

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
            OperationId = $"op_pay_{deviceId}_{DateTime.UtcNow.Ticks}",
            BusinessDate = order.BusinessDate,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosPayments.Add(payment);

        AppendSyncEvent("POS_PAYMENT", payment.Id, "PAYMENT_RECORDED", payment, deviceId, order.OutletId, order.SessionId, userId);

        if (!string.IsNullOrEmpty(checkId))
        {
            var check = await _dbContext.PosChecks.FirstOrDefaultAsync(c => c.Id == checkId);
            if (check != null)
            {
                var checkPayments = await _dbContext.PosPayments.Where(p => p.CheckId == checkId).SumAsync(p => p.Amount);
                if (checkPayments + amount >= check.Total)
                {
                    check.Status = "PAID";
                    AppendSyncEvent("POS_CHECK", check.Id, "CHECK_PAID", new { status = "PAID" }, deviceId, order.OutletId, order.SessionId, userId);
                }
            }
        }

        var orderPayments = await _dbContext.PosPayments.Where(p => p.OrderId == orderId).SumAsync(p => p.Amount);
        if (orderPayments + amount >= order.Total)
        {
            order.Status = "COMPLETED";
            AppendSyncEvent("POS_ORDER", order.Id, "ORDER_COMPLETED", new { status = "COMPLETED" }, deviceId, order.OutletId, order.SessionId, userId);
        }

        await _dbContext.SaveChangesAsync();
        return payment;
    }

    public async Task<LocalPosSettlement> SettleSessionAsync(string sessionId, decimal actualCash, string operatorId, string? authorizerId, string deviceId)
    {
        var session = await _dbContext.PosSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");
        if (session.Status == "CLOSED" || session.Status == "SETTLED") throw new Exception("Session is already closed or settled");

        var details = await GetSessionSettlementDetailsAsync(sessionId);

        // Validation for override variance
        if (session.BankType != "SERVER" && details.Variance != 0 && string.IsNullOrEmpty(authorizerId))
        {
            throw new UnauthorizedAccessException("Variance requires supervisor approval.");
        }

        string operationId = $"op_settle_{deviceId}_{DateTime.UtcNow.Ticks}";

        var settlement = new LocalPosSettlement
        {
            Id = Guid.NewGuid().ToString(),
            SessionId = sessionId,
            PropertyId = session.PropertyId,
            DeviceId = deviceId,
            OperatorId = operatorId,
            SessionOwnerId = session.UserId,
            BusinessDate = session.OpenedAt.Date, // Binds business date to the session's exact open date for local audit accuracy
            ExpectedCash = details.ExpectedCash,
            ActualCash = actualCash,
            Variance = actualCash - details.ExpectedCash,
            AuthorizerId = authorizerId,
            SettledAt = DateTime.UtcNow,
            Status = session.BankType == "SERVER" ? "PENDING_HANDOVER" : "SETTLED",
            OperationId = operationId
        };

        _dbContext.PosSettlements.Add(settlement);

        // Record the actual settlement as a movement for immutable ledger
        var movement = new LocalPosCashMovement
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = session.PropertyId,
            PosSessionId = sessionId,
            DeviceId = deviceId,
            UserId = operatorId,
            Amount = actualCash,
            Type = "SETTLED_ACTUAL",
            ReasonCode = "SETTLEMENT",
            OperationId = $"op_cashmvt_settle_{deviceId}_{DateTime.UtcNow.Ticks}",
            AuthorizedBy = authorizerId,
            CreatedAt = DateTime.UtcNow
        };
        _dbContext.PosCashMovements.Add(movement);

        if (settlement.Variance != 0)
        {
            var varMovement = new LocalPosCashMovement
            {
                Id = Guid.NewGuid().ToString(),
                PropertyId = session.PropertyId,
                PosSessionId = sessionId,
                DeviceId = deviceId,
                UserId = operatorId,
                Amount = settlement.Variance,
                Type = "VARIANCE",
                ReasonCode = "SETTLEMENT_VARIANCE",
                OperationId = $"op_cashmvt_var_{deviceId}_{DateTime.UtcNow.Ticks}",
                AuthorizedBy = authorizerId,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.PosCashMovements.Add(varMovement);
        }

        session.Status = session.BankType == "SERVER" ? "RECONCILIATION_REQUIRED" : "CLOSED";
        session.ClosedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_SETTLEMENT",
            EntityId = settlement.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(settlement),
            UserId = operatorId,
            DeviceId = deviceId
        });

        // Also sync the session close
        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = $"op_session_close_{sessionId}_{DateTime.UtcNow.Ticks}",
            EntityType = "POS_SESSION",
            EntityId = session.Id,
            OperationType = "UPDATE",
            PayloadJson = JsonSerializer.Serialize(new { Status = session.Status, ClosedAt = session.ClosedAt }),
            UserId = operatorId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return settlement;
    }

    public async Task<LocalCashAccount> EnsureCashAccountAsync(string propertyId, string accountType, string name, string? referenceId = null)
    {
        string accountId = referenceId != null ? $"{accountType}_{referenceId}" : $"{accountType}_MAIN";
        var account = await _dbContext.CashAccounts.FindAsync(accountId);
        
        if (account == null)
        {
            account = new LocalCashAccount
            {
                Id = accountId,
                PropertyId = propertyId,
                Name = name,
                Type = accountType,
                OwnerId = referenceId,
                Balance = 0,
                IsActive = true
            };
            _dbContext.CashAccounts.Add(account);
            AppendSyncEvent(
                entityType: "CASH_ACCOUNT",
                entityId: accountId,
                operationType: "CREATE",
                payload: account,
                terminalId: null, // Global to property usually
                sessionId: null,
                outletId: null,
                operatorId: null
            );
            await _dbContext.SaveChangesAsync();
        }
        return account;
    }

    public async Task<LocalPosSettlement> ConfirmHandoverAsync(string sessionId, string managerPin, string deviceId)
    {
        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            var session = await _dbContext.PosSessions.FindAsync(sessionId);
            if (session == null) throw new Exception("Session not found");
            if (session.Status != "PENDING_HANDOVER" && session.Status != "RECONCILIATION_REQUIRED") 
                throw new Exception("Session is not in a handover state.");

            var settlement = await _dbContext.PosSettlements.FirstOrDefaultAsync(s => s.SessionId == sessionId);
            if (settlement == null) throw new Exception("Settlement record not found.");
            if (settlement.Status == "CLOSED") throw new Exception("Settlement has already been confirmed.");

            // Idempotency: Check if a SERVER_HANDOVER movement already exists for this session
            bool handoverExists = await _dbContext.PosCashMovements.AnyAsync(m => m.PosSessionId == sessionId && m.Type == "SERVER_HANDOVER");
            if (handoverExists) throw new Exception("Handover movement already exists for this session.");

            // Authorize Manager
            var authorizer = await ValidateSupervisorPinAsync(managerPin, session.PropertyId);
            if (authorizer == null) throw new UnauthorizedAccessException("Invalid Manager PIN");

            // Separation of Duties check
            if (authorizer.Id == settlement.OperatorId || authorizer.Id == session.UserId)
                throw new UnauthorizedAccessException("The authorizing manager cannot be the same operator who declared the shift.");

            // Resolve correct source account based on BankType
            LodgeCore.Desktop.Data.Entities.LocalCashAccount sourceAccount;
            if (session.BankType == PosConstants.BankTypes.Emergency) {
                sourceAccount = await _dbContext.CashAccounts.FirstOrDefaultAsync(a => a.Type == PosConstants.CashAccountTypes.EmergencyBank && a.OwnerId == session.AuthorizedBy)
                                ?? throw new Exception("Emergency Bank account not found.");
            } else if (session.BankType == PosConstants.BankTypes.Central || session.BankingModel == PosConstants.BankingModels.CentralCashier) {
                sourceAccount = await EnsureCashAccountAsync(session.PropertyId, PosConstants.CashAccountTypes.StationBank, $"Station Bank - {session.UserId}", session.UserId);
            } else {
                sourceAccount = await EnsureCashAccountAsync(session.PropertyId, PosConstants.CashAccountTypes.ServerBank, $"Server Bank - {session.UserId}", session.UserId);
            }
            
            var safeAccount = await EnsureCashAccountAsync(session.PropertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");

            string handoverType = session.BankType == PosConstants.BankTypes.Emergency ? PosConstants.HandoverTypes.EmergencyHandover : 
                                 (session.BankType == PosConstants.BankTypes.Central || session.BankingModel == PosConstants.BankingModels.CentralCashier ? PosConstants.HandoverTypes.StationHandover : PosConstants.HandoverTypes.ServerHandover);

            var prop = await _dbContext.Properties.FindAsync(session.PropertyId);
            string currency = prop?.Currency ?? "NGN";

            var handoverMovement = new LocalPosCashMovement
            {
                Id = Guid.NewGuid().ToString(),
                PropertyId = session.PropertyId,
                PosSessionId = sessionId,
                DeviceId = deviceId,
                UserId = authorizer.Id,
                Amount = settlement.ActualCash, // Actual Cash moved!
                Currency = currency,
                Type = handoverType,
                SourceAccountId = sourceAccount.Id,
                DestinationAccountId = safeAccount.Id,
                ReasonCode = "MANAGER_CONFIRMATION",
                OperationId = $"op_handover_mvt_{deviceId}_{DateTime.UtcNow.Ticks}",
                AuthorizedBy = authorizer.Id,
                CreatedAt = DateTime.UtcNow,
                BusinessDate = session.OpenedAt.Date
            };

            _dbContext.PosCashMovements.Add(handoverMovement);

            settlement.Status = "CLOSED";
            settlement.AuthorizerId = authorizer.Id;

            session.Status = "CLOSED";
            
            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                OperationId = $"op_handover_conf_{deviceId}_{DateTime.UtcNow.Ticks}",
                EntityType = "POS_SESSION",
                EntityId = session.Id,
                OperationType = "UPDATE",
                PayloadJson = JsonSerializer.Serialize(new { Status = "CLOSED" }),
                UserId = authorizer.Id,
                DeviceId = deviceId
            });

            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                OperationId = $"op_settlement_conf_{deviceId}_{DateTime.UtcNow.Ticks}",
                EntityType = "POS_SETTLEMENT",
                EntityId = settlement.Id,
                OperationType = "UPDATE",
                PayloadJson = JsonSerializer.Serialize(new { Status = "CLOSED", AuthorizerId = authorizer.Id }),
                UserId = authorizer.Id,
                DeviceId = deviceId
            });

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
            return settlement;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<(decimal ExpectedCash, decimal Variance, decimal OpeningFloat, decimal CashSales, decimal CardSales, decimal BankTransferSales, decimal RoomChargeSales, decimal OtherSales, decimal TotalSales, decimal CashIn, decimal CashDrops, decimal PaidOuts, decimal TransfersOut, decimal CashRefunds)> GetSessionSettlementDetailsAsync(string sessionId)
    {
        var session = await _dbContext.PosSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");

        var movements = await _dbContext.PosCashMovements
            .Where(m => m.PosSessionId == sessionId)
            .ToListAsync();

        var payments = await _dbContext.PosPayments
            .Include(p => p.OrderId)
            .Where(p => p.Status == "COMPLETED" && _dbContext.PosOrders.Any(o => o.Id == p.OrderId && o.SessionId == sessionId))
            .ToListAsync();

        decimal openingFloat = movements.Where(m => m.Type == "OPENING_FLOAT").Sum(m => m.Amount);
        
        // Sales breakdown
        decimal cashSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.Cash).Sum(p => p.Amount);
        decimal cardSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.Card).Sum(p => p.Amount);
        decimal bankTransferSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.BankTransfer).Sum(p => p.Amount);
        decimal roomChargeSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.RoomCharge).Sum(p => p.Amount);
        decimal otherSales = payments.Where(p => p.Method != PosConstants.PaymentMethods.Cash && p.Method != PosConstants.PaymentMethods.Card && p.Method != PosConstants.PaymentMethods.BankTransfer && p.Method != PosConstants.PaymentMethods.RoomCharge).Sum(p => p.Amount);
        decimal totalSales = payments.Sum(p => p.Amount);

        decimal cashIn = movements.Where(m => m.Type == "CASH_IN" || m.Type == "CASH_TRANSFER_IN").Sum(m => m.Amount);
        decimal cashDrops = movements.Where(m => m.Type == "CASH_DROP").Sum(m => m.Amount);
        decimal paidOuts = movements.Where(m => m.Type == "PAID_OUT").Sum(m => m.Amount);
        decimal transfersOut = movements.Where(m => m.Type == "CASH_TRANSFER_OUT").Sum(m => m.Amount);
        decimal refunds = movements.Where(m => m.Type == "REFUND_CASH").Sum(m => m.Amount);

        decimal expectedCash = openingFloat + cashSales + cashIn - cashDrops - paidOuts - transfersOut - refunds;

        return (
            expectedCash,
            0,
            openingFloat,
            cashSales,
            cardSales,
            bankTransferSales,
            roomChargeSales,
            otherSales,
            totalSales,
            cashIn,
            cashDrops,
            paidOuts,
            transfersOut,
            refunds
        );
    }

    public async Task<List<LocalPosCashMovement>> GetCashMovementsAsync(string sessionId)
    {
        return await _dbContext.PosCashMovements
            .Where(m => m.PosSessionId == sessionId)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();
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

    public async Task<LocalPosCashMovement> RecordCashMovementAsync(string propertyId, string sessionId, decimal amount, string type, string reasonCode, string? notes, string? receiptReference, string? authorizedBy, string userId, string deviceId, string sourceAccountId = "", string destinationAccountId = "")
    {
        string operationId = $"op_cashmvt_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var prop = await _dbContext.Properties.FindAsync(propertyId);
        string currency = prop?.Currency ?? "NGN";

        var movement = new LocalPosCashMovement
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            PosSessionId = sessionId,
            DeviceId = deviceId,
            UserId = userId,
            Amount = amount,
            Currency = currency,
            Type = type,
            SourceAccountId = sourceAccountId,
            DestinationAccountId = destinationAccountId,
            ReasonCode = reasonCode,
            Notes = notes,
            ReceiptReference = receiptReference,
            OperationId = operationId,
            AuthorizedBy = authorizedBy,
            BusinessDate = DateTime.UtcNow.Date,
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

    public async Task<List<object>> GetPendingHandoversAsync(string propertyId)
    {
        var pendingSessions = await _dbContext.PosSessions
            .Where(s => s.PropertyId == propertyId && (s.Status == "PENDING_HANDOVER" || s.Status == "RECONCILIATION_REQUIRED"))
            .ToListAsync();
            
        var settlements = await _dbContext.PosSettlements
            .Where(s => s.PropertyId == propertyId && pendingSessions.Select(p => p.Id).Contains(s.SessionId))
            .ToListAsync();

        return pendingSessions.Select(session => {
            var stl = settlements.FirstOrDefault(s => s.SessionId == session.Id);
            return (object)new {
                Session = session,
                Settlement = stl
            };
        }).ToList();
    }

    public async Task<object> GetCashOfficeOverviewAsync(string propertyId)
    {
        var safeAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");
        
        var pendingHandoversCount = await _dbContext.PosSessions
            .CountAsync(s => s.PropertyId == propertyId && (s.Status == "PENDING_HANDOVER" || s.Status == "RECONCILIATION_REQUIRED"));

        var pendingSessions = await _dbContext.PosSessions
            .Where(s => s.PropertyId == propertyId && (s.Status == "PENDING_HANDOVER" || s.Status == "RECONCILIATION_REQUIRED"))
            .Select(s => s.Id)
            .ToListAsync();
            
        var pendingCashAmount = await _dbContext.PosSettlements
            .Where(s => pendingSessions.Contains(s.SessionId))
            .SumAsync(s => s.ActualCash);

        var today = DateTime.UtcNow.Date;
        
        var safeMovements = await _dbContext.PosCashMovements
            .Where(m => m.PropertyId == propertyId && (m.SourceAccountId == safeAccount.Id || m.DestinationAccountId == safeAccount.Id))
            .ToListAsync();
            
        decimal safeBalance = safeMovements.Where(m => m.DestinationAccountId == safeAccount.Id).Sum(m => m.Amount)
                            - safeMovements.Where(m => m.SourceAccountId == safeAccount.Id).Sum(m => m.Amount);

        decimal todayDeposits = safeMovements
            .Where(m => m.SourceAccountId == safeAccount.Id && m.Type == PosConstants.CashMovementTypes.BankDeposit && m.CreatedAt >= today)
            .Sum(m => m.Amount);

        decimal todayVariances = await _dbContext.PosSettlements
            .Where(s => s.PropertyId == propertyId && s.SettledAt >= today)
            .SumAsync(s => s.Variance);

        return new {
            PendingHandoversCount = pendingHandoversCount,
            PendingCashAmount = pendingCashAmount,
            SafeBalance = safeBalance,
            TodayDeposits = todayDeposits,
            TodayVariances = todayVariances
        };
    }

    public async Task<LocalPosCashMovement> OpenSafeAsync(string propertyId, decimal amount, string managerPin, string deviceId)
    {
        var authorizer = await ValidateSupervisorPinAsync(managerPin, propertyId);
        if (authorizer == null) throw new UnauthorizedAccessException("Invalid Manager PIN");

        var safeAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");
        var externalAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.External, "External Funds");

        // Check if already opened (idempotency check for opening float)
        var exists = await _dbContext.PosCashMovements.AnyAsync(m => m.DestinationAccountId == safeAccount.Id && m.Type == PosConstants.CashMovementTypes.SafeOpeningBalance);
        if (exists) throw new Exception("The safe has already been initialized with an opening balance.");

        var prop = await _dbContext.Properties.FindAsync(propertyId);
        string currency = prop?.Currency ?? "NGN";

        var movement = new LocalPosCashMovement
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            DeviceId = deviceId,
            UserId = authorizer.Id,
            Amount = amount,
            Currency = currency,
            Type = PosConstants.CashMovementTypes.SafeOpeningBalance,
            SourceAccountId = externalAccount.Id,
            DestinationAccountId = safeAccount.Id,
            ReasonCode = "INITIALIZATION",
            Notes = "Initial safe float",
            OperationId = $"op_safe_open_{deviceId}_{DateTime.UtcNow.Ticks}",
            AuthorizedBy = authorizer.Id,
            BusinessDate = DateTime.UtcNow.Date,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosCashMovements.Add(movement);
        await _dbContext.SaveChangesAsync();
        return movement;
    }

    public async Task<List<LocalPosCashMovement>> GetSafeLedgerAsync(string propertyId)
    {
        var safeAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");
        return await _dbContext.PosCashMovements
            .Where(m => m.PropertyId == propertyId && (m.SourceAccountId == safeAccount.Id || m.DestinationAccountId == safeAccount.Id))
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();
    }

    public async Task<LocalPosCashMovement> RecordBankDepositAsync(string propertyId, decimal amount, string reference, string managerPin, string deviceId)
    {
        var authorizer = await ValidateSupervisorPinAsync(managerPin, propertyId);
        if (authorizer == null) throw new UnauthorizedAccessException("Invalid Manager PIN");

        var safeAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");
        var bankAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.BankAccount, "Main Bank Account");

        var safeMovements = await _dbContext.PosCashMovements
            .Where(m => m.PropertyId == propertyId && (m.SourceAccountId == safeAccount.Id || m.DestinationAccountId == safeAccount.Id))
            .ToListAsync();
            
        decimal currentBalance = safeMovements.Where(m => m.DestinationAccountId == safeAccount.Id).Sum(m => m.Amount)
                               - safeMovements.Where(m => m.SourceAccountId == safeAccount.Id).Sum(m => m.Amount);

        if (amount > currentBalance) throw new Exception("Insufficient funds in Central Safe.");

        var prop = await _dbContext.Properties.FindAsync(propertyId);
        string currency = prop?.Currency ?? "NGN";

        var movement = new LocalPosCashMovement
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            DeviceId = deviceId,
            UserId = authorizer.Id,
            Amount = amount,
            Currency = currency,
            Type = PosConstants.CashMovementTypes.BankDeposit,
            SourceAccountId = safeAccount.Id,
            DestinationAccountId = bankAccount.Id,
            ReasonCode = PosConstants.CashMovementTypes.BankDeposit,
            ReceiptReference = reference,
            OperationId = $"op_bank_dep_{deviceId}_{DateTime.UtcNow.Ticks}",
            AuthorizedBy = authorizer.Id,
            BusinessDate = DateTime.UtcNow.Date,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosCashMovements.Add(movement);
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
        if (staff == null || !staff.IsActive || !staff.HasPosAccess || string.IsNullOrEmpty(staff.PosPinHash)) return null;

        // Verify PIN hash using BCrypt
        if (!BCrypt.Net.BCrypt.Verify(pin, staff.PosPinHash)) return null; 

        return staff;
    }

    public async Task<LocalStaff?> AuthenticateDesktopUserAsync(string staffId, string pin)
    {
        // 1. Find active staff with POS access regardless of property (since this is device-level login)
        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == staffId);
        if (staff == null || !staff.IsActive || !staff.HasPosAccess) 
        {
            return null;
        }

        // 2. Enforce Rate Limiting
        var attempt = await _dbContext.LoginAttempts.FirstOrDefaultAsync(a => a.StaffId == staffId);
        if (attempt != null && attempt.LockedUntil.HasValue && attempt.LockedUntil.Value > DateTime.UtcNow)
        {
            throw new Exception($"Account locked due to too many failed attempts. Try again in {(int)(attempt.LockedUntil.Value - DateTime.UtcNow).TotalMinutes} minutes.");
        }

        // 3. Verify PIN Hash using BCrypt
        if (string.IsNullOrEmpty(staff.PosPinHash) || !BCrypt.Net.BCrypt.Verify(pin, staff.PosPinHash))
        {
            if (attempt == null)
            {
                attempt = new LocalLoginAttempt { StaffId = staffId, FailedAttempts = 1, LastAttemptAt = DateTime.UtcNow };
                _dbContext.LoginAttempts.Add(attempt);
            }
            else
            {
                attempt.FailedAttempts++;
                attempt.LastAttemptAt = DateTime.UtcNow;
                if (attempt.FailedAttempts >= 5) // Lock out after 5 failures
                {
                    attempt.LockedUntil = DateTime.UtcNow.AddMinutes(15); // Lock for 15 minutes
                }
            }
            await _dbContext.SaveChangesAsync();
            return null; // Invalid credentials
        }

        // 4. Success -> Clear failed attempts
        if (attempt != null)
        {
            _dbContext.LoginAttempts.Remove(attempt);
            await _dbContext.SaveChangesAsync();
        }

        return staff;
    }

    public async Task<LocalStaff?> ValidateSupervisorPinAsync(string pin, string propertyId)
    {
        // Locate an active supervisor matching this PIN in this property.
        // We have to iterate since we need to verify BCrypt hashes.
        // Get all active supervisors for the property first.
        var supervisors = await _dbContext.Staff
            .Where(s => s.PropertyId == propertyId && s.IsActive && s.Role == "MANAGER")
            .ToListAsync();

        foreach (var s in supervisors)
        {
            if (!string.IsNullOrEmpty(s.PosPinHash) && BCrypt.Net.BCrypt.Verify(pin, s.PosPinHash))
            {
                return s;
            }
        }

        return null;
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

    public async Task<List<LocalProductCategory>> GetCategoriesAsync(string propertyId)
    {
        return await _dbContext.ProductCategories
            .Where(c => c.IsActive && _dbContext.PosOutlets.Any(o => o.Id == c.OutletId && o.PropertyId == propertyId))
            .OrderBy(c => c.SortOrder)
            .ToListAsync();
    }

    public async Task<List<LocalPosOutlet>> GetAuthorizedOutletsAsync(string propertyId, string deviceId)
    {
        return await _dbContext.PosOutlets
            .Where(o => o.PropertyId == propertyId && o.IsActive)
            .ToListAsync();
    }

    public async Task<LocalProperty?> GetPropertyAsync(string propertyId)
    {
        return await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);
    }

    public async Task<LocalPosTerminal?> GetTerminalAsync(string deviceId)
    {
        return await _dbContext.PosTerminals.FirstOrDefaultAsync(t => t.Id == deviceId);
    }

    public async Task<LocalPosOutlet?> GetOutletAsync(string outletId)
    {
        return await _dbContext.PosOutlets.FirstOrDefaultAsync(o => o.Id == outletId);
    }

    public async Task<LocalPosSession?> GetSessionContextAsync(string sessionId)
    {
        return await _dbContext.PosSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
    }

    public async Task<List<LocalPosFloorPlan>> GetFloorPlansAsync(string outletId)
    {
        return await _dbContext.PosFloorPlans
            .Where(fp => fp.OutletId == outletId)
            .OrderBy(fp => fp.SortOrder)
            .ToListAsync();
    }

    public async Task<List<LocalPosTable>> GetTablesAsync(string floorPlanId)
    {
        return await _dbContext.PosTables
            .Where(t => t.FloorPlanId == floorPlanId)
            .ToListAsync();
    }

    public async Task<List<LocalPosProductModifier>> GetProductModifiersAsync(string productId)
    {
        return await _dbContext.PosProductModifiers
            .Where(m => m.ProductId == productId && m.IsActive)
            .ToListAsync();
    }

    public async Task<List<LocalPosOrder>> GetServerOrdersAsync(string staffId, string propertyId, string range, string statusFilter, string? sessionId = null)
    {
        var query = _dbContext.PosOrders
            .Include(o => o.Items)
            .Where(o => o.PropertyId == propertyId && o.ServerStaffId == staffId);

        if (!string.IsNullOrEmpty(sessionId))
        {
            query = query.Where(o => o.SessionId == sessionId);
        }

        if (statusFilter != "all" && !string.IsNullOrEmpty(statusFilter))
        {
            query = query.Where(o => o.Status == statusFilter);
        }

        var now = DateTime.UtcNow;
        if (range == "today")
        {
            var start = now.Date;
            query = query.Where(o => o.BusinessDate >= start);
        }
        else if (range == "yesterday")
        {
            var start = now.Date.AddDays(-1);
            var end = now.Date;
            query = query.Where(o => o.BusinessDate >= start && o.BusinessDate < end);
        }
        else if (range == "this_week")
        {
            var diff = (7 + (now.DayOfWeek - DayOfWeek.Monday)) % 7;
            var start = now.AddDays(-1 * diff).Date;
            query = query.Where(o => o.BusinessDate >= start);
        }

        return await query.OrderByDescending(o => o.BusinessDate).ToListAsync();
    }

    public async Task<object> GetServerSalesAsync(string staffId, string propertyId, string range, string? sessionId = null)
    {
        var query = _dbContext.PosOrders
            .Where(o => o.PropertyId == propertyId && o.ServerStaffId == staffId);

        if (!string.IsNullOrEmpty(sessionId))
        {
            query = query.Where(o => o.SessionId == sessionId);
        }
        
        var now = DateTime.UtcNow;
        if (range == "today")
        {
            var start = now.Date;
            query = query.Where(o => o.BusinessDate >= start);
        }
        // ... (similar range logic)

        var orders = await query.ToListAsync();

        var payments = await _dbContext.PosPayments
            .Where(p => orders.Select(o => o.Id).Contains(p.OrderId))
            .ToListAsync();

        var totalSales = orders.Where(o => o.Status != "VOIDED").Sum(o => o.Total);
        // Assuming tip is collected differently, for now we sum 0 or a hypothetical field
        var totalTips = orders.Sum(o => o.TipAmount); 
        var totalVoids = orders.Where(o => o.Status == "VOIDED").Sum(o => o.Total);
        var orderCount = orders.Count;

        return new
        {
            sales = totalSales,
            tips = totalTips,
            voids = totalVoids,
            orderCount = orderCount
        };
    }
    public async Task LogHardwareEventAsync(string userId, string deviceId, string eventType, string? payload)
    {
        _dbContext.HardwareAuditLogs.Add(new LodgeCore.Desktop.Data.Entities.LocalHardwareAuditLog
        {
            UserId    = userId,
            DeviceId  = deviceId,
            EventType = eventType,
            Payload   = payload,
            CreatedAt = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();
    }
    public void AppendSyncEvent(string entityType, string entityId, string operationType, object payload, string? terminalId, string? outletId, string? sessionId, string? operatorId)
    {
        var payloadJson = System.Text.Json.JsonSerializer.Serialize(payload);
        var hashBytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(payloadJson));
        var payloadHash = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();

        long maxDbSeq = _dbContext.SyncEvents.Where(e => e.TerminalId == terminalId).Max(e => (long?)e.SequenceNumber) ?? 0;
        long maxLocalSeq = _dbContext.SyncEvents.Local.Where(e => e.TerminalId == terminalId).Max(e => (long?)e.SequenceNumber) ?? 0;
        long seq = Math.Max(maxDbSeq, maxLocalSeq) + 1;

        var syncEvent = new LodgeCore.Desktop.Data.Entities.LocalSyncEvent
        {
            OperationId = $"op_{terminalId}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}",
            SequenceNumber = seq,
            TerminalId = terminalId ?? string.Empty,
            OutletId = outletId ?? string.Empty,
            SessionId = sessionId ?? string.Empty,
            OperatorId = operatorId ?? string.Empty,
            EntityType = entityType,
            EntityId = entityId ?? string.Empty,
            OperationType = operationType,
            PayloadJson = payloadJson,
            PayloadHash = payloadHash,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.SyncEvents.Add(syncEvent);
    }

    public async Task<LodgeCore.Desktop.Data.Entities.LocalPosSession?> GetActiveServerBankAsync(string staffId, string propertyId, string outletId)
    {
        return await _dbContext.PosSessions
            .FirstOrDefaultAsync(s => s.PrimaryOperatorId == staffId && s.OutletId == outletId && s.Status == "OPEN" && s.BankType == "SERVER");
    }

    public async Task<LodgeCore.Desktop.Data.Entities.LocalPosSession?> GetActiveSessionForDeviceAsync(string deviceId)
    {
        return await _dbContext.PosSessions
            .FirstOrDefaultAsync(s => s.DeviceId == deviceId && s.Status == "OPEN");
    }

    public async Task<string> EnsureActiveServerBankAsync(string staffId, string propertyId, string outletId, string deviceId, string bankingModel = "SERVER_BANKING", string bankType = "SERVER")
    {
        var activeSession = await GetActiveServerBankAsync(staffId, propertyId, outletId);
        if (activeSession != null)
        {
            return activeSession.Id;
        }

        var newSession = new LodgeCore.Desktop.Data.Entities.LocalPosSession
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            OutletId = outletId,
            DeviceId = deviceId,
            UserId = staffId,
            Status = "OPEN",
            BankingModel = bankingModel,
            BankType = bankType,
            PrimaryOperatorId = staffId,
            OpenedAt = DateTime.UtcNow,
            OpeningBalance = 0,
            ExpectedCash = 0,
            StaffId = staffId
        };

        _dbContext.PosSessions.Add(newSession);

        AppendSyncEvent(
            entityType: "POS_SESSION",
            entityId: newSession.Id,
            operationType: "CREATE",
            payload: newSession,
            terminalId: deviceId,
            outletId: outletId,
            sessionId: newSession.Id,
            operatorId: staffId
        );

        await _dbContext.SaveChangesAsync();
        return newSession.Id;
    }

    public async Task<string> EnsureEmergencyBankAsync(string managerId, string managerName, string primaryOperatorId, string deviceId, string outletId, string propertyId, string reason)
    {
        // 1. Concurrency Check: Verify no existing OPEN emergency bank for this terminal
        var existingSession = await _dbContext.PosSessions
            .FirstOrDefaultAsync(s => s.DeviceId == deviceId && s.Status == "OPEN" && s.BankingModel == "EMERGENCY_MANAGER");

        if (existingSession != null)
        {
            return existingSession.Id;
        }

        // 2. Create Emergency Session
        var sessionId = Guid.NewGuid().ToString();
        var newSession = new LodgeCore.Desktop.Data.Entities.LocalPosSession
        {
            Id = sessionId,
            PropertyId = propertyId,
            OutletId = outletId,
            DeviceId = deviceId,
            UserId = primaryOperatorId, // Maintains waiter's identity as operator
            Status = "OPEN",
            BankingModel = "EMERGENCY_MANAGER",
            BankType = "EMERGENCY",
            PrimaryOperatorId = primaryOperatorId, // Acting For
            AuthorizedBy = managerId, // Manager Identity
            Reason = reason,
            OpenedAt = DateTime.UtcNow,
            OpeningBalance = 0,
            ExpectedCash = 0,
            StaffId = primaryOperatorId
        };

        _dbContext.PosSessions.Add(newSession);

        // 3. Create explicit LocalCashAccount for this Emergency Session
        var cashAccountId = Guid.NewGuid().ToString();
        var newAccount = new LodgeCore.Desktop.Data.Entities.LocalCashAccount
        {
            Id = cashAccountId,
            PropertyId = propertyId,
            OutletId = outletId,
            Type = PosConstants.CashAccountTypes.EmergencyBank,
            Name = $"Emergency Bank - {managerName} - {DateTime.UtcNow:HH:mm}",
            Balance = 0,
            OwnerId = managerId,
            IsActive = true
        };
        _dbContext.CashAccounts.Add(newAccount);

        AppendSyncEvent(
            entityType: "CASH_ACCOUNT",
            entityId: cashAccountId,
            operationType: "CREATE",
            payload: newAccount,
            terminalId: deviceId,
            sessionId: sessionId,
            outletId: outletId,
            operatorId: managerId
        );

        AppendSyncEvent(
            entityType: "POS_SESSION",
            entityId: sessionId,
            operationType: "CREATE",
            payload: newSession,
            terminalId: deviceId,
            outletId: outletId,
            sessionId: sessionId,
            operatorId: managerId
        );

        await _dbContext.SaveChangesAsync();
        return sessionId;
    }
}
