using LodgeCore.HardwareAgent.Communication;
using LodgeCore.HardwareAgent.Commands;

namespace LodgeCore.HardwareAgent;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly WebSocketClient _wsClient;
    private readonly CommandProcessor _commandProcessor;
    private readonly AgentAuthenticator _authenticator;

    public Worker(
        ILogger<Worker> logger,
        WebSocketClient wsClient,
        CommandProcessor commandProcessor,
        AgentAuthenticator authenticator)
    {
        _logger = logger;
        _wsClient = wsClient;
        _commandProcessor = commandProcessor;
        _authenticator = authenticator;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Hardware Agent starting...");

        // 1. Authenticate with the cloud
        var isAuthenticated = await _authenticator.AuthenticateAsync(stoppingToken);
        if (!isAuthenticated)
        {
            _logger.LogCritical("Failed to authenticate agent. Shutting down.");
            return;
        }

        // 2. Start the command processor (strictly serialized)
        var processorTask = _commandProcessor.StartAsync(stoppingToken);

        // 3. Connect WebSocket and start receiving messages
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _wsClient.ConnectAndListenAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "WebSocket connection lost. Reconnecting in 5s...");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }

        await processorTask;
    }
}
