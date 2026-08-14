using System.Net.Http.Json;
using LodgeCore.HardwareAgent.Commands;
using Microsoft.Extensions.Options;

namespace LodgeCore.HardwareAgent.Communication;

public class LodgeCoreClient
{
    private readonly HttpClient _http;
    private readonly AgentSettings _settings;
    private readonly AgentAuthenticator _authenticator;
    private readonly ILogger<LodgeCoreClient> _logger;

    public LodgeCoreClient(
        HttpClient http, 
        IOptions<AgentSettings> options,
        AgentAuthenticator authenticator,
        ILogger<LodgeCoreClient> logger)
    {
        _http = http;
        _settings = options.Value;
        _authenticator = authenticator;
        _logger = logger;
    }

    public async Task UpdateCommandStatusAsync(string commandId, string status, string? errorCode = null, string? errorMessage = null)
    {
        try
        {
            var update = new CommandStatusUpdate 
            { 
                Status = status,
                ErrorCode = errorCode,
                ErrorMessage = errorMessage
            };

            var req = new HttpRequestMessage(HttpMethod.Patch, $"{_settings.ApiUrl}/hardware/commands/{commandId}");
            req.Headers.Add("Authorization", $"Bearer {_authenticator.AccessToken}");
            req.Content = JsonContent.Create(update);

            var res = await _http.SendAsync(req);
            res.EnsureSuccessStatusCode();
            
            _logger.LogInformation("Successfully updated command {CommandId} to {Status}", commandId, status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update command {CommandId} to {Status}", commandId, status);
        }
    }
}
