using Microsoft.EntityFrameworkCore;
using LodgeCore.Desktop.Data.Entities;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop.Data;

public class LocalDbContext : DbContext
{
    public DbSet<LocalReservation> Reservations { get; set; } = null!;
    public DbSet<LocalReservationRoom> ReservationRooms { get; set; } = null!;
    public DbSet<LocalGuest> Guests { get; set; } = null!;
    public DbSet<LocalCorporateAccount> CorporateAccounts { get; set; } = null!;
    public DbSet<LocalRatePlan> RatePlans { get; set; } = null!;
    public DbSet<LocalRate> Rates { get; set; } = null!;
    public DbSet<LocalCityLedgerEntry> CityLedgerEntries { get; set; } = null!;
    public DbSet<LocalFolio> Folios { get; set; } = null!;
    public DbSet<LocalSyncEvent> SyncEvents { get; set; } = null!;
    public DbSet<LocalOutboxEvent> OutboxEvents { get; set; } = null!;
    public DbSet<LocalHousekeepingTask> HousekeepingTasks { get; set; } = null!;
    public DbSet<LocalMaintenanceTicket> MaintenanceTickets { get; set; } = null!;
    public DbSet<LocalLockCredential> LockCredentials { get; set; } = null!;
    public DbSet<LocalLockOperation> LockOperations { get; set; } = null!;
    public DbSet<LocalRoom> Rooms { get; set; } = null!;
    public DbSet<LocalRoomType> RoomTypes { get; set; } = null!;
    public DbSet<LocalProperty> Properties { get; set; } = null!;
    public DbSet<LocalRefundRequest> RefundRequests { get; set; } = null!;

    public DbSet<LocalPosOutlet> PosOutlets { get; set; } = null!;
    public DbSet<LocalProductCategory> ProductCategories { get; set; } = null!;
    public DbSet<LocalPosProduct> PosProducts { get; set; } = null!;
    public DbSet<LocalStockItem> StockItems { get; set; } = null!;
    public DbSet<LocalRecipeIngredient> RecipeIngredients { get; set; } = null!;
    public DbSet<LocalPosSession> PosSessions { get; set; } = null!;
    public DbSet<LocalFrontdeskSession> FrontdeskSessions { get; set; } = null!;
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
    public DbSet<LocalCashAccount> CashAccounts { get; set; } = null!;
    public DbSet<LocalPosSettlement> PosSettlements { get; set; } = null!;
    public DbSet<LocalPosVoid> PosVoids { get; set; } = null!;
    public DbSet<LocalPosReceiptAudit> PosReceiptAudits { get; set; } = null!;
    public DbSet<LocalPosDiscount> PosDiscounts { get; set; } = null!;
    public DbSet<LocalKeycardAudit> KeycardAudits { get; set; } = null!;
    public DbSet<LocalHardwareAuditLog> HardwareAuditLogs { get; set; } = null!;
    public DbSet<LocalPrinterConfig> PrinterConfigs { get; set; } = null!;
    public DbSet<LocalSyncMetadata> SyncMetadata { get; set; } = null!;
    public DbSet<LocalPosProductionBatch> PosProductionBatches { get; set; } = null!;
    public DbSet<LocalPosProductionBatchItem> PosProductionBatchItems { get; set; } = null!;

    public DbSet<LocalLaundryItem> LaundryItems { get; set; } = null!;
    public DbSet<LocalLaundryOrder> LaundryOrders { get; set; } = null!;
    public DbSet<LocalLaundryOrderItem> LaundryOrderItems { get; set; } = null!;
    public DbSet<LocalLaundryOrderStatusHistory> LaundryOrderStatusHistory { get; set; } = null!;
    public DbSet<LocalOverrideAudit> OverrideAudits { get; set; } = null!;

    public LocalDbContext(DbContextOptions<LocalDbContext> options) : base(options)
    {
    }

