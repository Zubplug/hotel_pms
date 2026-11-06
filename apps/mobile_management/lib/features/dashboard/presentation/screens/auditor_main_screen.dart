import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auditor_dashboard_screen.dart';
import 'package:mobile_management/features/rooms/presentation/screens/rooms_screen.dart';
import 'package:mobile_management/features/finance/presentation/screens/finance_screen.dart';
import 'package:mobile_management/features/fnb/presentation/screens/fnb_screen.dart';
import 'package:mobile_management/features/hub/presentation/screens/hub_screen.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _navBg     = Color(0xFF060C17);
const _navBorder = Color(0xFF18304D);
const _navGold   = Color(0xFFD4A843);
const _navMuted  = Color(0xFF4D6480);

class AuditorMainScreen extends ConsumerStatefulWidget {
  const AuditorMainScreen({super.key});

  @override
  ConsumerState<AuditorMainScreen> createState() => _AuditorMainScreenState();
}

class _AuditorMainScreenState extends ConsumerState<AuditorMainScreen>
    with TickerProviderStateMixin {
  int _currentIndex = 0;
  late final List<AnimationController> _controllers;

  static const _screens = <Widget>[
    AuditorDashboardScreen(),
    RoomsScreen(),
    FinanceScreen(),
    FnbScreen(),
    HubScreen(),
  ];

  static const _items = [
    _NavItem(Icons.nightlight_outlined, Icons.nightlight_round,   'Audit'),
    _NavItem(Icons.king_bed_outlined,   Icons.king_bed_rounded,   'Rooms'),
    _NavItem(Icons.bar_chart_outlined,  Icons.bar_chart_rounded,  'Finance'),
    _NavItem(Icons.restaurant_outlined, Icons.restaurant_rounded, 'Ops'),
    _NavItem(Icons.apps_outlined,       Icons.apps_rounded,       'Controls'),
  ];

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      _items.length,
      (_) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 280),
      ),
    );
    _controllers[0].forward();
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  void _select(int index) {
    if (index == _currentIndex) return;
    HapticFeedback.selectionClick();
    _controllers[_currentIndex].reverse();
    setState(() => _currentIndex = index);
    _controllers[index].forward();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _navBg,
    body: IndexedStack(index: _currentIndex, children: _screens),
    bottomNavigationBar: _AuditNavBar(
      items: _items,
      currentIndex: _currentIndex,
      controllers: _controllers,
      onSelect: _select,
    ),
  );
}

// ─── Data Model ───────────────────────────────────────────────────────────────
class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _NavItem(this.icon, this.activeIcon, this.label);
}

// ─── Premium Nav Bar ──────────────────────────────────────────────────────────
class _AuditNavBar extends StatelessWidget {
  final List<_NavItem> items;
  final int currentIndex;
  final List<AnimationController> controllers;
  final ValueChanged<int> onSelect;

  const _AuditNavBar({
    required this.items,
    required this.currentIndex,
    required this.controllers,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Container(
      decoration: BoxDecoration(
        color: _navBg,
        border: const Border(top: BorderSide(color: _navBorder, width: 0.8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .45),
            blurRadius: 24,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        children: List.generate(
          items.length,
          (i) => _NavTile(
            item: items[i],
            controller: controllers[i],
            active: currentIndex == i,
            onTap: () => onSelect(i),
          ),
        ),
      ),
    ),
  );
}

// ─── Single Nav Tile ──────────────────────────────────────────────────────────
class _NavTile extends StatelessWidget {
  final _NavItem item;
  final AnimationController controller;
  final bool active;
  final VoidCallback onTap;

  const _NavTile({
    required this.item,
    required this.controller,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scale = Tween<double>(begin: 1.0, end: 1.07)
        .animate(CurvedAnimation(parent: controller, curve: Curves.easeOutBack));
    final bg = Tween<double>(begin: 0.0, end: 1.0)
        .animate(CurvedAnimation(parent: controller, curve: Curves.easeOut));

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedBuilder(
          animation: controller,
          builder: (_, __) => Transform.scale(
            scale: scale.value,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 7),
              decoration: BoxDecoration(
                color: _navGold.withValues(alpha: .085 * bg.value),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: active ? 18 : 0,
                  height: active ? 2.5 : 0,
                  margin: EdgeInsets.only(bottom: active ? 4 : 0),
                  decoration: BoxDecoration(
                    color: _navGold,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Icon(
                  active ? item.activeIcon : item.icon,
                  color: active ? _navGold : _navMuted,
                  size: 21,
                ),
                const SizedBox(height: 4),
                Text(
                  item.label,
                  style: TextStyle(
                    color: active ? _navGold : _navMuted,
                    fontSize: 9.5,
                    fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                    letterSpacing: active ? 0.3 : 0,
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
