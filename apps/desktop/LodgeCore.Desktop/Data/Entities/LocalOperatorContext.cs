using System;
using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalOperatorContext
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    public string DeviceId { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string OutletId { get; set; } = string.Empty;
    public string StaffId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string OperatorTokenVersion { get; set; } = string.Empty;
    public DateTime AuthenticatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsActive { get; set; }
}