    /// <summary>
    /// Defers SQLite foreign key constraint checks to transaction commit.
    /// Without this, SQLite validates FKs immediately after each INSERT/DELETE,
    /// which causes "FOREIGN KEY constraint failed" when a parent and its children
    /// are written in the same EF Core SaveChanges batch (e.g. Reservation + ReservationRoom).
    /// PRAGMA defer_foreign_keys = ON makes SQLite behave like PostgreSQL/SQL Server:
    /// FKs are only checked when the transaction is committed, by which point all rows exist.
    /// </summary>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await Database.ExecuteSqlRawAsync("PRAGMA defer_foreign_keys = ON;", cancellationToken);
        return await base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        Database.ExecuteSqlRaw("PRAGMA defer_foreign_keys = ON;");
        return base.SaveChanges();
    }

    public async Task ApplyMigrationsSafelyAsync()
    {
        var dbPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LodgeCoreOffline.db");
        
        if (System.IO.File.Exists(dbPath))
        {
            var timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd-HHmmss");
            var backupPath = $"{dbPath}.backup-{timestamp}";
            
            // Ensure connection is closed before backing up/migrating
            await Database.CloseConnectionAsync();
            System.IO.File.Copy(dbPath, backupPath, true);

            try
            {
                await Database.MigrateAsync();
            }
            catch (Exception ex)
            {
                await Database.CloseConnectionAsync();
                System.IO.File.Copy(backupPath, dbPath, true);
                throw new Exception($"Database migration failed. Rolled back safely to {backupPath}.", ex);
            }
        }
        else
        {
            await Database.MigrateAsync();
        }
    }

    public async Task ApplyNoShowSchemaAsync()
    {
        var columns = new[]
        {
            "ALTER TABLE Reservations ADD COLUMN LateArrivalExpected INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Reservations ADD COLUMN LateArrivalNotes TEXT",
            "ALTER TABLE Reservations ADD COLUMN LateArrivalAt TEXT",
            "ALTER TABLE Reservations ADD COLUMN LateArrivalBy TEXT",
            "ALTER TABLE Reservations ADD COLUMN NoShowAssessedAt TEXT",
            "ALTER TABLE Reservations ADD COLUMN NoShowChargeAmount TEXT",
            "ALTER TABLE Reservations ADD COLUMN NoShowRefundableAmount TEXT",
            "ALTER TABLE Reservations ADD COLUMN ReinstatedAt TEXT",
            "ALTER TABLE Reservations ADD COLUMN ReinstatedBy TEXT",
            "ALTER TABLE Reservations ADD COLUMN ReinstatementReason TEXT",
            "ALTER TABLE Guests ADD COLUMN PropertyId TEXT NOT NULL DEFAULT ''"
        };
        foreach (var sql in columns)
        {
            try { await Database.ExecuteSqlRawAsync(sql); } catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 1 && ex.Message.Contains("duplicate column", StringComparison.OrdinalIgnoreCase)) { }
        }
    }

    public async Task ApplyFinancialControlSchemaAsync()
    {
        var columns = new[]
        {
            "ALTER TABLE Properties ADD COLUMN AuditStatus TEXT NOT NULL DEFAULT 'OPEN'",
            "ALTER TABLE Properties ADD COLUMN DepositApprovalThreshold TEXT NOT NULL DEFAULT '250000'",
            "ALTER TABLE Properties ADD COLUMN CreditAdjustmentApprovalThreshold TEXT NOT NULL DEFAULT '1'",
            "ALTER TABLE Properties ADD COLUMN RefundApprovalThreshold TEXT NOT NULL DEFAULT '1'",
            "ALTER TABLE Properties ADD COLUMN OfflineHighValueDepositPolicy TEXT NOT NULL DEFAULT 'BLOCK'",
            "ALTER TABLE Properties ADD COLUMN NoShowCutoffTime TEXT NOT NULL DEFAULT '02:00'",
            "ALTER TABLE Properties ADD COLUMN NoShowGracePeriodMinutes INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Properties ADD COLUMN NoShowChargeType TEXT NOT NULL DEFAULT 'FIRST_NIGHT'",
            "ALTER TABLE Properties ADD COLUMN NoShowChargeValue TEXT NOT NULL DEFAULT '0'",
            "ALTER TABLE Properties ADD COLUMN NoShowRefundableUnusedNights INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE Properties ADD COLUMN NoShowAllowReinstatement INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE Properties ADD COLUMN NoShowReinstatementRequiresApproval INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE PosSessions ADD COLUMN ControlStatus TEXT NOT NULL DEFAULT 'OPEN'",
            "ALTER TABLE PosSessions ADD COLUMN VarianceStatus TEXT NULL",
            "ALTER TABLE PosSessions ADD COLUMN SubmittedAt TEXT NULL",
            "ALTER TABLE PosSessions ADD COLUMN SubmittedBy TEXT NULL",
            "ALTER TABLE PosSessions ADD COLUMN ReviewStartedAt TEXT NULL",
            "ALTER TABLE PosSessions ADD COLUMN ReviewStartedBy TEXT NULL",
            "ALTER TABLE PosSessions ADD COLUMN ApprovalDecision TEXT NULL",
            "ALTER TABLE PosSessions ADD COLUMN ApprovalNotes TEXT NULL",
            "ALTER TABLE PosSessions ADD COLUMN HandoverAt TEXT NULL",
            "ALTER TABLE PosSessions ADD COLUMN DepositedAt TEXT NULL",
            "ALTER TABLE FrontdeskSessions ADD COLUMN ControlStatus TEXT NOT NULL DEFAULT 'OPEN'",
            "ALTER TABLE FrontdeskSessions ADD COLUMN VarianceStatus TEXT NULL",
            "ALTER TABLE FrontdeskSessions ADD COLUMN SubmittedAt TEXT NULL",
            "ALTER TABLE FrontdeskSessions ADD COLUMN SubmittedBy TEXT NULL",
            "ALTER TABLE FrontdeskSessions ADD COLUMN ReviewStartedAt TEXT NULL",
            "ALTER TABLE FrontdeskSessions ADD COLUMN ReviewStartedBy TEXT NULL",
            "ALTER TABLE FrontdeskSessions ADD COLUMN ApprovalDecision TEXT NULL",
            "ALTER TABLE FrontdeskSessions ADD COLUMN ApprovalNotes TEXT NULL",
            "ALTER TABLE FrontdeskSessions ADD COLUMN HandoverAt TEXT NULL",
            "ALTER TABLE FrontdeskSessions ADD COLUMN DepositedAt TEXT NULL"
        };
        foreach (var sql in columns)
        {
            try { await Database.ExecuteSqlRawAsync(sql); }
            catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 1 && ex.Message.Contains("duplicate column", StringComparison.OrdinalIgnoreCase)) { }
        }
    }

    public async Task ApplyManagerOverrideSchemaAsync()
    {
        var sql = @"
            CREATE TABLE IF NOT EXISTS OverrideAudits (
                Id TEXT NOT NULL PRIMARY KEY,
                PropertyId TEXT NOT NULL,
                OperatorStaffId TEXT NOT NULL,
                ManagerStaffId TEXT NOT NULL,
                Action TEXT NOT NULL,
                EntityType TEXT NOT NULL,
                EntityId TEXT NOT NULL,
                Reason TEXT NULL,
                Amount TEXT NULL,
                Metadata TEXT NULL,
                CreatedAt TEXT NOT NULL,
                SyncStatus TEXT NOT NULL DEFAULT 'PENDING'
            );
        ";
        await Database.ExecuteSqlRawAsync(sql);
    }

    public async Task ApplyPosRoutingSchemaAsync()
    {
        var columns = new[]
        {
            "ALTER TABLE PosKots ADD COLUMN ProductionStation TEXT NOT NULL DEFAULT 'KITCHEN'",
            "ALTER TABLE ProductCategories ADD COLUMN ProductionStation TEXT NOT NULL DEFAULT 'KITCHEN'",
            "ALTER TABLE PosProducts ADD COLUMN ProductionStation TEXT NULL"
            ,"ALTER TABLE PosProducts ADD COLUMN InventoryMode TEXT NOT NULL DEFAULT 'NON_STOCK'"
            ,"ALTER TABLE StockItems ADD COLUMN QuantityOnHand TEXT NOT NULL DEFAULT '0'"
            ,"ALTER TABLE StockItems ADD COLUMN ReorderLevel TEXT NULL"
            ,"ALTER TABLE StockItems ADD COLUMN IsActive INTEGER NOT NULL DEFAULT 1"
            ,"ALTER TABLE StockItems ADD COLUMN UpdatedAt TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z'"
            ,"ALTER TABLE StockItems ADD COLUMN PosProductId TEXT NULL"
            ,"ALTER TABLE PosProductModifiers ADD COLUMN StockItemId TEXT NULL"
            ,"ALTER TABLE PosProductModifiers ADD COLUMN Quantity TEXT NOT NULL DEFAULT '1'"
            ,"ALTER TABLE PosProductModifiers ADD COLUMN UnitOfMeasure TEXT NULL"
            ,"ALTER TABLE PosOrderItemModifiers ADD COLUMN StockItemId TEXT NULL"
            ,"ALTER TABLE PosOrderItemModifiers ADD COLUMN Quantity TEXT NOT NULL DEFAULT '0'"
            ,"ALTER TABLE PosOrderItemModifiers ADD COLUMN UnitOfMeasure TEXT NULL"
            ,"ALTER TABLE RecipeIngredients ADD COLUMN RecipeVersionId TEXT NULL"
            ,"ALTER TABLE StockTransactions ADD COLUMN OperationId TEXT NULL"
            ,"ALTER TABLE StockTransactions ADD COLUMN UserId TEXT NULL"
            ,"ALTER TABLE StockTransactions ADD COLUMN Notes TEXT NULL"
        };
        foreach (var sql in columns)
        {
            try { await Database.ExecuteSqlRawAsync(sql); }
            catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 1 && ex.Message.Contains("duplicate column", StringComparison.OrdinalIgnoreCase)) { }
        }
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
        {
            string dbPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LodgeCoreOffline.db");
            var secureKey = SecureKeyStorage.GetOrGenerateDatabaseKey();
            var connectionString = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder
            {
                DataSource = dbPath,
                Mode = Microsoft.Data.Sqlite.SqliteOpenMode.ReadWriteCreate,
                Password = secureKey
            }.ToString();
            optionsBuilder.UseSqlite(connectionString);
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // GuestId is nullable — a reservation can arrive before its guest during
        // incremental sync without causing a FK violation.
        modelBuilder.Entity<LocalReservation>()
            .HasOne(r => r.Guest)
            .WithMany(g => g.Reservations)
            .HasForeignKey(r => r.GuestId)
            .IsRequired(false);

        modelBuilder.Entity<LocalReservation>()
            .HasOne(r => r.CorporateAccount)
            .WithMany()
            .HasForeignKey(r => r.CorporateAccountId)
            .IsRequired(false);

        modelBuilder.Entity<LocalReservationRoom>()
            .HasOne(rr => rr.Reservation)
            .WithMany(r => r.Rooms)
            .HasForeignKey(rr => rr.ReservationId);

        modelBuilder.Entity<LocalFolio>()
            .HasOne(f => f.Reservation)
            .WithOne(r => r.Folio)
            .HasForeignKey<LocalFolio>(f => f.ReservationId);

        modelBuilder.Entity<LocalLockCredential>()
            .HasOne(c => c.Reservation)
            .WithMany(r => r.LockCredentials)
            .HasForeignKey(c => c.ReservationId);
            
        modelBuilder.Entity<LocalLockOperation>()
            .HasOne(o => o.Reservation)
            .WithMany(r => r.LockOperations)
            .HasForeignKey(o => o.ReservationId);

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

        modelBuilder.Entity<LocalCityLedgerEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.AccountId);
            entity.HasIndex(e => e.PropertyId);
        });

        modelBuilder.Entity<LocalRatePlan>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.PropertyId);
        });

        modelBuilder.Entity<LocalRate>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.RatePlanId, e.RoomTypeId });
            entity.HasIndex(e => e.PropertyId);
        });

        modelBuilder.Entity<LocalPosProductionBatch>()
            .HasMany(b => b.Items)
            .WithOne()
            .HasForeignKey(i => i.BatchId);

        modelBuilder.Entity<LocalLaundryOrder>()
            .HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.LaundryOrderId);
            
        modelBuilder.Entity<LocalLaundryOrder>()
            .HasMany(o => o.StatusHistory)
            .WithOne()
            .HasForeignKey(h => h.LaundryOrderId);
    }
}
