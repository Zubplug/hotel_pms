import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/hub_provider.dart';
import '../../data/hub_model.dart';

const _surfaceNavy = Color(0xFF1E293B);
const _textPrimary = Color(0xFFEEF2FF);
const _textSecondary = Color(0xFF94A3B8);
const _goldLight = Color(0xFFD4A853);

class PropertyFilterDropdown extends ConsumerWidget {
  const PropertyFilterDropdown({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hubState = ref.watch(hubDataProvider);

    final availableProperties = hubState.maybeWhen(
      data: (data) => data.scope.availableProperties,
      orElse: () => <HubProperty>[],
    );

    final providerSelected = ref.watch(selectedHubPropertyProvider);
    final String activeProperty = hubState.maybeWhen(
      data: (data) => data.scope.property,
      orElse: () => providerSelected == 'AUTO_SELECT_FIRST' || providerSelected == null ? 'ALL_AUTHORIZED' : providerSelected,
    );

    String displayText = 'All Properties';
    if (activeProperty.isNotEmpty && activeProperty != 'ALL_AUTHORIZED') {
      final match = availableProperties.where((p) => p.id == activeProperty).firstOrNull;
      if (match != null) {
        displayText = match.name;
      } else {
        displayText = 'Unknown Property';
      }
    }

    return GestureDetector(
      onTap: () => _showPropertySelector(context, ref, availableProperties, activeProperty),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 156),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: _surfaceNavy,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: const Color(0xFF2B4267)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x22000000),
              blurRadius: 10,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.business_rounded, color: _goldLight, size: 16),
            const SizedBox(width: 7),
            SizedBox(
              width: 90,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'PROPERTY SCOPE',
                    style: TextStyle(
                      color: _textSecondary,
                      fontSize: 7,
                      fontWeight: FontWeight.w800,
                      letterSpacing: .8,
                    ),
                  ),
                  Text(
                    displayText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _textPrimary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.expand_more_rounded, color: _textSecondary, size: 16),
          ],
        ),
      ),
    );
  }

  void _showPropertySelector(BuildContext context, WidgetRef ref, List<HubProperty> availableProperties, String selectedProperty) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.only(bottom: 24, top: 12),
          decoration: const BoxDecoration(
            color: Color(0xFF070D1A), // _bgDeep
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: Color(0xFF1E3355))),
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E3355),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Select Property Scope',
                      style: TextStyle(
                        color: _textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _buildOption(
                  context: context,
                  ref: ref,
                  value: 'ALL_AUTHORIZED',
                  label: 'All Properties',
                  icon: Icons.dashboard_rounded,
                  isSelected: selectedProperty == 'ALL_AUTHORIZED',
                ),
                if (availableProperties.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
                    child: Divider(color: const Color(0xFF1E3355).withValues(alpha: 0.5)),
                  ),
                  Flexible(
                    child: ListView.builder(
                      shrinkWrap: true,
                      physics: const BouncingScrollPhysics(),
                      itemCount: availableProperties.length,
                      itemBuilder: (context, index) {
                        final prop = availableProperties[index];
                        return _buildOption(
                          context: context,
                          ref: ref,
                          value: prop.id,
                          label: prop.name,
                          icon: Icons.business_rounded,
                          isSelected: selectedProperty == prop.id,
                        );
                      },
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildOption({
    required BuildContext context,
    required WidgetRef ref,
    required String value,
    required String label,
    required IconData icon,
    required bool isSelected,
  }) {
    return InkWell(
      onTap: () {
        ref.read(selectedHubPropertyProvider.notifier).state = value;
        Navigator.pop(context);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        color: isSelected ? _surfaceNavy.withValues(alpha: 0.3) : Colors.transparent,
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isSelected ? _goldLight.withValues(alpha: 0.15) : _surfaceNavy,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: isSelected ? _goldLight : _textSecondary, size: 22),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: isSelected ? _goldLight : _textPrimary,
                  fontSize: 16,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: _goldLight, size: 24),
          ],
        ),
      ),
    );
  }
}
