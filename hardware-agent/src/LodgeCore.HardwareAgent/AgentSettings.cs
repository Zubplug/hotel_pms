namespace LodgeCore.HardwareAgent;

public class AgentSettings
{
    public string ApiUrl { get; set; } = string.Empty;
    public string WsUrl { get; set; } = string.Empty;
    public string AgentId { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;

    /// <summary>
    /// Provider-specific extra settings, e.g.:
    ///   "ProUsbHotelCode": "12345"   – dlsCoID for the ACS Hotel / proUSB system
    ///   "ProUsbPort": "1"             – USB port index (default 1)
    /// </summary>
    public Dictionary&lt;string, string&gt; ExtendedSettings { get; set; } = new();
}
