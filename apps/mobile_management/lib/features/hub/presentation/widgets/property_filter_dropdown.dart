import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/hub_provider.dart';
import '../../data/hub_model.dart';

const _surfaceNavy = Color(0xFF1E293B);
const _textPrimary = Color(0xFFEEF2FF);
const _textSecondary = Color(0xFF94A3B8);
const _goldLight = Color(0xFFD4A853);
const _cardBg = Color(0xFF111D33);

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
      color: _cardBg,
      elevation: 8,
      offset: const Offset(0, 44),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF1E3355)),
      ),
      itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
        const PopupMenuItem<String>(
          value: 'ALL_AUTHORIZED',
          child: Row(
            children: [
              Icon(Icons.dashboard_rounded, color: _textSecondary, size: 20),
              SizedBox(width: 12),
              Text('All Properties', style: TextStyle(color: _textPrimary, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
        if (availableProperties.isNotEmpty)
          const PopupMenuDivider(height: 16),
        ...availableProperties.map((prop) => PopupMenuItem<String>(
              value: prop.id,
              child: Row(
                children: [
                  const Icon(Icons.business_rounded, color: _goldLight, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      prop.name,
                      style: const TextStyle(color: _textPrimary, fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (selectedProperty == prop.id)
                    const Icon(Icons.check_circle_rounded, color: _goldLight, size: 18),
                ],
              ),
            )),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: _surfaceNavy.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFF1E3355), width: 1.5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: Color(0xFF22C55E),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: Color(0x4022C55E), blurRadius: 4, spreadRadius: 1)
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              displayText,
              style: const TextStyle(
                color: _textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.keyboard_arrow_down_rounded, color: _textSecondary, size: 18),
          ],
        ),
      ),
    );
  }
}
