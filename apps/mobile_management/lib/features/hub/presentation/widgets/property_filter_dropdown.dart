import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/hub_provider.dart';
import '../../data/hub_model.dart';

const _surfaceNavy = Color(0xFF1E293B);
const _textPrimary = Color(0xFFEEF2FF);

class PropertyFilterDropdown extends ConsumerWidget {
  const PropertyFilterDropdown({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedProperty = ref.watch(selectedHubPropertyProvider);
    final hubState = ref.watch(hubDataProvider);

    final availableProperties = hubState.maybeWhen(
      data: (data) => data.scope.availableProperties,
      orElse: () => <HubProperty>[],
    );

    String displayText = 'All Properties';
    if (selectedProperty != 'ALL_AUTHORIZED') {
      final match = availableProperties.where((p) => p.id == selectedProperty).firstOrNull;
      if (match != null) {
        displayText = match.name;
      } else {
        displayText = 'Property ${selectedProperty.substring(0, 4)}...';
      }
    }

    return PopupMenuButton<String>(
      onSelected: (String result) {
        ref.read(selectedHubPropertyProvider.notifier).state = result;
      },
      color: _surfaceNavy,
      offset: const Offset(0, 40),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
        const PopupMenuItem<String>(
          value: 'ALL_AUTHORIZED',
          child: Text('All Properties', style: TextStyle(color: _textPrimary)),
        ),
        if (availableProperties.isNotEmpty)
          const PopupMenuDivider(),
        ...availableProperties.map((prop) => PopupMenuItem<String>(
              value: prop.id,
              child: Text(prop.name, style: const TextStyle(color: _textPrimary)),
            )),
      ],
      child: Container(
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
              displayText,
              style: const TextStyle(color: _textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.keyboard_arrow_down, color: _textPrimary, size: 16),
          ],
        ),
      ),
    );
  }
}
