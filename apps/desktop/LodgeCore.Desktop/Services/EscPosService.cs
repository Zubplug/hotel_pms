using System;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

// ─────────────────────────────────────────────────────────────────
//  ESC/POS byte constants
// ─────────────────────────────────────────────────────────────────
internal static class Esc
{
    public static readonly byte[] Init        = { 0x1B, 0x40 };          // ESC @  – Initialize printer
    public static readonly byte[] AlignLeft   = { 0x1B, 0x61, 0x00 };   // ESC a 0
    public static readonly byte[] AlignCenter = { 0x1B, 0x61, 0x01 };   // ESC a 1
    public static readonly byte[] AlignRight  = { 0x1B, 0x61, 0x02 };   // ESC a 2
    public static readonly byte[] BoldOn      = { 0x1B, 0x45, 0x01 };   // ESC E 1
    public static readonly byte[] BoldOff     = { 0x1B, 0x45, 0x00 };   // ESC E 0
    public static readonly byte[] DoubleSize  = { 0x1D, 0x21, 0x11 };   // GS  ! – double width+height
    public static readonly byte[] NormalSize  = { 0x1D, 0x21, 0x00 };   // GS  ! – normal
    public static readonly byte[] LineFeed    = { 0x0A };
    public static readonly byte[] CutFull     = { 0x1D, 0x56, 0x00 };   // GS V 0 – full cut
    public static readonly byte[] CutPartial  = { 0x1D, 0x56, 0x01 };   // GS V 1 – partial cut
    public static readonly byte[] OpenDrawer  = { 0x1B, 0x70, 0x00, 0x19, 0xFA }; // Cash drawer kick
    public static readonly byte[] DividerLine = Encoding.UTF8.GetBytes("--------------------------------\n");
}

// ─────────────────────────────────────────────────────────────────
//  Printer config model (stored in LocalPrinterConfig table)
// ─────────────────────────────────────────────────────────────────
public class LocalPrinterConfig
{
    [System.ComponentModel.DataAnnotations.Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>Friendly name, e.g. "Bar Printer", "Kitchen Printer 1"</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>RECEIPT | KITCHEN | FRONTDESK</summary>
    public string PrinterRole { get; set; } = "RECEIPT";

    /// <summary>IP address of the thermal printer on the local network</summary>
    public string IpAddress { get; set; } = string.Empty;

    /// <summary>TCP port – most ESC/POS printers default to 9100</summary>
    public int Port { get; set; } = 9100;

    /// <summary>Paper width in characters (58mm ≈ 32 chars, 80mm ≈ 48 chars)</summary>
    public int PaperWidth { get; set; } = 48;

    /// <summary>Hotel / outlet name to print on header</summary>
    public string? HotelName { get; set; }

    /// <summary>Optional address line</summary>
    public string? HotelAddress { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>OutletId this printer belongs to (null = all outlets on this terminal)</summary>
    public string? OutletId { get; set; }

    /// <summary>Whether to open cash drawer after receipt print</summary>
    public bool OpenCashDrawer { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// ─────────────────────────────────────────────────────────────────
//  Receipt / KOT data DTOs passed from the JS layer
// ─────────────────────────────────────────────────────────────────
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
    DateTime PrintedAt
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
    DateTime FiredAt
);

public record KotItem(
    string Name,
    decimal Quantity,
    int? Course,
    string? Notes,
    List<string>? Modifiers
);

// ─────────────────────────────────────────────────────────────────
//  EscPosService – the actual driver
// ─────────────────────────────────────────────────────────────────
public class EscPosService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<EscPosService> _logger;

    public EscPosService(IServiceProvider serviceProvider, ILogger<EscPosService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    // ── Printer discovery ──────────────────────────────────────────

    public async Task<List<LocalPrinterConfig>> GetPrintersAsync(string? outletId = null)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var query = db.PrinterConfigs.Where(p => p.IsActive);
        if (outletId != null)
            query = query.Where(p => p.OutletId == null || p.OutletId == outletId);

        return await query.OrderBy(p => p.PrinterRole).ToListAsync();
    }

    public async Task<LocalPrinterConfig?> GetPrinterByRoleAsync(string role, string? outletId = null)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        return await db.PrinterConfigs
            .Where(p => p.IsActive && p.PrinterRole == role &&
                        (p.OutletId == null || p.OutletId == outletId))
            .FirstOrDefaultAsync();
    }

    public async Task<LocalPrinterConfig> SavePrinterAsync(LocalPrinterConfig config)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var existing = await db.PrinterConfigs.FindAsync(config.Id);
        if (existing == null)
        {
            config.CreatedAt = DateTime.UtcNow;
            config.UpdatedAt = DateTime.UtcNow;
            db.PrinterConfigs.Add(config);
        }
        else
        {
            config.UpdatedAt = DateTime.UtcNow;
            db.Entry(existing).CurrentValues.SetValues(config);
        }

        await db.SaveChangesAsync();
        return config;
    }

