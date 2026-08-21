using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

public enum ServiceState
{
    NotStarted,
    Starting,
    Running,
    Stopping,
    Stopped,
    Error
}

public class DesktopServiceManager
{
    private readonly IEnumerable<IHostedService> _hostedServices;
    private readonly ILogger<DesktopServiceManager> _logger;
    private readonly ConcurrentDictionary<string, ServiceState> _serviceHealth = new();

    // 0 = NotStarted, 1 = Starting, 2 = Started, 3 = Stopping, 4 = Stopped
    private int _lifecycleState = 0; 
    
    public DesktopServiceManager(IEnumerable<IHostedService> hostedServices, ILogger<DesktopServiceManager> logger)
    {
        _hostedServices = hostedServices;
        _logger = logger;
        
        foreach (var service in _hostedServices)
        {
            _serviceHealth[service.GetType().Name] = ServiceState.NotStarted;
        }
    }

    public IReadOnlyDictionary<string, ServiceState> GetServiceHealth() => _serviceHealth;

    public async Task StartAllAsync(CancellationToken cancellationToken = default)
    {
        // Atomically transition from 0 (NotStarted) to 1 (Starting)
        if (Interlocked.CompareExchange(ref _lifecycleState, 1, 0) != 0)
        {
            _logger.LogInformation("DesktopServiceManager is already started or starting.");
            return;
        }

        _logger.LogInformation("Starting DesktopServiceManager background services...");

        var startTasks = new List<Task>();

        foreach (var service in _hostedServices)
        {
            var serviceName = service.GetType().Name;
            _serviceHealth[serviceName] = ServiceState.Starting;

            // Start services concurrently but safely capture individual failures
            var startTask = Task.Run(async () =>
            {
                try
                {
                    await service.StartAsync(cancellationToken);
                    _serviceHealth[serviceName] = ServiceState.Running;
                    _logger.LogInformation($"Service {serviceName} started successfully.");
                }
                catch (Exception ex)
                {
                    _serviceHealth[serviceName] = ServiceState.Error;
                    _logger.LogError(ex, $"Failed to start service {serviceName}");
                }
            }, cancellationToken);

            startTasks.Add(startTask);
        }

        await Task.WhenAll(startTasks);
        
        // Transition to 2 (Started)
        Interlocked.Exchange(ref _lifecycleState, 2);
        _logger.LogInformation("DesktopServiceManager startup sequence completed.");
    }

    public async Task StopAllAsync(CancellationToken cancellationToken = default)
    {
        // Only transition to Stopping (3) if we are in Started (2) or Starting (1)
        var currentState = Interlocked.CompareExchange(ref _lifecycleState, 3, 2);
        if (currentState != 2)
        {
            currentState = Interlocked.CompareExchange(ref _lifecycleState, 3, 1);
            if (currentState != 1)
            {
                _logger.LogInformation("DesktopServiceManager is already stopped, stopping, or never started.");
                return;
            }
        }

        _logger.LogInformation("Stopping DesktopServiceManager background services...");

        var stopTasks = new List<Task>();

        foreach (var service in _hostedServices)
        {
            var serviceName = service.GetType().Name;
            _serviceHealth[serviceName] = ServiceState.Stopping;

            var stopTask = Task.Run(async () =>
            {
                try
                {
                    await service.StopAsync(cancellationToken);
                    _serviceHealth[serviceName] = ServiceState.Stopped;
                    _logger.LogInformation($"Service {serviceName} stopped successfully.");
                }
                catch (Exception ex)
                {
                    _serviceHealth[serviceName] = ServiceState.Error;
                    _logger.LogError(ex, $"Error stopping service {serviceName}");
                }
            }, cancellationToken);

            stopTasks.Add(stopTask);
        }

        await Task.WhenAll(stopTasks);

        // Transition to 4 (Stopped)
        Interlocked.Exchange(ref _lifecycleState, 4);
        _logger.LogInformation("DesktopServiceManager shutdown sequence completed.");
    }
}
