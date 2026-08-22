using System;
using System.Text.Json;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using System.Threading.Tasks;

class Program {
    static async Task Main() {
        var options = new DbContextOptionsBuilder<LocalDbContext>()
            .UseSqlite("Data Source=lodgecore_test.db")
            .Options;
            
        using var db = new LocalDbContext(options);
        await db.Database.EnsureCreatedAsync();
        
        // Mock a reservation
        db.Guests.Add(new LocalGuest { Id = "g1", FirstName = "Test", LastName = "User" });
        db.Reservations.Add(new LocalReservation { Id = Guid.NewGuid().ToString(), PropertyId = "p1", GuestId = "g1", Status = "CONFIRMED" });
        await db.SaveChangesAsync();

        var res = await db.Reservations.Include(r => r.Guest).Include(r => r.Folio).ToListAsync();
        var mapped = res.Select(r => new {
            id = r.Id,
            confirmationNumber = r.Id.Substring(0, 8).ToUpper(),
            primaryGuest = new { firstName = r.Guest?.FirstName, lastName = r.Guest?.LastName }
        });
        
        var json = JsonSerializer.Serialize(new { success = true, data = mapped }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        Console.WriteLine(json);
    }
}
