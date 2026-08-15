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

    public async Task EnsureDatabaseCreatedAsync()
    {
        await _dbContext.Database.EnsureCreatedAsync();
    }
}
