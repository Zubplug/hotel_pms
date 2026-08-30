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
    public string? RatePlanSnapshotJson { get; set; }
    public string? Currency { get; set; }
    
    public ICollection<LocalReservationRoom> Rooms { get; set; } = new List<LocalReservationRoom>();
    
    private string? _tempRoomId;
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? RoomId 
    { 
        get => _tempRoomId ?? Rooms.FirstOrDefault()?.RoomId; 
        set {
            _tempRoomId = value;
            var room = Rooms.FirstOrDefault();
            if (room != null) room.RoomId = value ?? string.Empty;
            else Rooms.Add(new LocalReservationRoom { Id = Guid.NewGuid().ToString(), ReservationId = this.Id, RoomId = value ?? string.Empty });
        }
    }
    
    private string? _tempRoomNumber;
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? RoomNumber 
    { 
        get => _tempRoomNumber ?? Rooms.FirstOrDefault()?.Room?.Number; 
        set => _tempRoomNumber = value;
    }

    private string? _tempRoomTypeId;
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? RoomTypeId 
    { 
        get => _tempRoomTypeId ?? Rooms.FirstOrDefault()?.RoomTypeId; 
        set {
            _tempRoomTypeId = value;
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
    public bool LateArrivalExpected { get; set; }
    public string? LateArrivalNotes { get; set; }
    public DateTime? LateArrivalAt { get; set; }
    public string? LateArrivalBy { get; set; }
    public DateTime? NoShowAssessedAt { get; set; }
    public decimal? NoShowChargeAmount { get; set; }
    public decimal? NoShowRefundableAmount { get; set; }
    public DateTime? ReinstatedAt { get; set; }
    public string? ReinstatedBy { get; set; }
    public string? ReinstatementReason { get; set; }
    
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
