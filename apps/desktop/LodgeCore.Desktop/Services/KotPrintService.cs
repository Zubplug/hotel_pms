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

        // Fetch queued KOTs (max 3 retries)
        var queuedKots = await dbContext.PosKots
            .Where(k => k.PrintStatus == "QUEUED" || (k.PrintStatus == "FAILED" && k.AttemptCount < 3))
            .OrderBy(k => k.CreatedAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        if (!queuedKots.Any()) return;

        foreach (var kot in queuedKots)
        {
            kot.AttemptCount++;

            try
            {
                // Load the order items for this KOT
                var itemIds = JsonSerializer.Deserialize<List<string>>(kot.ItemIdsJson) ?? new List<string>();
                var items = await dbContext.PosOrderItems
                    .Where(i => itemIds.Contains(i.Id))
                    .Include(i => i.Modifiers)
                    .ToListAsync(cancellationToken);
                var order = await dbContext.PosOrders.FindAsync(new object[] { kot.OrderId }, cancellationToken);
                var waiter = order?.ServerStaffId == null
                    ? null
                    : await dbContext.Staff.FindAsync(new object[] { order.ServerStaffId }, cancellationToken);
                var waiterName = waiter == null
                    ? kot.ServerName
                    : $"{waiter.FirstName} {waiter.LastName}".Trim();

                // Build the KotData DTO for the ESC/POS service
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
                    Station: string.IsNullOrWhiteSpace(kot.ProductionStation) ? "KITCHEN" : kot.ProductionStation,
                    OrderType: order?.OrderType,
                    IsIncremental: order != null && order.Kots.Count(k => k.CreatedAt < kot.CreatedAt) > 0
                );

                var (success, error) = await _escPos.PrintKotAsync(kotData, kot.OutletId);
                var (waiterCopySuccess, waiterCopyError) = await _escPos.PrintWaiterSlipAsync(kotData, kot.OutletId);
                if (!waiterCopySuccess)
                {
                    _logger.LogWarning("Waiter copy for KOT {KotNumber} was not printed: {Error}",
                        kot.KotNumber, waiterCopyError);
                }

                if (success)
                {
                    kot.PrintStatus = "PRINTED";
                    kot.PrintedAt = DateTime.UtcNow;
                    _logger.LogInformation("KOT {KotNumber} printed successfully.", kot.KotNumber);
                }
                else
                {
                    kot.PrintStatus = kot.AttemptCount >= 3 ? "FAILED" : "QUEUED";
                    _logger.LogWarning("KOT {KotNumber} print failed (attempt {Attempt}): {Error}",
                        kot.KotNumber, kot.AttemptCount, error);
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
