using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LodgeCore.Desktop.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace LodgeCore.Desktop.Services;

public class KotPrintService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(5);

    public KotPrintService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessKotQueueAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"KOT Print Service Error: {ex.Message}");
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

        foreach (var kot in queuedKots)
        {
            try
            {
                kot.AttemptCount++;
                
                // TODO: Actual ESC/POS network printing logic here
                // bool success = await _printerService.PrintKotAsync(kot.PrinterId, kot);
                bool success = true; // Simulated success

                if (success)
                {
                    kot.PrintStatus = "PRINTED";
                    kot.PrintedAt = DateTime.UtcNow;
                }
                else
                {
                    kot.PrintStatus = "FAILED";
                }
            }
            catch (Exception)
            {
                kot.PrintStatus = "FAILED";
            }
        }

        if (queuedKots.Any())
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
