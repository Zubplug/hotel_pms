using System.Text.Json;
using System.Text.Json.Serialization;

namespace LodgeCore.LockAgent;

/// <summary>
/// Non-sensitive configuration loaded from agent.config.json.
/// Secrets (agentId + agentSecret) are stored separately in Windows Credential Manager.
/// </summary>
public sealed class AgentConfig
{
    public string PmsUrl      { get; set; } = string.Empty;
    public string PropertyId  { get; set; } = string.Empty;
    public string DeviceId    { get; set; } = string.Empty;
    public string AgentName   { get; set; } = string.Empty;
    public int    SdkLockType { get; set; } = 5;   // 4=RF57, 5=RF50
    public string ComPort     { get; set; } = "COM3";
    public int    PollIntervalMs      { get; set; } = 3000;
    public int    HeartbeatIntervalMs { get; set; } = 15000;
    public int    CardWaitMs          { get; set; } = 10000;

    private static readonly string ConfigPath =
        Path.Combine(AppContext.BaseDirectory, "agent.config.json");

    public static AgentConfig Load()
    {
        if (!File.Exists(ConfigPath))
            throw new FileNotFoundException($"Config not found at {ConfigPath}. Run --enroll first.");
        var json = File.ReadAllText(ConfigPath);
        return JsonSerializer.Deserialize<AgentConfig>(json, JsonOptions)
            ?? throw new InvalidOperationException("Invalid agent.config.json");
    }

    public void Save()
    {
        File.WriteAllText(ConfigPath, JsonSerializer.Serialize(this, JsonOptions));
    }

    public string BuildBasicAuthHeader(string agentId, string agentSecret)
    {
        var token = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{agentId}:{agentSecret}"));
        return $"Basic {token}";
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };
}
