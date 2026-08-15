export function formatRoomNumber(roomNumber: string | undefined | null): string {
  if (!roomNumber) return '';
  // The hardware requires formats like "1.2.211" for Building.Floor.Room encoding.
  // This utility extracts just the room part ("211") for UI display.
  return roomNumber.split('.').pop() || roomNumber;
}
