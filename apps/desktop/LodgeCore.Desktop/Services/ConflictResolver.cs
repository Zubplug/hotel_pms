using System.Text.Json;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Advanced Conflict Resolver enforcing Phase 9G strict classification policies.
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

    public async Task ResolveConflictsAsync()
    {
        var conflicts = await _dbContext.SyncEvents
            .Where(e => e.Status == "CONFLICT")
            .ToListAsync();

        if (!conflicts.Any()) return;

        foreach (var conflict in conflicts)
        {
            _logger.LogInformation($"Analyzing conflict for Event {conflict.OperationId} ({conflict.EntityType}:{conflict.OperationType})");

            try
            {
                if (IsFinancialConflict(conflict))
                {
                    await HandleFinancialConflictAsync(conflict);
                }
                else if (IsSafeAutoResolve(conflict))
                {
                    await HandleSafeAutoResolveAsync(conflict);
                }
                else
                {
                    await HandleManagerReviewRequiredAsync(conflict);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to process conflict {conflict.OperationId}");
            }
        }

        await _dbContext.SaveChangesAsync();
    }

    private bool IsFinancialConflict(LocalSyncEvent conflict)
    {
        // Any modification to a Folio or Payment is strictly a financial conflict
        return conflict.EntityType == "FOLIO" || 
               conflict.OperationType == "ADD_CHARGE" || 
               conflict.OperationType == "ADD_PAYMENT" || 
               conflict.OperationType == "REFUND";
    }

    private bool IsSafeAutoResolve(LocalSyncEvent conflict)
    {
        // Safe if it's a pure metadata update (e.g. updating guest notes) 
        // or an explicitly idempotent operation that the cloud says is "already applied".
        // (Assuming the cloud returns specific error details we could parse in PayloadJson,
        // but for now we define metadata updates as safe).
        return conflict.OperationType == "UPDATE_NOTES" || 
               conflict.OperationType == "UPDATE_METADATA";
    }

    private async Task HandleFinancialConflictAsync(LocalSyncEvent conflict)
    {
        _logger.LogWarning($"FINANCIAL CONFLICT on {conflict.OperationId}. Preserving ledger state and generating reconciliation task.");
        
        // 1. Never silently resolve. 
        // 2. Preserve both records (the cloud state is preserved there, local state is preserved here).
        conflict.Status = "FINANCIAL_RECONCILIATION_REQUIRED";
        
        // 3. Create a reconciliation task for the Night Auditor
        var task = new LocalHousekeepingTask // Re-using Task table, or ideally a new LocalReconciliationTask table
        {
            TaskType = "FINANCIAL_RECONCILIATION",
            Status = "PENDING",
            Notes = $"Financial discrepancy detected during sync of {conflict.EntityType} {conflict.EntityId}. Operation: {conflict.OperationType}. Amount/Details in Payload.",
            RoomId = conflict.EntityId // Linking to Folio/Reservation ID for reference
        };
        
        _dbContext.HousekeepingTasks.Add(task);
    }

    private async Task HandleSafeAutoResolveAsync(LocalSyncEvent conflict)
    {
        _logger.LogInformation($"SAFE AUTO-RESOLVE applied for {conflict.OperationId}.");
        
        // Mark as resolved. The local state remains as is, but we drop the sync attempt.
        conflict.Status = "RESOLVED_AUTO";
    }

    private async Task HandleManagerReviewRequiredAsync(LocalSyncEvent conflict)
    {
        _logger.LogWarning($"MANAGER REVIEW REQUIRED for {conflict.OperationId}. Esculating to Sync Center.");
        
        // Escalate to the Sync Center dashboard
        conflict.Status = "REQUIRES_MANUAL_REVIEW";
        
        // If this is a room assignment conflict, flag the reservation locally so the UI highlights it.
        if (conflict.EntityType == "RESERVATION")
        {
            var res = await _dbContext.Reservations.FindAsync(conflict.EntityId);
            if (res != null)
            {
                res.Status = "CONFLICT_REVIEW";
            }
        }
    }
}
