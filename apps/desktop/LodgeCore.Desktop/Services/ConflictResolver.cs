using System.Text.Json;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Handles logical conflicts when the cloud API rejects a LocalSyncEvent with a 409 Conflict.
/// </summary>
public class ConflictResolver
{
    private readonly LocalDbContext _dbContext;
    private readonly ILogger<ConflictResolver> _logger;

    public ConflictResolver(LocalDbContext dbContext, ILogger<ConflictResolver> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Processes all sync events currently marked as CONFLICT.
    /// </summary>
    public async Task ResolveConflictsAsync()
    {
        var conflicts = await _dbContext.SyncEvents
            .Where(e => e.Status == "CONFLICT")
            .ToListAsync();

        if (!conflicts.Any()) return;

        foreach (var conflict in conflicts)
        {
            _logger.LogInformation($"Attempting to resolve conflict for Event {conflict.OperationId} ({conflict.OperationType})");

            if (conflict.EntityType == "RESERVATION" && conflict.OperationType == "ASSIGN_ROOM")
            {
                await HandleDoubleBookingConflictAsync(conflict);
            }
            else if (conflict.EntityType == "FOLIO")
            {
                await HandleFolioConflictAsync(conflict);
            }
            else
            {
                // Fallback: Flag for manual intervention
                conflict.Status = "REQUIRES_MANUAL_REVIEW";
            }
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task HandleDoubleBookingConflictAsync(LocalSyncEvent conflict)
    {
        var reservation = await _dbContext.Reservations.FindAsync(conflict.EntityId);
        if (reservation != null)
        {
            // If the local walk-in was checked in offline, they physically have the key.
            // We flag the local reservation to warn the receptionist that the cloud rejected it,
            // so they can manually move the online booking to a different room via the cloud UI.
            
            // Revert the sync event status so it doesn't block the queue indefinitely, 
            // but add an alert to the reservation.
            reservation.Status = "CONFLICT_REVIEW"; 
            conflict.Status = "RESOLVED_LOCALLY";
            
            _logger.LogWarning($"Reservation {reservation.Id} flagged for conflict review. Local guest has priority.");
        }
    }

    private async Task HandleFolioConflictAsync(LocalSyncEvent conflict)
    {
        // Financials are usually append-only operations (ADD_CHARGE, ADD_PAYMENT).
        // If a conflict occurs, it's likely a versioning mismatch.
        // We force-push append operations by generating a new operation ID.
        
        _logger.LogInformation("Folio conflict detected. Converting to new append operation.");
        
        conflict.Status = "RESOLVED_LOCALLY"; // Retire old event
        
        var retryEvent = new LocalSyncEvent
        {
            EntityType = conflict.EntityType,
            EntityId = conflict.EntityId,
            OperationType = conflict.OperationType,
            PayloadJson = conflict.PayloadJson,
            UserId = conflict.UserId,
            DeviceId = conflict.DeviceId,
            Status = "PENDING" // Queue it up again as a fresh append
        };
        
        _dbContext.SyncEvents.Add(retryEvent);
    }
}
