using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using Microsoft.EntityFrameworkCore;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop.ChaosTests;

public class FinancialIntegrityTests
{
    private LocalDbContext GetDbContext()
    {
        var options = new DbContextOptionsBuilder<LocalDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var db = new LocalDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    [Fact]
    public async Task RecordChargeAsync_DuplicateIPC_ShouldBeIdempotent()
    {
        // Arrange
        var db = GetDbContext();
        var repo = new LocalRepository(db, null!); // logger not strictly needed if we don't mock it, but we can pass null if it accepts it. Let's assume it doesn't crash on null logger or we don't use it.
        
        var folioId = Guid.NewGuid().ToString();
        var folio = new LocalFolio { Id = folioId, PropertyId = "prop1", Status = "OPEN", TransactionsJson = "{}" };
        db.Folios.Add(folio);
        await db.SaveChangesAsync();

        string idempotencyKey = Guid.NewGuid().ToString();

        // Act - Simulate 3 identical IPC calls firing at the same time due to a frontend retry storm
        var task1 = repo.RecordChargeAsync(folioId, 15000m, "Room Service", "user1", "device1", idempotencyKey);
        var task2 = repo.RecordChargeAsync(folioId, 15000m, "Room Service", "user1", "device1", idempotencyKey);
        var task3 = repo.RecordChargeAsync(folioId, 15000m, "Room Service", "user1", "device1", idempotencyKey);

        var results = await Task.WhenAll(task1, task2, task3);

        // Assert
        var updatedFolio = await db.Folios.FindAsync(folioId);
        
        Assert.True(results.All(r => r == true), "All calls should return success.");
        
        // The folio should only be charged once (₦15,000) not three times (₦45,000)
        Assert.Equal(15000m, updatedFolio!.TotalCharges);
        
        // Outbox events should only contain 1 charge event
        var outboxEvents = await db.OutboxEvents.Where(e => e.AggregateId == folioId).ToListAsync();
        Assert.Single(outboxEvents);
    }
}
