using Microsoft.EntityFrameworkCore;
using LodgeCore.Desktop.Data.Entities;

namespace LodgeCore.Desktop.Data;

public class LocalDbContext : DbContext
{
    public DbSet<LocalReservation> Reservations { get; set; } = null!;
    public DbSet<LocalGuest> Guests { get; set; } = null!;
    public DbSet<LocalFolio> Folios { get; set; } = null!;
    public DbSet<LocalSyncEvent> SyncEvents { get; set; } = null!;
    public DbSet<LocalHousekeepingTask> HousekeepingTasks { get; set; } = null!;

    public LocalDbContext(DbContextOptions<LocalDbContext> options) : base(options)
    {
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
        {
            // In a production app, the connection string will include a Password=... for SQLCipher encryption
            string dbPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LodgeCoreOffline.db");
            optionsBuilder.UseSqlite($"Data Source={dbPath}");
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Configure relationships and constraints here
        modelBuilder.Entity<LocalReservation>()
            .HasOne(r => r.Guest)
            .WithMany(g => g.Reservations)
            .HasForeignKey(r => r.GuestId);

        modelBuilder.Entity<LocalFolio>()
            .HasOne(f => f.Reservation)
            .WithOne(r => r.Folio)
            .HasForeignKey<LocalFolio>(f => f.ReservationId);
    }
}
