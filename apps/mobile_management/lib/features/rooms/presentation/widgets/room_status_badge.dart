import 'package:flutter/material.dart';

class RoomStatusBadge extends StatelessWidget {
  final String status;
  final bool isIndicator;

  const RoomStatusBadge({
    super.key,
    required this.status,
    this.isIndicator = false,
  });

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color textColor;
    String text = status;

    if (isIndicator) {
      switch (status) {
        case 'MAINTENANCE':
          bgColor = Colors.red.withOpacity(0.15);
          textColor = Colors.redAccent;
          text = '🔧 MAINT';
          break;
        case 'HOUSEKEEPING':
          bgColor = Colors.orange.withOpacity(0.15);
          textColor = Colors.orange;
          text = '🧹 HK';
          break;
        case 'VIP':
          bgColor = Colors.purple.withOpacity(0.15);
          textColor = Colors.purpleAccent;
          text = '⭐ VIP';
          break;
        case 'ATTENTION':
          bgColor = Colors.amber.withOpacity(0.15);
          textColor = Colors.amber;
          text = '⚠️ ATTN';
          break;
        default:
          bgColor = Colors.grey.withOpacity(0.15);
          textColor = Colors.grey;
      }
    } else {
      switch (status) {
        case 'OCCUPIED':
          bgColor = Colors.blue.withOpacity(0.15);
          textColor = Colors.blueAccent;
          break;
        case 'READY':
        case 'VACANT':
          bgColor = Colors.green.withOpacity(0.15);
          textColor = Colors.greenAccent;
          break;
        case 'DIRTY':
          bgColor = Colors.orange.withOpacity(0.15);
          textColor = Colors.orangeAccent;
          break;
        case 'OUT_OF_ORDER':
        case 'OOO':
          bgColor = Colors.red.withOpacity(0.15);
          textColor = Colors.redAccent;
          text = 'OOO';
          break;
        case 'OUT_OF_SERVICE':
        case 'OOS':
          bgColor = Colors.red.withOpacity(0.1);
          textColor = Colors.redAccent;
          text = 'OOS';
          break;
        default:
          bgColor = Colors.grey.withOpacity(0.15);
          textColor = Colors.grey;
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: textColor,
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
