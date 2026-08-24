using System.Linq;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalReservation
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string? GuestId { get; set; }
    public LocalGuest? Guest { get; set; }
    
    public string? CompanyId { get; set; }
    public string? Source { get; set; }
    public string? ChannelRef { get; set; }
    public string? RatePlanId { get; set; }
    public string? Currency { get; set; }
    
    public ICollection<LocalReservationRoom> Rooms { get; set; } = new List<LocalReservationRoom>();
    
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? RoomId 
    { 
        get => Rooms.FirstOrDefault()?.RoomId; 
        set {
            var room = Rooms.FirstOrDefault();
            if (room != null) room.RoomId = value ?? string.Empty;
            else Rooms.Add(new LocalReservationRoom { Id = Guid.NewGuid().ToString(), ReservationId = this.Id, RoomId = value ?? string.Empty });
        }
    }
    
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? RoomNumber 
    { 
        get => Rooms.FirstOrDefault()?.RoomNumber; 
        set {
            var room = Rooms.FirstOrDefault();
            if (room != null) room.RoomNumber = value;
            else Rooms.Add(new LocalReservationRoom { Id = Guid.NewGuid().ToString(), ReservationId = this.Id, RoomNumber = value });
        }
    }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? RoomTypeId 
    { 
        get => Rooms.FirstOrDefault()?.RoomTypeId; 
        set {
            var room = Rooms.FirstOrDefault();
            if (room != null) room.RoomTypeId = value ?? string.Empty;
            else Rooms.Add(new LocalReservationRoom { Id = Guid.NewGuid().ToString(), ReservationId = this.Id, RoomTypeId = value ?? string.Empty });
        }
    }

    public string? SpecialRequests { get; set; }
    public string? InternalNotes { get; set; }
    
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public bool EarlyCheckIn { get; set; }
    public bool LateCheckOut { get; set; }
    
    public int Adults { get; set; } = 1;
    public int Children { get; set; } = 0;
    
    public decimal? DepositRequired { get; set; }
    public decimal? DepositPaid { get; set; }
    
    public string? ConfirmationNumber { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, CHECKED_IN, CHECKED_OUT, CANCELLED
    
    public DateTime? CancelledAt { get; set; }
    public string? CancelledBy { get; set; }
    public string? CancellationReason { get; set; }
    
    public DateTime? NoShowAt { get; set; }
    public string? NoShowBy { get; set; }
    
    public LocalFolio? Folio { get; set; }
    
    public ICollection<LocalLockCredential> LockCredentials { get; set; } = new List<LocalLockCredential>();
    public ICollection<LocalLockOperation> LockOperations { get; set; } = new List<LocalLockOperation>();

    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // For sync conflict detection
    public int Version { get; set; } = 1;
    public int LocalSequence { get; set; } = 0;
    public bool IsDirty { get; set; } = false; // Needs to be synced
}
