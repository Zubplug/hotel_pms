using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalPosProductionBatch
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OutletId { get; set; } = string.Empty;
    public string Station { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    public ICollection<LocalPosProductionBatchItem> Items { get; set; } = new List<LocalPosProductionBatchItem>();
}

public class LocalPosProductionBatchItem
{
    [Key] public string Id { get; set; } = string.Empty;
    public string BatchId { get; set; } = string.Empty;
    public string OrderItemId { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Status { get; set; } = string.Empty;
}
