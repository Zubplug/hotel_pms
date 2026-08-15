using System.Net.Http.Json;
using System.Text.Json;
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

    /// <summary>
    /// Updates a command's status (and optionally error info) via PATCH.
    /// </summary>
    public async Task UpdateCommandStatusAsync(
        string commandId, 
        string status, 
        string? errorCode = null, 
        string? errorMessage = null)
    {
        try
        {
            var update = new CommandStatusUpdate 
            { 
                Status = status,
                ErrorCode = errorCode,
                ErrorMessage = errorMessage
            };

            await SendPatchAsync(commandId, update);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update command {CommandId} to {Status}", commandId, status);
        }
    }

    /// <summary>
    /// Updates a command to COMPLETED status and attaches structured response data.
    /// Used by READ_CARD so the PMS can inspect the card contents.
    /// </summary>
    public async Task UpdateCommandWithResponseAsync(string commandId, object responseData)
    {
        try
        {
            var update = new
            {
                Status = "COMPLETED",
                Data = responseData
            };

            await SendPatchAsync(commandId, update);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update command {CommandId} with response data", commandId);
        }
    }

    private async Task SendPatchAsync(string commandId, object body)
    {
        var req = new HttpRequestMessage(HttpMethod.Patch, $"{_settings.ApiUrl}/hardware/commands/{commandId}");
        req.Headers.Add("Authorization", $"Bearer {_authenticator.AccessToken}");
        req.Content = JsonContent.Create(body);

        var res = await _http.SendAsync(req);

        if (!res.IsSuccessStatusCode)
        {
            var responseBody = await res.Content.ReadAsStringAsync();
            _logger.LogWarning(
                "PATCH command/{CommandId} returned {StatusCode}: {Body}",
                commandId, (int)res.StatusCode, responseBody);
        }
        else
        {
            _logger.LogInformation("Successfully updated command {CommandId}", commandId);
        }
    }
}
