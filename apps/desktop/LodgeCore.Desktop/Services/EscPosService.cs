using System;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

// ─────────────────────────────────────────────────────────────────
//  Printer config model (stored in LocalPrinterConfig table)
// ─────────────────────────────────────────────────────────────────
public class LocalPrinterConfig
{
    [System.ComponentModel.DataAnnotations.Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public string Name { get; set; } = string.Empty;
    public string PrinterRole { get; set; } = "RECEIPT";
    public string ConnectionType { get; set; } = "NETWORK";
    public string IpAddress { get; set; } = string.Empty;
    public int Port { get; set; } = 9100;
    public string? DevicePath { get; set; }
    public int BaudRate { get; set; } = 9600;
    public int PaperWidth { get; set; } = 48;
    public string? HotelName { get; set; }
    public string? HotelAddress { get; set; }
    public bool IsActive { get; set; } = true;
    public string? OutletId { get; set; }
    public bool OpenCashDrawer { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

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

        var printer = await db.PrinterConfigs
            .Where(p => p.IsActive && p.PrinterRole == role &&
                        (p.OutletId == null || p.OutletId == outletId))
            .FirstOrDefaultAsync();

        if (printer == null)
        {
            // Fallback: If no exact role matches, just grab any active printer for this terminal.
            // Many users only configure a single printer for everything.
            printer = await db.PrinterConfigs
                .Where(p => p.IsActive && (p.OutletId == null || p.OutletId == outletId))
                .FirstOrDefaultAsync();
        }

        return printer;
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

    public async Task<(bool success, string? error)> OpenCashDrawerAsync(string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("RECEIPT", outletId) 
                      ?? await GetPrinterByRoleAsync("FRONTDESK", outletId);
        
        if (printer == null)
            return (false, "No active RECEIPT or FRONTDESK printer configured for this terminal to open cash drawer.");

        var builder = new EscPosBuilder(new PrinterProfile { PaperWidth = printer.PaperWidth });
        builder.AddCommand(EscPosBuilder.OpenDrawer);
        return await SendToPrinterAsync(printer, builder.Build());
    }

    public async Task<(bool success, string? error)> PrintRegistrationCardAsync(RegistrationCardData card, string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("FRONTDESK", outletId) 
                      ?? await GetPrinterByRoleAsync("RECEIPT", outletId);
        
        if (printer == null)
            return (false, "No active FRONTDESK or RECEIPT printer configured.");

        var profile = new PrinterProfile {
            PaperWidth = printer.PaperWidth,
            HotelName = printer.HotelName ?? card.PropertyName,
            HotelAddress = printer.HotelAddress ?? card.PropertyAddress
        };
        var builder = new EscPosBuilder(profile);

        builder.PrintHeader("GUEST REGISTRATION CARD");

        builder.AddRow("Name:", card.GuestName);
        if (!string.IsNullOrEmpty(card.Email)) builder.AddRow("Email:", card.Email);
        if (!string.IsNullOrEmpty(card.Phone)) builder.AddRow("Phone:", card.Phone);
        builder.AddDivider('-');

        builder.AddRow("Conf #:", card.ConfirmationNumber);
        builder.AddRow("Room  :", card.RoomNumber ?? "TBA");
        builder.AddRow("Arrival:", card.ArrivalDate.ToString("dd/MM/yyyy HH:mm"));
        builder.AddRow("Depart :", card.DepartureDate.ToString("dd/MM/yyyy"));
        builder.AddRow("Guests :", $"{card.Adults}A {card.Children}C");
        builder.AddDivider('=');

        builder.AddLineFeed(2);
        builder.AddLine("I agree to the hotel terms and conditions.");
        builder.AddLineFeed(3);
        builder.AddLine("Signature: _______________________");
        builder.AddLineFeed(3);
        builder.AddCommand(EscPosBuilder.CutPartial);

        return await SendToPrinterAsync(printer, builder.Build());
    }

    public async Task<(bool success, string? error)> PrintGuestFolioAsync(GuestFolioData folio, string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("FRONTDESK", outletId) 
                      ?? await GetPrinterByRoleAsync("RECEIPT", outletId);
        
        if (printer == null)
            return (false, "No active FRONTDESK or RECEIPT printer configured.");

        var profile = new PrinterProfile {
            PaperWidth = printer.PaperWidth,
            HotelName = printer.HotelName ?? folio.PropertyName,
            HotelAddress = printer.HotelAddress ?? folio.PropertyAddress
        };
        var builder = new EscPosBuilder(profile);
        int w = profile.PaperWidth;

        builder.PrintHeader("GUEST FOLIO");

        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.AddLine(folio.GuestName);
        builder.AddCommand(EscPosBuilder.BoldOff);
        builder.AddRow("Room:", folio.RoomNumber);
        builder.AddRow("Folio:", folio.FolioNumber);
        builder.AddRow("Arrival:", folio.ArrivalDate.ToString("dd MMM yyyy"));
        builder.AddRow("Depart:", folio.DepartureDate.ToString("dd MMM yyyy"));
        
        builder.AddDivider('-');

        // Dynamic columns based on width
        int dateW = 7;
        int descW = w - 21; // 7 + 7 + 7 = 21 for DR and CR and space
        int amtW = 7;
        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.Add4ColRow("DATE", "DESCRIPTION", "DR", "CR", dateW, descW, amtW, amtW);
        builder.AddCommand(EscPosBuilder.BoldOff);
        builder.AddDivider('-');

        foreach (var t in folio.Transactions)
        {
            string dateStr = t.Date.ToString("dd MMM");
            string drStr = t.DebitAmount > 0 ? t.DebitAmount.ToString("N0") : "";
            string crStr = t.CreditAmount > 0 ? t.CreditAmount.ToString("N0") : "";
            
            builder.Add4ColRow(dateStr, t.Description, drStr, crStr, dateW, descW, amtW, amtW);
        }

        builder.AddDivider('-');
        
        builder.AddRow("Total Charges", $"{folio.Currency} {folio.TotalCharges:N0}");
        builder.AddRow("Total Payments", $"{folio.Currency} {folio.TotalPayments:N0}");
        builder.AddLineFeed();
        
        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.AddCommand(EscPosBuilder.DoubleSize);
        if (folio.BalanceDue == 0)
        {
            builder.AddRow("BALANCE", "0", true);
        }
        else if (folio.BalanceDue < 0)
        {
            builder.AddRow("CREDIT", $"{folio.Currency} {Math.Abs(folio.BalanceDue):N0}", true);
        }
        else
        {
            builder.AddRow("BALANCE DUE", $"{folio.Currency} {folio.BalanceDue:N0}", true);
        }
        builder.AddCommand(EscPosBuilder.NormalSize);
        builder.AddCommand(EscPosBuilder.BoldOff);
        
        builder.AddDivider('=');
        builder.AddCommand(EscPosBuilder.AlignCenter);
        builder.AddLine("Thank you for staying with us!");
        builder.AddLineFeed(3);
        builder.AddCommand(EscPosBuilder.CutPartial);

        return await SendToPrinterAsync(printer, builder.Build());
    }

    public async Task<(bool success, string? error)> PrintPaymentReceiptAsync(PaymentReceiptData payment, string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("FRONTDESK", outletId) 
                      ?? await GetPrinterByRoleAsync("RECEIPT", outletId);
        
        if (printer == null)
            return (false, "No active FRONTDESK or RECEIPT printer configured.");

        var profile = new PrinterProfile {
            PaperWidth = printer.PaperWidth,
            HotelName = printer.HotelName ?? payment.PropertyName,
            HotelAddress = printer.HotelAddress ?? payment.PropertyAddress
        };
        var builder = new EscPosBuilder(profile);

        builder.PrintHeader("PAYMENT RECEIPT");

        builder.AddRow("Receipt #:", payment.ReceiptNumber);
        builder.AddRow("Date:", payment.PrintedAt.ToString("dd/MM/yyyy HH:mm"));
        builder.AddRow("Guest:", payment.GuestName);
        builder.AddRow("Room:", payment.RoomNumber);
        builder.AddRow("Folio #:", payment.FolioNumber);
        builder.AddRow("Cashier:", payment.CashierName);
        builder.AddDivider('-');

        builder.AddRow("Payment Method:", payment.PaymentMethod);
        if (!string.IsNullOrEmpty(payment.PaymentReference))
            builder.AddRow("Reference:", payment.PaymentReference);
        
        builder.AddLineFeed();
        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.AddCommand(EscPosBuilder.DoubleSize);
        builder.AddRow("AMOUNT PAID", $"{payment.Currency} {payment.AmountPaid:N0}", true);
        builder.AddCommand(EscPosBuilder.NormalSize);
        builder.AddCommand(EscPosBuilder.BoldOff);
        builder.AddLineFeed();
        
        builder.AddDivider('-');
        builder.AddCommand(EscPosBuilder.AlignCenter);
        builder.AddLine("Folio Summary");
        builder.AddCommand(EscPosBuilder.AlignLeft);
        builder.AddRow("Previous Balance:", $"{payment.Currency} {payment.PreviousBalance:N0}");
        builder.AddRow("Amount Paid:", $"{payment.Currency} {payment.AmountPaid:N0}");
        builder.AddRow("Remaining Balance:", $"{payment.Currency} {payment.RemainingBalance:N0}");
        
        builder.AddDivider('=');
        builder.AddCommand(EscPosBuilder.AlignCenter);
        builder.AddLine("Thank you!");
        builder.AddLineFeed(3);
        builder.AddCommand(EscPosBuilder.CutPartial);

        if (printer.OpenCashDrawer)
            builder.AddCommand(EscPosBuilder.OpenDrawer);

        return await SendToPrinterAsync(printer, builder.Build());
    }

    public async Task<(bool success, string? error)> PrintShiftReportAsync(ShiftReportData report, string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("RECEIPT", outletId);
        if (printer == null)
            return (false, "No active RECEIPT printer configured.");

        var profile = new PrinterProfile { PaperWidth = printer.PaperWidth, HotelName = printer.HotelName };
        var builder = new EscPosBuilder(profile);

        builder.PrintHeader("SHIFT SALES REPORT");
        builder.AddRow("Staff:", report.StaffName);
        builder.AddRow("Date:", report.PrintedAt.ToString("dd/MM/yyyy HH:mm"));
        builder.AddDivider('-');

        builder.AddRow("Total Orders", report.OrdersCount.ToString());
        builder.AddDivider('-');
        
        string cur = report.Currency;
        builder.AddRow("Gross Sales", $"{cur} {report.GrossSales:N2}");
        builder.AddRow("Discounts", $"-{cur} {report.TotalDiscounts:N2}");
        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.AddRow("Net Sales", $"{cur} {report.NetSales:N2}");
        builder.AddCommand(EscPosBuilder.BoldOff);
        
        builder.AddDivider('-');
        builder.AddCommand(EscPosBuilder.AlignCenter);
        builder.AddLine("PAYMENT BREAKDOWN");
        builder.AddCommand(EscPosBuilder.AlignLeft);
        
        builder.AddRow("Cash", $"{cur} {report.CashSales:N2}");
        builder.AddRow("Card", $"{cur} {report.CardSales:N2}");
        builder.AddRow("Room Charges", $"{cur} {report.RoomCharges:N2}");
        
        builder.AddLineFeed(3);
        builder.AddCommand(EscPosBuilder.CutPartial);

        return await SendToPrinterAsync(printer, builder.Build());
    }

    public async Task<(bool success, string? error)> PrintReceiptAsync(ReceiptData receipt, string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("RECEIPT", outletId);
        if (printer == null)
            return (false, "No active RECEIPT printer configured for this terminal.");

        var profile = new PrinterProfile {
            PaperWidth = printer.PaperWidth,
            HotelName = printer.HotelName ?? receipt.PropertyName,
            HotelAddress = printer.HotelAddress ?? receipt.PropertyAddress
        };
        var builder = new EscPosBuilder(profile);

        builder.PrintHeader(receipt.IsReprint ? "*** REPRINT ***" : "SALES RECEIPT");

        builder.AddRow("Receipt #:", receipt.OrderNumber);
        builder.AddRow("Outlet:", receipt.OutletName);
        if (!string.IsNullOrEmpty(receipt.TableNumber)) builder.AddRow("Table:", receipt.TableNumber);
        if (!string.IsNullOrEmpty(receipt.ServerName)) builder.AddRow("Server:", receipt.ServerName);
        if (!string.IsNullOrEmpty(receipt.GuestName)) builder.AddRow("Guest:", receipt.GuestName);
        builder.AddRow("Date:", receipt.PrintedAt.ToString("dd/MM/yyyy HH:mm"));
        builder.AddDivider('-');

        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.AddRow("ITEM", "TOTAL");
        builder.AddCommand(EscPosBuilder.BoldOff);
        builder.AddDivider('-');

        foreach (var item in receipt.Items)
        {
            string itemLine = $"{item.Quantity:0.##}x {item.Name}";
            string totalStr = $"{receipt.Currency} {item.Total:N2}";
            builder.AddRow(itemLine, totalStr);

            if (item.Modifiers != null)
                foreach (var mod in item.Modifiers)
                    builder.AddLine($"  + {mod}");
        }

        builder.AddDivider('-');

        string cur = receipt.Currency;
        builder.AddRow("Subtotal", $"{cur} {receipt.Subtotal:N2}");
        if (receipt.TaxAmount > 0) builder.AddRow("Tax", $"{cur} {receipt.TaxAmount:N2}");
        if (receipt.ServiceCharge > 0) builder.AddRow("Service Charge", $"{cur} {receipt.ServiceCharge:N2}");
        if (receipt.TipAmount > 0) builder.AddRow("Tip", $"{cur} {receipt.TipAmount:N2}");

        builder.AddLineFeed();
        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.AddCommand(EscPosBuilder.DoubleSize);
        builder.AddRow("TOTAL", $"{cur} {receipt.Total:N2}", true);
        builder.AddCommand(EscPosBuilder.NormalSize);
        builder.AddCommand(EscPosBuilder.BoldOff);
        
        builder.AddRow("Payment", receipt.PaymentMethod);
        builder.AddDivider('=');

        builder.AddCommand(EscPosBuilder.AlignCenter);
        builder.AddLine("Thank you for your patronage!");
        builder.AddLineFeed(3);

        if (printer.OpenCashDrawer)
            builder.AddCommand(EscPosBuilder.OpenDrawer);

        builder.AddCommand(EscPosBuilder.CutPartial);

        return await SendToPrinterAsync(printer, builder.Build());
    }

    public async Task<(bool success, string? error)> PrintKotAsync(KotData kot, string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("KITCHEN", outletId) 
                      ?? await GetPrinterByRoleAsync("RECEIPT", outletId);
        
        if (printer == null)
            return (false, "No active KITCHEN or RECEIPT printer configured.");

        var builder = new EscPosBuilder(new PrinterProfile { PaperWidth = printer.PaperWidth });

        // Big KOT header
        builder.AddCommand(EscPosBuilder.Init);
        builder.AddCommand(EscPosBuilder.AlignCenter);
        builder.AddCommand(EscPosBuilder.InvertOn);
        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.AddCommand(EscPosBuilder.DoubleSize);
        builder.AddLine("  KITCHEN ORDER  ");
        builder.AddCommand(EscPosBuilder.NormalSize);
        builder.AddCommand(EscPosBuilder.BoldOff);
        builder.AddCommand(EscPosBuilder.InvertOff);
        builder.AddLineFeed();

        builder.AddCommand(EscPosBuilder.AlignLeft);
        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.AddLine($"KOT#   : {kot.KotNumber}");
        builder.AddLine($"Order# : {kot.OrderNumber}");
        
        builder.AddCommand(EscPosBuilder.DoubleSize);
        if (!string.IsNullOrEmpty(kot.TableNumber))
            builder.AddLine($"TABLE  : {kot.TableNumber}");
        builder.AddCommand(EscPosBuilder.NormalSize);
        builder.AddCommand(EscPosBuilder.BoldOff);
        
        if (!string.IsNullOrEmpty(kot.ServerName)) builder.AddLine($"Server : {kot.ServerName}");
        builder.AddLine($"Time   : {kot.FiredAt:HH:mm:ss}");
        builder.AddDivider('=');

        // Group items by course
        foreach (var item in kot.Items)
        {
            if (item.Course.HasValue)
            {
                builder.AddCommand(EscPosBuilder.AlignCenter);
                builder.AddCommand(EscPosBuilder.InvertOn);
                builder.AddLine($" [COURSE {item.Course}] ");
                builder.AddCommand(EscPosBuilder.InvertOff);
                builder.AddCommand(EscPosBuilder.AlignLeft);
            }

            builder.AddCommand(EscPosBuilder.BoldOn);
            builder.AddCommand(EscPosBuilder.DoubleSize);
            builder.AddLine($"{item.Quantity:0.##}x {item.Name}");
            builder.AddCommand(EscPosBuilder.NormalSize);
            builder.AddCommand(EscPosBuilder.BoldOff);

            if (item.Modifiers != null && item.Modifiers.Any())
            {
                builder.AddCommand(EscPosBuilder.BoldOn);
                foreach (var mod in item.Modifiers)
                    builder.AddLine($"    * {mod}");
                builder.AddCommand(EscPosBuilder.BoldOff);
            }

            if (!string.IsNullOrEmpty(item.Notes))
                builder.AddLine($"    > {item.Notes}");
                
            builder.AddLineFeed();
        }

        builder.AddDivider('=');
        builder.AddLineFeed(3);
        builder.AddCommand(EscPosBuilder.CutPartial);

        return await SendToPrinterAsync(printer, builder.Build());
    }

    public async Task<(bool success, string? error)> PrintWaiterSlipAsync(KotData kot, string? outletId = null)
    {
        var printer = await GetPrinterByRoleAsync("RECEIPT", outletId);
        if (printer == null)
            return (false, "No active RECEIPT printer configured for waiter slip.");

        var builder = new EscPosBuilder(new PrinterProfile { PaperWidth = printer.PaperWidth });

        builder.AddCommand(EscPosBuilder.AlignCenter);
        builder.AddCommand(EscPosBuilder.InvertOn);
        builder.AddCommand(EscPosBuilder.BoldOn);
        builder.AddCommand(EscPosBuilder.DoubleSize);
        builder.AddLine("  WAITER SLIP  ");
        builder.AddCommand(EscPosBuilder.NormalSize);
        builder.AddCommand(EscPosBuilder.BoldOff);
        builder.AddCommand(EscPosBuilder.InvertOff);
        builder.AddLineFeed();

        builder.AddCommand(EscPosBuilder.AlignLeft);
        builder.AddLine($"Table: {kot.TableNumber ?? "Walk-in"}   Order: {kot.OrderNumber}");
        builder.AddLine($"Server: {kot.ServerName}");
        if (!string.IsNullOrEmpty(kot.KotNumber)) builder.AddLine($"Batch: {kot.KotNumber}");
        builder.AddDivider('-');

        foreach (var item in kot.Items)
        {
            builder.AddCommand(EscPosBuilder.BoldOn);
            builder.AddLine($"{item.Quantity}x {item.Name}");
            builder.AddCommand(EscPosBuilder.BoldOff);

            if (item.Modifiers != null)
                foreach (var mod in item.Modifiers)
                    builder.AddLine($"    + {mod}");

            if (!string.IsNullOrEmpty(item.Notes))
                builder.AddLine($"    * {item.Notes}");
        }

        builder.AddLineFeed(3);
        builder.AddCommand(EscPosBuilder.CutPartial);

        return await SendToPrinterAsync(printer, builder.Build());
    }

    public async Task<(bool success, string message)> TestConnectionAsync(string ip, int port = 9100)
    {
        try
        {
            using var client = new TcpClient();
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await client.ConnectAsync(ip, port, cts.Token);

            using var stream = client.GetStream();
            var b = new EscPosBuilder(new PrinterProfile());
            b.AddLineFeed(3);
            b.AddCommand(EscPosBuilder.CutPartial);
            await stream.WriteAsync(b.Build());

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

    public async Task<(bool success, string? error)> TestPrintAsync(LocalPrinterConfig printer)
    {
        var profile = new PrinterProfile { PaperWidth = printer.PaperWidth, HotelName = printer.Name };
        var builder = new EscPosBuilder(profile);

        builder.PrintHeader("TEST PRINT");
        builder.AddRow("Printer :", printer.Name);
        builder.AddRow("Type    :", printer.ConnectionType);
        if (printer.ConnectionType == "NETWORK")
            builder.AddRow("Target  :", $"{printer.IpAddress}:{printer.Port}");
        else
            builder.AddRow("Target  :", printer.DevicePath ?? "N/A");
        
        builder.AddLineFeed(2);
        builder.AddCommand(EscPosBuilder.AlignCenter);
        builder.AddLine("If you can read this, the printer is");
        builder.AddLine("successfully connected and working!");
        builder.AddLineFeed(3);
        builder.AddCommand(EscPosBuilder.CutPartial);

        return await SendToPrinterAsync(printer, builder.Build());
    }

    public Task<List<string>> GetAvailablePrintersAsync()
    {
        var list = new List<string>();
        try { list.AddRange(System.IO.Ports.SerialPort.GetPortNames()); } catch { }
        if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows))
        {
            try { foreach (string p in System.Drawing.Printing.PrinterSettings.InstalledPrinters) { if (!list.Contains(p)) list.Add(p); } } catch { }
        }
        return Task.FromResult(list);
    }

    private async Task<(bool, string?)> SendToPrinterAsync(LocalPrinterConfig printer, byte[] data)
    {
        try
        {
            if (printer.ConnectionType == "SERIAL")
            {
                if (string.IsNullOrWhiteSpace(printer.DevicePath))
                    return (false, "Serial port path not configured.");

                using var serialPort = new System.IO.Ports.SerialPort(printer.DevicePath, printer.BaudRate);
                serialPort.Open();
                serialPort.Write(data, 0, data.Length);
                serialPort.Close();

                _logger.LogInformation("Printed to {Name} (SERIAL {Path})", printer.Name, printer.DevicePath);
                return (true, null);
            }
            else if (printer.ConnectionType == "USB")
            {
                if (string.IsNullOrWhiteSpace(printer.DevicePath))
                    return (false, "USB device path/printer name not configured.");

                bool isWindows = System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows);

                if (isWindows)
                {
                    bool ok = RawPrinterHelper.SendBytesToPrinter(printer.DevicePath, data, out string errMsg);
                    if (!ok) return (false, "Failed to send bytes to raw Windows printer: " + errMsg);
                }
                else
                {
                    using var stream = System.IO.File.OpenWrite(printer.DevicePath);
                    await stream.WriteAsync(data, 0, data.Length);
                    await stream.FlushAsync();
                }

                _logger.LogInformation("Printed to {Name} (USB {Path})", printer.Name, printer.DevicePath);
                return (true, null);
            }
            else
            {
                using var client = new TcpClient();
                var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                try
                {
                    await client.ConnectAsync(printer.IpAddress, printer.Port, cts.Token);

                    using var stream = client.GetStream();
                    await stream.WriteAsync(data, 0, data.Length, cts.Token);
                    await stream.FlushAsync(cts.Token);

                    _logger.LogInformation("Printed to {Name} ({Ip}:{Port})", printer.Name, printer.IpAddress, printer.Port);
                    return (true, null);
                }
                catch (OperationCanceledException)
                {
                    return (false, $"Printer connection timed out ({printer.IpAddress}:{printer.Port}).");
                }
                catch (System.Net.Sockets.SocketException ex)
                {
                    return (false, $"Printer connection failed ({printer.IpAddress}:{printer.Port}): {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            var msg = $"Printer '{printer.Name}' error: {ex.Message}";
            _logger.LogError(ex, msg);
            return (false, msg);
        }
    }
}
