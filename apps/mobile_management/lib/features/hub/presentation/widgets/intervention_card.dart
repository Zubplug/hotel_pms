import 'package:flutter/material.dart';
import '../../data/hub_model.dart';

const _cardBg = Color(0xFF111D33);
const _textPrimary = Color(0xFFEEF2FF);
const _textSecondary = Color(0xFF94A3B8);
const _red = Color(0xFFEF4444);
const _orange = Color(0xFFF97316);

class InterventionCard extends StatelessWidget {
  final HubIntervention intervention;

  const InterventionCard({super.key, required this.intervention});

  Color _getPriorityColor() {
    return intervention.priority == 'Critical' ? _red : _orange;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E3355)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 2, right: 12),
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: _getPriorityColor(),
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        intervention.title,
                        style: const TextStyle(color: _textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        intervention.message,
                        style: const TextStyle(color: _textSecondary, fontSize: 13, height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
