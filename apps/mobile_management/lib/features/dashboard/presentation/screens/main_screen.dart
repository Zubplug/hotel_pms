import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dashboard_screen.dart';
import 'auditor_main_screen.dart';
import 'package:mobile_management/features/rooms/presentation/screens/rooms_screen.dart';
import 'package:mobile_management/features/finance/presentation/screens/finance_screen.dart';
import 'package:mobile_management/features/profile/presentation/screens/profile_screen.dart';
import 'package:mobile_management/features/profile/presentation/providers/profile_provider.dart';
import 'package:mobile_management/features/fnb/presentation/screens/fnb_screen.dart';



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
          const FnbScreen(),
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
                onTap: (i) {
                  if (i == 4) {
                    _showComingSoonPopup(context);
                  } else {
                    setState(() => _currentIndex = i);
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showComingSoonPopup(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _bgDeep,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: _gold.withValues(alpha: 0.3), width: 1.5),
        ),
        contentPadding: const EdgeInsets.all(32),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _gold.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.rocket_launch_rounded, color: _gold, size: 48),
            ),
            const SizedBox(height: 24),
            const Text(
              'COMING SOON',
              style: TextStyle(
                color: _gold,
                fontSize: 16,
                fontWeight: FontWeight.w800,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'The Management Hub is currently under development. Stay tuned for advanced alerts and approvals.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: _textMuted,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _gold,
                  foregroundColor: _bgDeep,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Got it',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
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
    final items = [
      _NavItem(icon: Icons.home_outlined, activeIcon: Icons.home_rounded, label: 'Home', badge: 0),
      _NavItem(icon: Icons.king_bed_outlined, activeIcon: Icons.king_bed_rounded, label: 'Rooms', badge: 0),
      _NavItem(icon: Icons.account_balance_wallet_outlined, activeIcon: Icons.account_balance_wallet_rounded, label: 'Finance', badge: 0),
      _NavItem(icon: Icons.restaurant_outlined, activeIcon: Icons.restaurant_rounded, label: 'F&B', badge: 0),
      _NavItem(icon: Icons.apps_rounded, activeIcon: Icons.apps_rounded, label: 'Hub', badge: 0),
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
