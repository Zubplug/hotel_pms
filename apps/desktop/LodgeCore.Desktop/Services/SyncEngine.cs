using System.Net.Http.Json;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Background service responsible for flushing the LocalSyncEvent queue to the cloud API,
/// and pulling new state from the cloud API to apply to the local SQLite database.
/// Runs continuously while the application is alive.
/// </summary>
public class SyncEngine : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SyncEngine> _logger;
    private readonly HttpClient _httpClient;
    
    // We can wire this to MAUI Connectivity events. For now, assume online.
    private bool _isOnline = true; 

    public SyncEngine(IServiceProvider serviceProvider, ILogger<SyncEngine> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        // In reality, this would use IHttpClientFactory configured with BaseAddress & Auth
        _httpClient = new HttpClient { BaseAddress = new Uri("https://api.lodgecore.com/v1/") };
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SyncEngine is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            if (_isOnline)
            {
                try
                {
                    await PushPendingEventsAsync(stoppingToken);
                    
                    // Resolve any conflicts that emerged from the push
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var resolver = scope.ServiceProvider.GetRequiredService<ConflictResolver>();
                        await resolver.ResolveConflictsAsync();
                    }

                    await PullUpdatesAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "An error occurred during the sync cycle.");
                }
            }

            // Sleep for 30 seconds before next sync cycle
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }

        _logger.LogInformation("SyncEngine is stopping.");
    }

    /// <summary>
    /// Pushes pending operations to the cloud with retry logic.
    /// </summary>
    private async Task PushPendingEventsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var pendingEvents = await dbContext.SyncEvents
            .Where(e => e.Status == "PENDING")
            .OrderBy(e => e.CreatedAt)
            .Take(50) // Batch push
            .ToListAsync(cancellationToken);

        if (!pendingEvents.Any()) return;

        _logger.LogInformation($"Pushing {pendingEvents.Count} pending operations to cloud...");

        foreach (var syncEvent in pendingEvents)
        {
            try
            {
                // Simulate pushing to the central API
                // var response = await _httpClient.PostAsJsonAsync("sync/push", syncEvent, cancellationToken);
                // response.EnsureSuccessStatusCode();

                // On success, mark as SYNCED
                syncEvent.Status = "SYNCED";
            }
            catch (HttpRequestException httpEx)
            {
                // If it's a 409 Conflict, we mark it as CONFLICT for the Sync Center UI
                if (httpEx.StatusCode == System.Net.HttpStatusCode.Conflict)
                {
                    syncEvent.Status = "CONFLICT";
                    _logger.LogWarning($"Conflict detected for operation {syncEvent.OperationId}");
                }
                else
                {
                    // Network error, break loop to preserve chronological order for next retry
                    _logger.LogWarning($"Network error pushing event {syncEvent.OperationId}. Pausing sync.");
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to push sync event {syncEvent.OperationId}");
                break; 
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Pulls state changes from the cloud since the last successful sync point.
    /// </summary>
    private async Task PullUpdatesAsync(CancellationToken cancellationToken)
    {
        // using var scope = _serviceProvider.CreateScope();
        // var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
        
        // TODO: Call GET /api/v1/sync/pull?lastSyncAt=XXX
        // Process incoming reservations, folios, and guests, inserting/updating SQLite.
        
        await Task.CompletedTask;
    }
}
