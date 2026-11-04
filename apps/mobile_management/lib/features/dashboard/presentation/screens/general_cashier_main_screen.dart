import 'package:flutter/material.dart';

import '../../../approvals/presentation/screens/approvals_screen.dart';
import '../../../fnb/presentation/screens/fnb_screen.dart';
import '../../../finance/presentation/screens/finance_screen.dart';
import '../../../rooms/presentation/screens/rooms_screen.dart';
import 'general_cashier_dashboard_screen.dart';

class GeneralCashierMainScreen extends StatefulWidget {
  const GeneralCashierMainScreen({super.key});

  @override
  State<GeneralCashierMainScreen> createState() =>
      _GeneralCashierMainScreenState();
}

class _GeneralCashierMainScreenState extends State<GeneralCashierMainScreen> {
  int _currentIndex = 0;

  static const _background = Color(0xFF07111F);
  static const _gold = Color(0xFFD8AD52);
  static const _muted = Color(0xFF91A2BB);

  @override
  Widget build(BuildContext context) {
    const screens = <Widget>[
      GeneralCashierDashboardScreen(),
      RoomsScreen(),
      FinanceScreen(),
      FnbScreen(),
      ApprovalsScreen(),
    ];

    return Scaffold(
      backgroundColor: _background,
      body: screens[_currentIndex],
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          decoration: const BoxDecoration(
            color: _background,
            border: Border(top: BorderSide(color: Color(0xFF1C2C45))),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
          child: Row(
            children: [
              _navItem(
                0,
                Icons.account_balance_wallet_outlined,
                Icons.account_balance_wallet_rounded,
                'Cash',
              ),
              _navItem(
                1,
                Icons.king_bed_outlined,
                Icons.king_bed_rounded,
                'Rooms',
              ),
              _navItem(
                2,
                Icons.bar_chart_outlined,
                Icons.bar_chart_rounded,
                'Finance',
              ),
              _navItem(
                3,
                Icons.restaurant_outlined,
                Icons.restaurant_rounded,
                'Ops',
              ),
              _navItem(4, Icons.rule_outlined, Icons.rule_rounded, 'Controls'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(int index, IconData icon, IconData activeIcon, String label) {
    final active = _currentIndex == index;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => setState(() => _currentIndex = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: active ? _gold.withValues(alpha: .1) : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                active ? activeIcon : icon,
                color: active ? _gold : _muted,
                size: 21,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: active ? _gold : _muted,
                  fontSize: 10,
                  fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
