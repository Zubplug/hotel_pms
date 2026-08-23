using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalSyncMetadata
{
    [Key]
    public string Id { get; set; } = "singleton";
    public DateTime? LastSuccessfulSyncAt { get; set; }
    public string? LastSyncVersion { get; set; }
    public string? LastGuestSyncCursor { get; set; }
    public string? SchemaVersion { get; set; }
}
