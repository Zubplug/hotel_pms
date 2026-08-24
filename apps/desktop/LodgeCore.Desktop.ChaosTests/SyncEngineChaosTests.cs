using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Net.Http;
using System.Net;
using Moq;
using Moq.Protected;
using Xunit;
using Microsoft.EntityFrameworkCore;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using LodgeCore.Desktop.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace LodgeCore.Desktop.ChaosTests;

public class SyncEngineChaosTests
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
    public async Task PoisonPill_ShouldTransitionToDeadLetter_AndAllowSubsequentEvents()
    {
        // Arrange
        var db = GetDbContext();
        db.Properties.Add(new LocalProperty { Id = "prop1", IsActive = true, Code = "PROP1" });
        
        var badEvent = new LocalOutboxEvent 
        { 
            Id = Guid.NewGuid().ToString(), 
            SyncStatus = "PENDING", 
            AttemptCount = 4, // Next attempt will be 5, making it dead
            PayloadJson = "{ \"bad\": \"payload\" }",
            EventType = "BAD_EVENT",
            PropertyId = "prop1",
            IdempotencyKey = "123"
        };
        
        var goodEvent = new LocalOutboxEvent 
        { 
            Id = Guid.NewGuid().ToString(), 
            SyncStatus = "PENDING", 
            AttemptCount = 0,
            PayloadJson = "{ \"good\": \"payload\" }",
            EventType = "GOOD_EVENT",
            PropertyId = "prop1",
            IdempotencyKey = "456"
        };
        
        db.OutboxEvents.Add(badEvent);
        db.OutboxEvents.Add(goodEvent);
        await db.SaveChangesAsync();

        // Mock HTTP Client to fail for BAD_EVENT and succeed for GOOD_EVENT
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req => req.RequestUri!.ToString().Contains("sync/push")),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync((HttpRequestMessage req, CancellationToken token) => 
            {
                var content = req.Content!.ReadAsStringAsync().Result;
                if (content.Contains("BAD_EVENT"))
                {
                    return new HttpResponseMessage(HttpStatusCode.InternalServerError); // Simulate failure
                }
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{ \"accepted\": [\"" + goodEvent.Id + "\"] }")
                };
            });

        var httpClient = new HttpClient(handlerMock.Object) { BaseAddress = new Uri("http://localhost/") };
        
        var scopeFactoryMock = new Mock<IServiceScopeFactory>();
        var scopeMock = new Mock<IServiceScope>();
        var spMock = new Mock<IServiceProvider>();
        spMock.Setup(sp => sp.GetService(typeof(LocalDbContext))).Returns(db);
        scopeMock.Setup(s => s.ServiceProvider).Returns(spMock.Object);
        scopeFactoryMock.Setup(f => f.CreateScope()).Returns(scopeMock.Object);

        var loggerMock = new Mock<ILogger<SyncEngine>>();
        
        var authManagerMock = new Mock<AuthManager>(MockBehavior.Loose, httpClient, null!, null!);
        authManagerMock.Setup(a => a.GetSessionAsync()).ReturnsAsync(new DesktopSession { PropertyId = "prop1" });

        var credentialStorageMock = new Mock<ICredentialStorageService>();

        var syncEngine = new SyncEngine(
            spMock.Object, 
            loggerMock.Object, 
            authManagerMock.Object, 
            httpClient, 
            credentialStorageMock.Object
        );

        // Inject the scope factory via reflection since it's private/protected in BackgroundService usually, or we just call the private methods if we make them public/internal for testing.
        // For testing purposes, we'll invoke the private PushPendingEventsAsync using reflection.
        var method = typeof(SyncEngine).GetMethod("PushPendingEventsAsync", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        // Act
        // Set _scopeFactory on SyncEngine
        var field = typeof(SyncEngine).GetField("_scopeFactory", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        field!.SetValue(syncEngine, scopeFactoryMock.Object);

        await (Task)method!.Invoke(syncEngine, new object[] { CancellationToken.None })!;

        // Assert
        var updatedBad = await db.OutboxEvents.FindAsync(badEvent.Id);
        var updatedGood = await db.OutboxEvents.FindAsync(goodEvent.Id);
        
        Assert.Equal("DEAD_LETTER", updatedBad!.SyncStatus);
        Assert.Equal(5, updatedBad.AttemptCount);
        
        // Good event should have succeeded and been removed or marked COMPLETED (SyncEngine removes them on success)
        Assert.Null(updatedGood); // If SyncEngine removes successful events
    }
}
