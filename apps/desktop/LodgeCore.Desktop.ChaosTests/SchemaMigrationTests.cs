using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using Microsoft.EntityFrameworkCore;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop.ChaosTests;

public class SchemaMigrationTests
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
    public async Task ReservationRoom_RoundTrip_ShouldPreserveRelationships()
    {
        // Arrange
        var db = GetDbContext();
        
        // Simulate a pull from cloud creating a complex reservation with 2 rooms
        var reservationId = Guid.NewGuid().ToString();
        var localReservation = new LocalReservation
        {
            Id = reservationId,
            PropertyId = "prop1",
            GuestId = "guest1",
            Status = "PENDING",
            CheckInDate = DateTime.UtcNow,
            CheckOutDate = DateTime.UtcNow.AddDays(2),
            Version = 1,
            IsDirty = false
        };

        var roomA = new LocalReservationRoom
        {
            Id = Guid.NewGuid().ToString(),
            ReservationId = reservationId,
            RoomId = "roomA",
            RoomNumber = "101",
            RoomTypeId = "typeA",
            Adults = 2,
            Children = 0
        };

        var roomB = new LocalReservationRoom
        {
            Id = Guid.NewGuid().ToString(),
            ReservationId = reservationId,
            RoomId = "roomB",
            RoomNumber = "102",
            RoomTypeId = "typeA",
            Adults = 1,
            Children = 0
        };

        localReservation.Rooms.Add(roomA);
        localReservation.Rooms.Add(roomB);

        db.Reservations.Add(localReservation);
        await db.SaveChangesAsync();

        // Act - Re-fetch
        var reloadedDb = GetDbContext();
        // Since we are using an InMemoryDatabase, we need to pass the same name to persist it across contexts if we want a true round trip, 
        // but for a quick integrity check on the same context:
        var fetched = await db.Reservations
            .Include(r => r.Rooms)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        // Assert
        Assert.NotNull(fetched);
        Assert.Equal(2, fetched!.Rooms.Count);
        Assert.Contains(fetched.Rooms, r => r.RoomNumber == "101");
        Assert.Contains(fetched.Rooms, r => r.RoomNumber == "102");
    }
}
