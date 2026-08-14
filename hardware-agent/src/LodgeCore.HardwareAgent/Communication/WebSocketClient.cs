using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using LodgeCore.HardwareAgent.Commands;
using Microsoft.Extensions.Options;

namespace LodgeCore.HardwareAgent.Communication;

public class WebSocketClient
{
    private readonly ILogger<WebSocketClient> _logger;
    private readonly AgentSettings _settings;
    private readonly AgentAuthenticator _authenticator;
    private readonly CommandQueue _commandQueue;

    public WebSocketClient(
        ILogger<WebSocketClient> logger,
        IOptions<AgentSettings> options,
        AgentAuthenticator authenticator,
        CommandQueue commandQueue)
    {
        _logger = logger;
        _settings = options.Value;
        _authenticator = authenticator;
        _commandQueue = commandQueue;
    }

    public async Task ConnectAndListenAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(_authenticator.AccessToken))
            throw new InvalidOperationException("Not authenticated");

        using var ws = new ClientWebSocket();
        ws.Options.SetRequestHeader("Authorization", $"Bearer {_authenticator.AccessToken}");
        ws.Options.SetRequestHeader("X-Agent-ID", _settings.AgentId);

        var uri = new Uri(_settings.WsUrl);
        _logger.LogInformation("Connecting to WebSocket at {WsUrl}...", uri);
        
        await ws.ConnectAsync(uri, cancellationToken);
        _logger.LogInformation("WebSocket connected.");

        var buffer = new byte[8192];
        while (ws.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
        {
            var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", cancellationToken);
                break;
            }

            var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
            ProcessMessage(message);
        }
    }

    private void ProcessMessage(string jsonMessage)
    {
        try
        {
            // Parse incoming JSON
            using var doc = JsonDocument.Parse(jsonMessage);
            var root = doc.RootElement;
            
            if (root.TryGetProperty("type", out var typeProp) && typeProp.GetString() == "COMMAND_DISPATCH")
            {
                var commandStr = root.GetProperty("command").GetRawText();
                var cmd = JsonSerializer.Deserialize<LockCommand>(commandStr, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                
                if (cmd != null)
                {
                    _logger.LogInformation("Received command {CommandId} via WebSocket.", cmd.Id);
                    _commandQueue.Enqueue(cmd);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse incoming WebSocket message.");
        }
    }
}
