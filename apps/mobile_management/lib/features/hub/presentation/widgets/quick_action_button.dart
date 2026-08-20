import 'package:flutter/material.dart';
import '../../data/hub_model.dart';

const _cardBg = Color(0xFF111D33);
const _textPrimary = Color(0xFFEEF2FF);

class QuickActionButton extends StatelessWidget {
  final HubQuickAction action;

  const QuickActionButton({super.key, required this.action});

  IconData _getIcon() {
    switch (action.icon) {
      case 'check_circle': return Icons.check_circle_outline;
      case 'warning': return Icons.warning_amber_rounded;
      case 'campaign': return Icons.campaign_rounded;
      case 'analytics': return Icons.analytics_outlined;
      default: return Icons.widgets_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {},
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: _cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF1E3355)),
        ),
        child: Row(
          children: [
            Icon(_getIcon(), color: _textPrimary, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                action.label,
                style: const TextStyle(color: _textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
