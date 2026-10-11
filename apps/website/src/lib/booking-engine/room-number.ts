/** Return the guest-facing room number from a hierarchical PMS room code. */
export function displayRoomNumber(roomNumber: string | null | undefined): string | null {
  if (!roomNumber) return null;
  const value = String(roomNumber).trim();
  if (!value) return null;
  return value.split('.').pop()?.trim() || value;
}
