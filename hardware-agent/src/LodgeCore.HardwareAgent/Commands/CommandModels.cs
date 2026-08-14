using System.Text.Json;

namespace LodgeCore.HardwareAgent.Commands;

public class LockCommand
{
    public string Id { get; set; } = string.Empty;
    public string OperationId { get; set; } = string.Empty;
    public string CommandType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public JsonElement Payload { get; set; }
}

public class CommandStatusUpdate
{
    public string Status { get; set; } = string.Empty;
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
}
