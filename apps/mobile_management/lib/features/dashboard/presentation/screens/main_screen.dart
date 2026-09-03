import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dashboard_screen.dart';
import 'auditor_dashboard_screen.dart';
import 'package:mobile_management/features/rooms/presentation/screens/rooms_screen.dart';
import 'package:mobile_management/features/finance/presentation/screens/finance_screen.dart';
import 'package:mobile_management/features/profile/presentation/screens/profile_screen.dart';
import 'package:mobile_management/features/profile/presentation/providers/profile_provider.dart';
import 'package:mobile_management/features/hub/presentation/screens/hub_screen.dart';

class MainScreen extends ConsumerStatefulWidget {
  const MainScreen({super.key});

  @override
  ConsumerState<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends ConsumerState<MainScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const goldAccent = Color(0xFFD4AF37);
    const textSecondary = Color(0xFF94A3B8);

    final profileState = ref.watch(profileProvider);
    final String userRole = profileState.value?.authorization.role.toUpperCase() ?? '';

    final Widget homeDashboard = (userRole == 'NIGHT_AUDITOR')
        ? const AuditorDashboardScreen()
        : const DashboardScreen();

    final List<Widget> screens = [
      homeDashboard,
      const RoomsScreen(),
      const FinanceScreen(),
      const HubScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: primaryNavy,
      body: screens[_currentIndex],
      bottomNavigationBar: Theme(
        data: Theme.of(context).copyWith(
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          backgroundColor: primaryNavy,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: goldAccent,
          unselectedItemColor: textSecondary,
          showSelectedLabels: true,
          showUnselectedLabels: true,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
          elevation: 16,
          items: const [
            BottomNavigationBarItem(
              icon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.home_outlined)),
              activeIcon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.home_rounded)),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.king_bed_outlined)),
              activeIcon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.king_bed_rounded)),
              label: 'Rooms',
            ),
            BottomNavigationBarItem(
              icon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.account_balance_wallet_outlined)),
              activeIcon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.account_balance_wallet_rounded)),
              label: 'Finance',
            ),
            BottomNavigationBarItem(
              icon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.apps_outlined)),
              activeIcon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.apps_rounded)),
              label: 'Hub',
            ),
            BottomNavigationBarItem(
              icon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.person_outline)),
              activeIcon: Padding(padding: EdgeInsets.only(bottom: 4), child: Icon(Icons.person_rounded)),
              label: 'You',
            ),
          ],
        ),
      ),
    );
  }
}
