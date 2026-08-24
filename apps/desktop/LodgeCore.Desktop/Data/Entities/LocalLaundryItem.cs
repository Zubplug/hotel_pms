using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalLaundryItem
{
    [Key]
    public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal BasePrice { get; set; }
    public string Currency { get; set; } = "NGN";
    public bool IsActive { get; set; } = true;
    public string ServicePricingRules { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class LocalLaundryOrder
{
    [Key]
    public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string CustomerType { get; set; } = "IN_HOUSE";
    public string? ReservationId { get; set; }
    public string? RoomId { get; set; }
    public string GuestId { get; set; } = string.Empty;
    public string FolioItemId { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING";
    public string ServiceType { get; set; } = "STANDARD";
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "NGN";
    public string SpecialNotes { get; set; } = string.Empty;
    public DateTime RequestedAt { get; set; }
    public DateTime? ExpectedReadyAt { get; set; }
    public DateTime? CollectedAt { get; set; }
    public string CollectedBy { get; set; } = string.Empty;
    public DateTime? ReadyAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public string DeliveredBy { get; set; } = string.Empty;
    public int Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<LocalLaundryOrderItem> Items { get; set; } = new List<LocalLaundryOrderItem>();
    public ICollection<LocalLaundryOrderStatusHistory> StatusHistory { get; set; } = new List<LocalLaundryOrderStatusHistory>();
}

public class LocalLaundryOrderItem
{
    [Key]
    public string Id { get; set; } = string.Empty;
    public string LaundryOrderId { get; set; } = string.Empty;
    public string ItemId { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
}

public class LocalLaundryOrderStatusHistory
{
    [Key]
    public string Id { get; set; } = string.Empty;
    public string LaundryOrderId { get; set; } = string.Empty;
    public string PreviousStatus { get; set; } = string.Empty;
    public string NewStatus { get; set; } = string.Empty;
    public string ChangedBy { get; set; } = string.Empty;
    public DateTime ChangedAt { get; set; }
    public string Notes { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
}
