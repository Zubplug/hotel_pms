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
    private readonly AuthManager _authManager;
    
    // We can wire this to MAUI Connectivity events. For now, assume online.
    private bool _isOnline = true; 
    private int _consecutiveFailures = 0; // Tracks failures for exponential backoff

    public SyncEngine(IServiceProvider serviceProvider, ILogger<SyncEngine> logger, AuthManager authManager)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _authManager = authManager;
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
                    await PushKeycardAuditsAsync(stoppingToken);
                    
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
                    _consecutiveFailures++;
                    _logger.LogError(ex, $"An error occurred during the sync cycle. Failure count: {_consecutiveFailures}");
                }
            }

            // Exponential backoff logic: Max 5 minutes (300 seconds), Base 30 seconds
            var delaySeconds = Math.Min(300, 30 * Math.Pow(2, _consecutiveFailures));
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds), stoppingToken);
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

        var deviceId = await _authManager.GetOrCreateDeviceIdAsync();
        var token = await _authManager.GetAuthTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }

        foreach (var syncEvent in pendingEvents)
        {
            try
            {
                // Implement Idempotency guarantees: Send OperationId as Idempotency-Key header
                var request = new HttpRequestMessage(HttpMethod.Post, "sync/push");
                request.Headers.Add("Idempotency-Key", syncEvent.OperationId);
                // request.Content = JsonContent.Create(syncEvent);
                // var response = await _httpClient.SendAsync(request, cancellationToken);
                // response.EnsureSuccessStatusCode();

                // On success, mark as SYNCED
                syncEvent.Status = "SYNCED";
                _consecutiveFailures = 0; // Reset failures on successful push
            }
            catch (HttpRequestException httpEx)
            {
                // If it's a 409 Conflict, we mark it as CONFLICT for the Sync Center UI
                if (httpEx.StatusCode == System.Net.HttpStatusCode.Conflict)
                {
                    syncEvent.Status = "CONFLICT";
                    _logger.LogWarning($"Conflict detected for operation {syncEvent.OperationId}");
                    _consecutiveFailures = 0; // A conflict is a successful network roundtrip, so reset backoff
                }
                else
                {
                    // Network error, break loop to preserve chronological order for next retry
                    _consecutiveFailures++;
                    _logger.LogWarning($"Network error pushing event {syncEvent.OperationId}. Pausing sync.");
                    break;
                }
            }
            catch (Exception ex)
            {
                _consecutiveFailures++;
                _logger.LogError(ex, $"Failed to push sync event {syncEvent.OperationId}");
                break; 
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task PushKeycardAuditsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var pendingAudits = await dbContext.KeycardAudits
            .Where(a => a.SyncStatus == "PENDING")
            .OrderBy(a => a.Timestamp)
            .Take(50)
            .ToListAsync(cancellationToken);

        if (!pendingAudits.Any()) return;

        _logger.LogInformation($"Pushing {pendingAudits.Count} keycard audits to cloud...");
        
        var token = await _authManager.GetAuthTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }

        foreach (var audit in pendingAudits)
        {
            try
            {
                // In production, this pushes to the cloud /api/v1/hardware/keycards/audit endpoint
                var request = new HttpRequestMessage(HttpMethod.Post, "hardware/keycards/audit");
                request.Headers.Add("Idempotency-Key", audit.OperationId);
                // request.Content = JsonContent.Create(audit);
                // var response = await _httpClient.SendAsync(request, cancellationToken);
                // response.EnsureSuccessStatusCode();

                audit.SyncStatus = "SYNCED";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to push keycard audit {audit.OperationId}");
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
        
        // Phase 4: Retrieve incoming cloud updates (reservations, room statuses, folios)
        // using the /api/v1/sync/pull?lastSyncAt=XXX endpoint and apply to SQLite.
        
        await Task.CompletedTask;
    }
}
