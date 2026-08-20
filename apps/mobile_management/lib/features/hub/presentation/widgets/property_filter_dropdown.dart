import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/hub_provider.dart';

const _surfaceNavy = Color(0xFF1E293B);
const _textPrimary = Color(0xFFEEF2FF);

class PropertyFilterDropdown extends ConsumerWidget {
  const PropertyFilterDropdown({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedProperty = ref.watch(selectedHubPropertyProvider);
    // Ideally we would fetch the list of properties from the user's profile state
    // For now, we mock the basic unified selection.

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: _surfaceNavy,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF1E3355)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(
            selectedProperty == 'ALL_AUTHORIZED' ? 'All Properties' : 'Property \$selectedProperty',
            style: const TextStyle(color: _textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
          ),
          const SizedBox(width: 4),
          const Icon(Icons.keyboard_arrow_down, color: _textPrimary, size: 16),
        ],
      ),
    );
  }
}
