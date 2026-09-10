using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Single-authority background service for production ticket printing.
///
/// Design principles:
///   • This is the ONLY code path that prints KOTs. The frontend must NOT
///     call PrintKitchenTicketAsync directly after firing items — that causes
///     every ticket to print twice (once immediately, once when this service
///     polls 5 s later and still sees PrintStatus = QUEUED).
///   • Station routing: BAR KOTs → BAR printer, KITCHEN KOTs → KITCHEN printer.
///     Fallback to RECEIPT printer when the station-specific printer is not
///     configured.
///   • Waiter slip is printed on the RECEIPT printer. A waiter-slip failure is
///     logged as a warning but does NOT prevent the main KOT from being marked
///     PRINTED — the kitchen must not be blocked by a waiter-side printer error.
///   • Up to 3 automatic retries. After 3 failures the KOT is marked FAILED so
///     it does not loop forever.
/// </summary>
public class KotPrintService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly EscPosService _escPos;
    private readonly ILogger<KotPrintService> _logger;
    private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(5);

    public KotPrintService(IServiceProvider serviceProvider, EscPosService escPos, ILogger<KotPrintService> logger)
    {
        _serviceProvider = serviceProvider;
        _escPos = escPos;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("KOT Print Service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessKotQueueAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "KOT Print Service error in poll cycle.");
            }

            await Task.Delay(_pollInterval, stoppingToken);
        }
    }

    private async Task ProcessKotQueueAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        // Fetch queued KOTs (max 3 retries), oldest first so urgent tickets
        // are never starved by a later failed KOT.
        var queuedKots = await dbContext.PosKots
            .Where(k => k.PrintStatus == "QUEUED" || (k.PrintStatus == "FAILED" && k.AttemptCount < 3))
            .OrderBy(k => k.CreatedAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        if (!queuedKots.Any()) return;

        foreach (var kot in queuedKots)
        {
            kot.AttemptCount++;

            // Resolve station once — used for printer routing and logging.
            var station = string.IsNullOrWhiteSpace(kot.ProductionStation)
                ? "KITCHEN"
                : kot.ProductionStation.Trim().ToUpperInvariant();

            try
            {
                // ── 1. Load items for this KOT ──────────────────────────
                var itemIds = JsonSerializer.Deserialize<List<string>>(kot.ItemIdsJson) ?? new List<string>();
                var items = await dbContext.PosOrderItems
                    .Where(i => itemIds.Contains(i.Id))
                    .Include(i => i.Modifiers)
                    .ToListAsync(cancellationToken);

                // ── 2. Resolve waiter name ───────────────────────────────
                var order = await dbContext.PosOrders.FindAsync(new object[] { kot.OrderId }, cancellationToken);
                var waiter = order?.ServerStaffId == null
                    ? null
                    : await dbContext.Staff.FindAsync(new object[] { order.ServerStaffId }, cancellationToken);
                var waiterName = waiter == null
                    ? kot.ServerName
                    : $"{waiter.FirstName} {waiter.LastName}".Trim();

                // ── 3. Build the KotData DTO ─────────────────────────────
                var kotData = new KotData(
                    KotNumber: kot.KotNumber,
                    OrderNumber: kot.OrderNumber,
                    TableNumber: kot.TableNumber,
                    ServerName: waiterName,
                    OutletName: await GetOutletNameAsync(dbContext, kot.OutletId),
                    Items: items.Select(i => new KotItem(
                        Name: i.ProductName,
                        Quantity: i.Quantity,
                        Course: i.Course,
                        Notes: null,
                        Modifiers: i.Modifiers.Select(m => m.Name).ToList()
                    )).ToList(),
                    FiredAt: kot.FiredAt ?? kot.CreatedAt,
                    // Station drives printer selection: BAR → bar printer, KITCHEN → kitchen printer.
                    Station: station,
                    OrderType: order?.OrderType,
                    // A KOT is incremental (i.e. "NEW ITEMS" on the ticket) when at least
                    // one earlier KOT already exists for this order.
                    IsIncremental: await dbContext.PosKots
                        .AnyAsync(k => k.OrderId == kot.OrderId && k.CreatedAt < kot.CreatedAt, cancellationToken)
                );

                // ── 4. Print to the station printer (BAR or KITCHEN) ────
                _logger.LogInformation(
                    "Printing KOT {KotNumber} to [{Station}] printer (attempt {Attempt}).",
                    kot.KotNumber, station, kot.AttemptCount);

                var (stationSuccess, stationError) = await _escPos.PrintKotAsync(kotData, kot.OutletId);

                // ── 5. Update print status based on station printer result ─
                if (stationSuccess)
                {
                    kot.PrintStatus = "PRINTED";
                    kot.PrintedAt = DateTime.UtcNow;
                    _logger.LogInformation(
                        "KOT {KotNumber} [{Station}] printed successfully.", kot.KotNumber, station);

                    // ── 6. Waiter slip on RECEIPT printer (best-effort) ──
                    // A failure here is a warning — it must NOT re-queue the
                    // main KOT or the kitchen will receive the ticket twice.
                    var (waiterSuccess, waiterError) = await _escPos.PrintWaiterSlipAsync(kotData, kot.OutletId);
                    if (!waiterSuccess)
                    {
                        _logger.LogWarning(
                            "Waiter slip for KOT {KotNumber} was not printed (non-fatal): {Error}",
                            kot.KotNumber, waiterError);
                    }
                }
                else
                {
                    // Station printer failed — retry up to 3 times then give up.
                    kot.PrintStatus = kot.AttemptCount >= 3 ? "FAILED" : "QUEUED";
                    _logger.LogWarning(
                        "KOT {KotNumber} [{Station}] print failed (attempt {Attempt}/{Max}): {Error}",
                        kot.KotNumber, station, kot.AttemptCount, 3, stationError);
                }
            }
            catch (Exception ex)
            {
                kot.PrintStatus = kot.AttemptCount >= 3 ? "FAILED" : "QUEUED";
                _logger.LogError(ex, "Exception printing KOT {KotNumber}.", kot.KotNumber);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task<string> GetOutletNameAsync(LocalDbContext db, string outletId)
    {
        var outlet = await db.PosOutlets.FindAsync(outletId);
        return outlet?.Name ?? "Kitchen";
    }
}
