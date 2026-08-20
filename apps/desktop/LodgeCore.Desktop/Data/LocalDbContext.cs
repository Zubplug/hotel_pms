using Microsoft.EntityFrameworkCore;
using LodgeCore.Desktop.Data.Entities;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop.Data;

public class LocalDbContext : DbContext
{
    public DbSet<LocalReservation> Reservations { get; set; } = null!;
    public DbSet<LocalGuest> Guests { get; set; } = null!;
    public DbSet<LocalFolio> Folios { get; set; } = null!;
    public DbSet<LocalSyncEvent> SyncEvents { get; set; } = null!;
    public DbSet<LocalHousekeepingTask> HousekeepingTasks { get; set; } = null!;
    public DbSet<LocalMaintenanceTicket> MaintenanceTickets { get; set; } = null!;
    public DbSet<LocalRoom> Rooms { get; set; } = null!;
    public DbSet<LocalRoomType> RoomTypes { get; set; } = null!;
    public DbSet<LocalProperty> Properties { get; set; } = null!;

    public DbSet<LocalPosOutlet> PosOutlets { get; set; } = null!;
    public DbSet<LocalProductCategory> ProductCategories { get; set; } = null!;
    public DbSet<LocalPosProduct> PosProducts { get; set; } = null!;
    public DbSet<LocalStockItem> StockItems { get; set; } = null!;
    public DbSet<LocalRecipeIngredient> RecipeIngredients { get; set; } = null!;
    public DbSet<LocalPosSession> PosSessions { get; set; } = null!;
    public DbSet<LocalPosOrder> PosOrders { get; set; } = null!;
    public DbSet<LocalPosOrderItem> PosOrderItems { get; set; } = null!;
    public DbSet<LocalPosPayment> PosPayments { get; set; } = null!;
    public DbSet<LocalStaff> Staff { get; set; } = null!;
    public DbSet<LocalLoginAttempt> LoginAttempts { get; set; } = null!;
    public DbSet<LocalStockTransaction> StockTransactions { get; set; } = null!;
    public DbSet<LocalPosOperatorSession> PosOperatorSessions { get; set; } = null!;
    public DbSet<LocalPosTerminal> PosTerminals { get; set; } = null!;
    public DbSet<LocalOperatorContext> OperatorContexts { get; set; } = null!;
    public DbSet<LocalPosAuthorizationAudit> PosAuthorizationAudits { get; set; } = null!;
    public DbSet<LocalPosFloorPlan> PosFloorPlans { get; set; } = null!;
    public DbSet<LocalPosTable> PosTables { get; set; } = null!;
    public DbSet<LocalPosCheck> PosChecks { get; set; } = null!;
    public DbSet<LocalPosKot> PosKots { get; set; } = null!;
    public DbSet<LocalPosProductModifier> PosProductModifiers { get; set; } = null!;
    public DbSet<LocalPosOrderItemModifier> PosOrderItemModifiers { get; set; } = null!;
    public DbSet<LocalPosCashMovement> PosCashMovements { get; set; } = null!;
    public DbSet<LocalPosSettlement> PosSettlements { get; set; } = null!;
    public DbSet<LocalPosVoid> PosVoids { get; set; } = null!;
    public DbSet<LocalPosReceiptAudit> PosReceiptAudits { get; set; } = null!;
    public DbSet<LocalPosDiscount> PosDiscounts { get; set; } = null!;
    public DbSet<LocalKeycardAudit> KeycardAudits { get; set; } = null!;
    public DbSet<LocalHardwareAuditLog> HardwareAuditLogs { get; set; } = null!;
    public DbSet<LocalPrinterConfig> PrinterConfigs { get; set; } = null!;


    public LocalDbContext(DbContextOptions<LocalDbContext> options) : base(options)
    {
        Database.EnsureCreated();
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

        modelBuilder.Entity<LocalPosOrder>()
            .HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId);

        modelBuilder.Entity<LocalPosOrder>()
            .HasMany(o => o.Payments)
            .WithOne()
            .HasForeignKey(p => p.OrderId);

        modelBuilder.Entity<LocalPosSession>()
            .HasMany(s => s.CashMovements)
            .WithOne()
            .HasForeignKey(c => c.PosSessionId);
        modelBuilder.Entity<LocalPosOrder>()
            .HasMany(o => o.Voids)
            .WithOne()
            .HasForeignKey(v => v.OrderId);

        modelBuilder.Entity<LocalPosOrder>()
            .HasMany(o => o.Kots)
            .WithOne()
            .HasForeignKey(k => k.OrderId);

        modelBuilder.Entity<LocalPosOrder>()
            .HasMany(o => o.Checks)
            .WithOne()
            .HasForeignKey(c => c.OrderId);

        modelBuilder.Entity<LocalPosOrder>()
            .HasMany(o => o.Discounts)
            .WithOne()
            .HasForeignKey(d => d.OrderId);

        modelBuilder.Entity<LocalPosOrderItem>()
            .HasMany(i => i.Modifiers)
            .WithOne()
            .HasForeignKey(m => m.OrderItemId);
            
        modelBuilder.Entity<LocalSyncEvent>()
            .HasIndex(e => new { e.TerminalId, e.SequenceNumber })
            .IsUnique();
    }
}