    public async Task DeletePrinterAsync(string id)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var printer = await db.PrinterConfigs.FindAsync(id);
        if (printer != null)
        {
            db.PrinterConfigs.Remove(printer);
            await db.SaveChangesAsync();
        }
    }

    // ── Test connection ────────────────────────────────────────────

    public async Task<(bool success, string message)> TestConnectionAsync(string ip, int port = 9100)
    {
        try
        {
            using var client = new TcpClient();
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await client.ConnectAsync(ip, port, cts.Token);

            // Send init + 3 blank lines + cut – harmless test print
            using var stream = client.GetStream();
            var payload = BuildBytes(Esc.Init, Esc.LineFeed, Esc.LineFeed, Esc.LineFeed, Esc.CutPartial);
            await stream.WriteAsync(payload);

            return (true, $"Connected to {ip}:{port}");
        }
        catch (OperationCanceledException)
        {
            return (false, $"Timeout connecting to {ip}:{port}");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    // ── Receipt printing ───────────────────────────────────────────

    public async Task<(bool success, string? error)> PrintReceiptAsync(ReceiptData receipt, string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("RECEIPT", outletId);
        if (printer == null)
            return (false, "No active RECEIPT printer configured for this terminal.");

        var doc = new List<byte[]>();
        int w = printer.PaperWidth;

        // Header
        doc.Add(Esc.Init);
        doc.Add(Esc.AlignCenter);
        doc.Add(Esc.BoldOn);
        doc.Add(Esc.DoubleSize);
        doc.Add(Text(printer.HotelName ?? receipt.PropertyName ?? "LodgeCore PMS"));
        doc.Add(Esc.NormalSize);
        doc.Add(Esc.BoldOff);

        if (!string.IsNullOrWhiteSpace(printer.HotelAddress ?? receipt.PropertyAddress))
            doc.Add(Text(printer.HotelAddress ?? receipt.PropertyAddress ?? ""));

        doc.Add(Esc.LineFeed);
        doc.Add(Esc.DividerLine);

        // Order info
        doc.Add(Esc.AlignLeft);
        doc.Add(Text($"Receipt #: {receipt.OrderNumber}"));
        doc.Add(Text($"Outlet   : {receipt.OutletName}"));
        if (!string.IsNullOrEmpty(receipt.TableNumber))
            doc.Add(Text($"Table    : {receipt.TableNumber}"));
        if (!string.IsNullOrEmpty(receipt.ServerName))
            doc.Add(Text($"Server   : {receipt.ServerName}"));
        if (!string.IsNullOrEmpty(receipt.GuestName))
            doc.Add(Text($"Guest    : {receipt.GuestName}"));
        doc.Add(Text($"Date     : {receipt.PrintedAt:dd/MM/yyyy HH:mm}"));
        doc.Add(Esc.DividerLine);

        // Items
        doc.Add(Esc.BoldOn);
        doc.Add(Text(PadRow("ITEM", "TOTAL", w)));
        doc.Add(Esc.BoldOff);
        doc.Add(Esc.DividerLine);

        foreach (var item in receipt.Items)
        {
            string itemLine = $"{item.Quantity:0.##}x {item.Name}";
            string totalStr = $"{receipt.Currency} {item.Total:N2}";
            doc.Add(Text(PadRow(Truncate(itemLine, w - totalStr.Length - 1), totalStr, w)));

            if (item.Modifiers != null)
                foreach (var mod in item.Modifiers)
                    doc.Add(Text($"  + {mod}"));
        }

        doc.Add(Esc.DividerLine);

        // Totals
        string cur = receipt.Currency;
        doc.Add(Text(PadRow("Subtotal", $"{cur} {receipt.Subtotal:N2}", w)));
        if (receipt.TaxAmount > 0)
            doc.Add(Text(PadRow("Tax", $"{cur} {receipt.TaxAmount:N2}", w)));
        if (receipt.ServiceCharge > 0)
            doc.Add(Text(PadRow("Service Charge", $"{cur} {receipt.ServiceCharge:N2}", w)));
        if (receipt.TipAmount > 0)
            doc.Add(Text(PadRow("Tip", $"{cur} {receipt.TipAmount:N2}", w)));

        doc.Add(Esc.BoldOn);
        doc.Add(Text(PadRow("TOTAL", $"{cur} {receipt.Total:N2}", w)));
        doc.Add(Esc.BoldOff);
        doc.Add(Text(PadRow("Payment", receipt.PaymentMethod, w)));
        doc.Add(Esc.DividerLine);

        // Footer
        doc.Add(Esc.AlignCenter);
        doc.Add(Text("Thank you for your patronage!"));
        doc.Add(Text("Powered by LodgeCore PMS"));
        doc.Add(Esc.LineFeed);
        doc.Add(Esc.LineFeed);
        doc.Add(Esc.LineFeed);

        // Cash drawer kick if configured
        if (printer.OpenCashDrawer)
            doc.Add(Esc.OpenDrawer);

        doc.Add(Esc.CutPartial);

        return await SendToPrinterAsync(printer, BuildBytes(doc.ToArray()));
    }

    // ── KOT printing ───────────────────────────────────────────────

    public async Task<(bool success, string? error)> PrintKotAsync(KotData kot, string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("KITCHEN", outletId);
        if (printer == null)
        {
            // Fallback: use receipt printer if no kitchen printer is set
            printer = await GetPrinterByRoleAsync("RECEIPT", outletId);
            if (printer == null)
                return (false, "No active KITCHEN or RECEIPT printer configured for this terminal.");
        }

        int w = printer.PaperWidth;
        var doc = new List<byte[]>();

        // Big KOT header
        doc.Add(Esc.Init);
        doc.Add(Esc.AlignCenter);
        doc.Add(Esc.BoldOn);
        doc.Add(Esc.DoubleSize);
        doc.Add(Text("KITCHEN ORDER"));
        doc.Add(Esc.NormalSize);
        doc.Add(Esc.BoldOff);
        doc.Add(Esc.DividerLine);

        doc.Add(Esc.AlignLeft);
        doc.Add(Esc.BoldOn);
        doc.Add(Text($"KOT#   : {kot.KotNumber}"));
        doc.Add(Text($"Order# : {kot.OrderNumber}"));
        doc.Add(Esc.BoldOff);
        doc.Add(Text($"Outlet : {kot.OutletName}"));
        if (!string.IsNullOrEmpty(kot.TableNumber))
            doc.Add(Text($"Table  : {kot.TableNumber}"));
        if (!string.IsNullOrEmpty(kot.ServerName))
            doc.Add(Text($"Server : {kot.ServerName}"));
        doc.Add(Text($"Time   : {kot.FiredAt:HH:mm:ss}"));
        doc.Add(Esc.DividerLine);

        // Group items by course
        foreach (var item in kot.Items)
        {
            if (item.Course.HasValue)
            {
                doc.Add(Esc.BoldOn);
                doc.Add(Text($"[Course {item.Course}]"));
                doc.Add(Esc.BoldOff);
            }

            doc.Add(Esc.BoldOn);
            doc.Add(Esc.DoubleSize);
            doc.Add(Text($"  {item.Quantity:0.##}x  {item.Name}"));
            doc.Add(Esc.NormalSize);
            doc.Add(Esc.BoldOff);

            if (item.Modifiers != null)
                foreach (var mod in item.Modifiers)
                    doc.Add(Text($"    + {mod}"));

            if (!string.IsNullOrEmpty(item.Notes))
                doc.Add(Text($"    * {item.Notes}"));
        }

        doc.Add(Esc.DividerLine);
        doc.Add(Esc.AlignCenter);
        doc.Add(Text($"Printed: {DateTime.Now:dd/MM/yyyy HH:mm:ss}"));
        doc.Add(Esc.LineFeed);
        doc.Add(Esc.LineFeed);
        doc.Add(Esc.LineFeed);
        doc.Add(Esc.CutPartial);

        return await SendToPrinterAsync(printer, BuildBytes(doc.ToArray()));
    }

    // ── Low-level TCP send ─────────────────────────────────────────

    private async Task<(bool, string?)> SendToPrinterAsync(LocalPrinterConfig printer, byte[] data)
    {
        try
        {
            using var client = new TcpClient();
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            await client.ConnectAsync(printer.IpAddress, printer.Port, cts.Token);

            using var stream = client.GetStream();
            await stream.WriteAsync(data, 0, data.Length, cts.Token);
            await stream.FlushAsync(cts.Token);

            _logger.LogInformation("Printed to {Name} ({Ip}:{Port})", printer.Name, printer.IpAddress, printer.Port);
            return (true, null);
        }
        catch (OperationCanceledException)
        {
            var msg = $"Timeout sending to printer '{printer.Name}' at {printer.IpAddress}:{printer.Port}";
            _logger.LogWarning(msg);
            return (false, msg);
        }
        catch (Exception ex)
        {
            var msg = $"Printer '{printer.Name}' error: {ex.Message}";
            _logger.LogError(ex, msg);
            return (false, msg);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────

    private static byte[] Text(string s) =>
        Encoding.UTF8.GetBytes(s.TrimEnd() + "\n");

    /// <summary>Left + right pad to fill paper width</summary>
    private static string PadRow(string left, string right, int width)
    {
        int spaces = width - left.Length - right.Length;
        if (spaces < 1) spaces = 1;
        return left + new string(' ', spaces) + right;
    }

    private static string Truncate(string s, int max) =>
        s.Length <= max ? s : s[..(max - 1)] + "…";

    private static byte[] BuildBytes(params byte[][] arrays)
    {
        int total = 0;
        foreach (var a in arrays) total += a.Length;
        var result = new byte[total];
        int offset = 0;
        foreach (var a in arrays) { Buffer.BlockCopy(a, 0, result, offset, a.Length); offset += a.Length; }
        return result;
    }

    private static byte[] BuildBytes(byte[][] arrays)
    {
        int total = 0;
        foreach (var a in arrays) total += a.Length;
        var result = new byte[total];
        int offset = 0;
        foreach (var a in arrays) { Buffer.BlockCopy(a, 0, result, offset, a.Length); offset += a.Length; }
        return result;
    }
}
