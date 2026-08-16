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
}
