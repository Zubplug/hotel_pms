namespace LodgeCore.Desktop.Data.Entities;

/// <summary>
/// A patch DTO carrying all fields that may be edited on an existing reservation.
/// Mirrors the fields accepted by the web PATCH /api/v1/reservations/[id] endpoint.
/// Null values are treated as "no change".
/// </summary>
public class LocalReservationPatch
{
    public string?   GuestId         { get; set; }
    public DateTime? CheckIn         { get; set; }
    public DateTime? CheckOut        { get; set; }
    public string?   RoomId          { get; set; }
    public string?   RoomTypeId      { get; set; }
    public int?      Adults          { get; set; }
    public int?      Children        { get; set; }
    public string?   SpecialRequests { get; set; }
}
