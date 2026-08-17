using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalPosOutlet
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class LocalProductCategory
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OutletId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
}

public class LocalPosProduct
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string CategoryId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal TaxRate { get; set; }
    public bool IsActive { get; set; }
}

public class LocalStockItem
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string BaseUnit { get; set; } = string.Empty;
    public decimal CostPrice { get; set; }
}

public class LocalRecipeIngredient
{
    [Key] public string Id { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string StockItemId { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string UnitOfMeasure { get; set; } = string.Empty;
}

public class LocalPosSession
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;

    public DateTime OpenedAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    public decimal OpeningBalance { get; set; }
    public decimal CashSales { get; set; }
    public decimal CashRefunds { get; set; }
    public decimal CashPaidOut { get; set; }
    public decimal ExpectedCash { get; set; }
    public decimal ActualCash { get; set; }
    public decimal Variance { get; set; }

    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
}

public class LocalPosOrder
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string OutletId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string? FolioId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime BusinessDate { get; set; }
    public decimal Subtotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }
    public string? Notes { get; set; }
    public string? TableNumber { get; set; }
    public string? TableId { get; set; }
    public int GuestCount { get; set; } = 1;
    public decimal ServiceCharge { get; set; }
    public decimal TipAmount { get; set; }
    public string? ServerStaffId { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
    public string? OperationId { get; set; }
    public string? DeviceId { get; set; }

    public ICollection<LocalPosOrderItem> Items { get; set; } = new List<LocalPosOrderItem>();
    public List<LocalPosPayment> Payments { get; set; } = new();
    public List<LocalPosVoid> Voids { get; set; } = new();
    public List<LocalPosDiscount> Discounts { get; set; } = new();
    public List<LocalPosCheck> Checks { get; set; } = new();
    public List<LocalPosKot> Kots { get; set; } = new();
}

public class LocalPosOrderItem
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string? ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }
    public int? Course { get; set; }
    public string? KitchenStatus { get; set; }
    public DateTime? SentToKitchenAt { get; set; }
    public string? VoidReason { get; set; }
    public string? CheckId { get; set; }
    public string? KotId { get; set; }

    public List<LocalPosOrderItemModifier> Modifiers { get; set; } = new();
}

public class LocalPosPayment
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "NGN";
    public string? Gateway { get; set; }
    public string? GatewayTransactionId { get; set; }
    public string? OperationId { get; set; }
    public DateTime BusinessDate { get; set; }
    public string? DeviceId { get; set; }
    public DateTime? PaidAt { get; set; }
}

public class LocalStockTransaction
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string StockItemId { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal TotalValue { get; set; }
    public string Source { get; set; } = string.Empty;
    public string? ReferenceId { get; set; }
    public DateTime BusinessDate { get; set; }
}

public class LocalPosVoid
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string? OrderItemId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? AuthorizerId { get; set; }
    public string? OperationId { get; set; }
    public DateTime BusinessDate { get; set; }
    public string? DeviceId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LocalPosDiscount
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string? OrderItemId { get; set; }
    public string Type { get; set; } = string.Empty; // PERCENTAGE or FLAT
    public decimal Amount { get; set; }
    public string? AuthorizerId { get; set; }
    public string? OperationId { get; set; }
    public DateTime BusinessDate { get; set; }
    public string? DeviceId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LocalPosCashMovement
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string PosSessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Type { get; set; } = string.Empty;
    public string ReasonCode { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? ReceiptReference { get; set; }
    public string OperationId { get; set; } = string.Empty;
    public DateTime BusinessDate { get; set; }
    public string? AuthorizedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LocalPosReceiptAudit
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string? OrderId { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public string? PosSessionId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public int PrintCount { get; set; }
    public string OperationId { get; set; } = string.Empty;
    public DateTime BusinessDate { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LocalPosAuthorizationAudit
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string? SessionId { get; set; }
    public string RequestedBy { get; set; } = string.Empty;
    public string AuthorizedBy { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string OperationId { get; set; } = string.Empty;
    public DateTime BusinessDate { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LocalStaff
{
    [Key] public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string PosPinHash { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool HasPosAccess { get; set; }
    public string Role { get; set; } = string.Empty;
    public int PosTokenVersion { get; set; } = 1;
}

public class LocalPosOperatorSession
{
    [Key] public string Id { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string PosSessionId { get; set; } = string.Empty;
    public string StaffId { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime LastActivityAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string OperationId { get; set; } = string.Empty;
}

public class LocalPosFloorPlan
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OutletId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class LocalPosTable
{
    [Key] public string Id { get; set; } = string.Empty;
    public string FloorPlanId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int PositionX { get; set; }
    public int PositionY { get; set; }
    public string? CurrentOrderId { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class LocalPosCheck
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string CheckNumber { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public string Status { get; set; } = "OPEN";
    public string? OperationId { get; set; }
    public DateTime BusinessDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class LocalPosKot
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string OutletId { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public string KotNumber { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING";
    public string PrintStatus { get; set; } = "QUEUED";
    public string? OperationId { get; set; }
    public DateTime BusinessDate { get; set; }
    public string? PrinterId { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? PrintedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LocalPosProductModifier
{
    [Key] public string Id { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LocalPosOrderItemModifier
{
    [Key] public string Id { get; set; } = string.Empty;
    public string OrderItemId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public DateTime CreatedAt { get; set; }
}
