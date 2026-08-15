using LodgeCore.Desktop.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Background service responsible for flushing the LocalSyncEvent queue to the cloud API,
/// and pulling new state from the cloud API to apply to the local SQLite database.
/// </summary>
public class SyncEngine
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SyncEngine> _logger;
    private bool _isOnline = false; // We can wire this to MAUI Connectivity events

    public SyncEngine(IServiceProvider serviceProvider, ILogger<SyncEngine> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    /// <summary>
    /// Pushes pending operations to the cloud.
    /// </summary>
    public async Task PushPendingEventsAsync()
    {
        if (!_isOnline) return;

        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var pendingEvents = await dbContext.SyncEvents
            .Where(e => e.Status == "PENDING")
            .OrderBy(e => e.CreatedAt)
            .ToListAsync();

        if (!pendingEvents.Any()) return;

        _logger.LogInformation($"Pushing {pendingEvents.Count} pending operations to cloud...");

        foreach (var syncEvent in pendingEvents)
        {
            try
            {
                // TODO: POST /api/v1/sync/push with payload
                // simulate success:
                syncEvent.Status = "SYNCED";
                
                // Real implementation would handle HTTP 409 Conflicts here
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to push sync event {syncEvent.OperationId}");
                // Break to preserve ordering
                break; 
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
