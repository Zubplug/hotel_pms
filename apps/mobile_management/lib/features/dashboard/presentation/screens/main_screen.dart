import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dashboard_screen.dart';
import 'auditor_main_screen.dart';
import 'package:mobile_management/features/rooms/presentation/screens/rooms_screen.dart';
import 'package:mobile_management/features/finance/presentation/screens/finance_screen.dart';
import 'package:mobile_management/features/profile/presentation/screens/profile_screen.dart';
import 'package:mobile_management/features/profile/presentation/providers/profile_provider.dart';
import 'package:mobile_management/features/hub/presentation/screens/hub_screen.dart';
import '../providers/dashboard_provider.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _bgDeep = Color(0xFF070D1A);
const _gold = Color(0xFFD4AF37);
const _textMuted = Color(0xFF94A3B8);

class MainScreen extends ConsumerStatefulWidget {
  const MainScreen({super.key});

  @override
  ConsumerState<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends ConsumerState<MainScreen> {
  int _currentIndex = 0;

  /// Called by DashboardScreen (via ancestor lookup) to switch tabs from alert action chips.
  void switchTab(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final profileState = ref.watch(profileProvider);

    return profileState.when(
      loading: () => const Scaffold(
        backgroundColor: _bgDeep,
        body: Center(
          child: CircularProgressIndicator(color: _gold),
        ),
      ),
      error: (err, _) => const Scaffold(
        backgroundColor: _bgDeep,
        body: Center(
          child: Icon(Icons.error_outline, color: _textMuted, size: 48),
        ),
      ),
      data: (profile) {
        final String userRole = profile.authorization.role.toUpperCase();

        if (userRole == 'NIGHT_AUDITOR') {
          return const AuditorMainScreen();
        }

        // Director / Manager dashboard tabs
        final List<Widget> screens = [
          const DashboardScreen(),
          const RoomsScreen(),
          const FinanceScreen(),
          const HubScreen(),
          const ProfileScreen(),
        ];

        return Scaffold(
          backgroundColor: _bgDeep,
          body: screens[_currentIndex],
          bottomNavigationBar: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Gold gradient top accent line on nav bar
              Container(
                height: 1,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      Color(0xFF2A3A50),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
              _PremiumNavBar(
                currentIndex: _currentIndex,
                onTap: (i) => setState(() => _currentIndex = i),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Premium navigation bar with active pill indicator and badge support.
class _PremiumNavBar extends ConsumerWidget {
  final int currentIndex;
  final void Function(int) onTap;

  const _PremiumNavBar({required this.currentIndex, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Count pending approvals from dashboard alerts for Hub badge
    int hubPending = 0;
    try {
      final dashState = ref.watch(dashboardDataProvider);
      dashState.whenData((data) {
        hubPending = data.requiresAttention
            .where((a) => a.action == 'VIEW_APPROVALS')
            .fold(0, (sum, a) => sum + a.affectedCount);
      });
    } catch (_) {}

    final items = [
      _NavItem(icon: Icons.home_outlined, activeIcon: Icons.home_rounded, label: 'Home', badge: 0),
      _NavItem(icon: Icons.king_bed_outlined, activeIcon: Icons.king_bed_rounded, label: 'Rooms', badge: 0),
      _NavItem(icon: Icons.account_balance_wallet_outlined, activeIcon: Icons.account_balance_wallet_rounded, label: 'Finance', badge: 0),
      _NavItem(icon: Icons.apps_outlined, activeIcon: Icons.apps_rounded, label: 'Hub', badge: hubPending),
      _NavItem(icon: Icons.person_outline, activeIcon: Icons.person_rounded, label: 'You', badge: 0),
    ];

    return Container(
      color: _bgDeep,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            children: items.asMap().entries.map((e) {
              final idx = e.key;
              final item = e.value;
              final isActive = currentIndex == idx;
              return Expanded(
                child: GestureDetector(
                  onTap: () => onTap(idx),
                  behavior: HitTestBehavior.opaque,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOutCubic,
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                    decoration: BoxDecoration(
                      color: isActive ? _gold.withValues(alpha: 0.08) : Colors.transparent,
                      borderRadius: BorderRadius.circular(14),
                      border: isActive
                          ? Border.all(color: _gold.withValues(alpha: 0.15), width: 1)
                          : null,
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isActive ? item.activeIcon : item.icon,
                              color: isActive ? _gold : _textMuted,
                              size: 22,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.label,
                              style: TextStyle(
                                color: isActive ? _gold : _textMuted,
                                fontSize: 10,
                                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        // Badge
                        if (item.badge > 0)
                          Positioned(
                            top: 0,
                            right: 4,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF43F5E),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: _bgDeep, width: 1.5),
                              ),
                              child: Text(
                                item.badge > 99 ? '99+' : item.badge.toString(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 8,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int badge;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.badge,
  });
}
