/// Returns the guest-facing room number from a hierarchical room identifier.
///
/// PMS room identifiers may be stored as values such as `1.1.122`, while the
/// operational room label should show only `122`.
String formatRoomNumber(dynamic value, {String fallback = 'Unassigned'}) {
  final text = value?.toString().trim() ?? '';
  if (text.isEmpty) return fallback;
  final segments = text.split('.');
  return segments.last.trim().isEmpty ? fallback : segments.last.trim();
}
