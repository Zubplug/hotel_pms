using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace LodgeCore.LockAgent.Commands;

/// <summary>
/// HTTP client for communicating with the LodgeCore PMS.
/// Polls for queued commands and reports results.
/// All requests use Basic auth: base64(agentId:agentSecret).
/// </summary>
public sealed class PmsClient
{
    private readonly HttpClient _http;
    private readonly ILogger<PmsClient> _logger;
    private string _authHeader = string.Empty;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public PmsClient(HttpClient http, ILogger<PmsClient> logger)
    {
        _http   = http;
        _logger = logger;
    }

    public void SetCredentials(string agentId, string agentSecret)
    {
        var token = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{agentId}:{agentSecret}"));
        _authHeader = $"Basic {token}";
    }

    /// <summary>Poll for the next QUEUED command. Returns null if nothing pending.</summary>
    public async Task<PmsCommand?> PollCommandAsync(CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/v1/hardware/commands");
        req.Headers.Authorization = AuthenticationHeaderValue.Parse(_authHeader);

        var resp = await _http.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Poll returned {Status}", resp.StatusCode);
            return null;
        }

        var body = await resp.Content.ReadAsStringAsync(ct);
        var envelope = JsonSerializer.Deserialize<ApiEnvelope<CommandEnvelope>>(body, JsonOpts);
        return envelope?.Data?.Command;
    }

    /// <summary>Report command result back to PMS.</summary>
    public async Task ReportResultAsync(string commandId, CommandResult result, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/hardware/commands/{commandId}");
        req.Headers.Authorization = AuthenticationHeaderValue.Parse(_authHeader);
        req.Content = JsonContent.Create(result, options: JsonOpts);

        var resp = await _http.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
            _logger.LogWarning("ReportResult returned {Status} for command {Id}", resp.StatusCode, commandId);
    }

    /// <summary>Send heartbeat with current hardware status.</summary>
    public async Task HeartbeatAsync(string hardwareStatus, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/hardware/heartbeat");
        req.Headers.Authorization = AuthenticationHeaderValue.Parse(_authHeader);
        req.Content = JsonContent.Create(new { hardwareStatus });

        try
        {
            await _http.SendAsync(req, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Heartbeat failed — PMS unreachable");
        }
    }
}

// ── DTO types ─────────────────────────────────────────────────────────────────

public sealed class PmsCommand
{
    public string Id          { get; set; } = string.Empty;
    public string CommandType { get; set; } = string.Empty; // ENCODE | CANCEL_CARD | PING
    public JsonElement? Payload { get; set; }
}

public sealed class CommandResult
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;           // COMPLETED | FAILED

    [JsonPropertyName("operationStatus")]
    public string? OperationStatus { get; set; }

    [JsonPropertyName("errorCode")]
    public string? ErrorCode { get; set; }

    [JsonPropertyName("errorMessage")]
    public string? ErrorMessage { get; set; }

    [JsonPropertyName("cardSnr")]
    public string? CardSnr { get; set; }
}

internal record CommandEnvelope(PmsCommand? Command);
internal record ApiEnvelope<T>(T? Data);
