using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

/// <summary>
/// Tracks online Food Commerce orders that have been pulled from the cloud
/// POS bridge endpoint and injected into the local POS workflow.
/// One row per CommerceSyncEvent that this terminal has acknowledged.
/// </summary>
public class LocalCommerceInboundOrder
{
    /// <summary>Cloud CommerceSyncEvent.id — also our idempotency key.</summary>
    [Key]
    public string SyncEventId { get; set; } = string.Empty;

    /// <summary>Cloud CommerceOrder.id</summary>
    public string CommerceOrderId { get; set; } = string.Empty;

    /// <summary>Human-readable reference printed on KOT (e.g. "WEB-00042")</summary>
    public string OrderRef { get; set; } = string.Empty;

    /// <summary>Local PosOrder.Id created from this cloud order. Null until creation succeeds.</summary>
    public string? LocalPosOrderId { get; set; }

    /// <summary>Local KOT id(s) created. Stored as JSON array string.</summary>
    public string? LocalKotIdsJson { get; set; }

    /// <summary>PICKUP | DELIVERY | DINE_IN</summary>
    public string OrderType { get; set; } = string.Empty;

    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }

    /// <summary>JSON snapshot of the order items array from cloud payload</summary>
    public string ItemsJson { get; set; } = "[]";

    public decimal TotalAmount { get; set; }

    /// <summary>
    /// PENDING     — pulled from cloud, not yet written to local POS DB
    /// INJECTED    — LocalPosOrder + KOT created, waiting for KOT to print
    /// KOT_PRINTED — kitchen has the ticket
    /// FAILED      — injection failed after retries; human intervention required
    /// </summary>
    public string InjectionStatus { get; set; } = "PENDING";

    public int RetryCount { get; set; } = 0;
    public string? LastError { get; set; }

    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public DateTime? InjectedAt { get; set; }
    public DateTime? CloudAcknowledgedAt { get; set; }
    public DateTime? KotPrintedAt { get; set; }
}
