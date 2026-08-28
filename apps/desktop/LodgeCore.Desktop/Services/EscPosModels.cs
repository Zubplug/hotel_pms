using System;
using System.Collections.Generic;

namespace LodgeCore.Desktop.Services;

// ── Shared Print Profile ───────────────────────────────────────
public class PrinterProfile
{
    public int PaperWidth { get; set; } = 48; // 80mm = 48, 58mm = 32
    public bool LogoEnabled { get; set; } = false;
    public string? LogoBitmapBase64 { get; set; } // Future
    public string? HotelName { get; set; }
    public string? HotelAddress { get; set; }
}

// ── DTOs for printing ──────────────────────────────────────────

public record ReceiptData(
    string OrderNumber,
    string OutletName,
    string? TableNumber,
    string? ServerName,
    string? GuestName,
    List<ReceiptItem> Items,
    decimal Subtotal,
    decimal TaxAmount,
    decimal ServiceCharge,
    decimal TipAmount,
    decimal Total,
    string PaymentMethod,
    string Currency,
    string? PropertyName,
    string? PropertyAddress,
    DateTime PrintedAt,
    bool IsReprint = false
);

public record ReceiptItem(
    string Name,
    decimal Quantity,
    decimal UnitPrice,
    decimal Total,
    List<string>? Modifiers
);

public record KotData(
    string KotNumber,
    string OrderNumber,
    string? TableNumber,
    string? ServerName,
    string OutletName,
    List<KotItem> Items,
    DateTime FiredAt,
    string Station = "KITCHEN",
    string? OrderType = null,
    bool IsIncremental = false
);

public record KotItem(
    string Name,
    decimal Quantity,
    int? Course,
    string? Notes,
    List<string>? Modifiers
);

public record LaundryTicketData(
    string OrderNumber,
    string? GuestName,
    string? RoomNumber,
    string ServiceType,
    List<LaundryTicketItem> Items,
    decimal Total,
    string Currency,
    DateTime RequestedAt,
    bool IsReprint = false
);

public record LaundryTicketItem(string Name, decimal Quantity);

// ── NEW DTOs ───────────────────────────────────────────────────

public record GuestFolioData(
    string GuestName,
    string RoomNumber,
    string FolioNumber,
    DateTime ArrivalDate,
    DateTime DepartureDate,
    List<FolioTransaction> Transactions,
    decimal TotalCharges,
    decimal TotalPayments,
    decimal BalanceDue,
    string Currency,
    string? PropertyName,
    string? PropertyAddress,
    DateTime PrintedAt
);

public record FolioTransaction(
    DateTime Date,
    string Description,
    string? Reference,
    decimal DebitAmount,
    decimal CreditAmount,
    decimal RunningBalance
);

public record PaymentReceiptData(
    string ReceiptNumber,
    string GuestName,
    string RoomNumber,
    string FolioNumber,
    decimal AmountPaid,
    string PaymentMethod,
    string? PaymentReference,
    decimal PreviousBalance,
    decimal RemainingBalance,
    string CashierName,
    string Currency,
    string? PropertyName,
    string? PropertyAddress,
    DateTime PrintedAt
);

public record ShiftReportData(
    string StaffName,
    int OrdersCount,
    decimal GrossSales,
    decimal NetSales,
    decimal CashSales,
    decimal CardSales,
    decimal RoomCharges,
    decimal TotalDiscounts,
    string Currency,
    DateTime PrintedAt,
    string? ShiftReference = null,
    string? Till = null,
    decimal ExpectedCash = 0,
    decimal? DeclaredCash = null,
    decimal? Variance = null,
    decimal BankTransferSales = 0,
    decimal OtherPayments = 0,
    decimal LaundryCharges = 0,
    decimal OtherCharges = 0,
    decimal CashIn = 0,
    decimal CashDrops = 0,
    decimal PaidOuts = 0,
    decimal TransfersOut = 0,
    decimal CashRefunds = 0,
    int PaymentsCount = 0,
    int ChargesCount = 0,
    int PendingSync = 0,
    int FailedSync = 0
);

public record RegistrationCardData(
    string GuestName,
    string? Email,
    string? Phone,
    string ConfirmationNumber,
    string? RoomNumber,
    DateTime ArrivalDate,
    DateTime DepartureDate,
    int Adults,
    int Children,
    string? PropertyName,
    string? PropertyAddress
);
