import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auditor_dashboard_screen.dart';
import 'package:mobile_management/features/hub/presentation/screens/night_audit_review_screen.dart';
import 'package:mobile_management/features/hub/providers/hub_provider.dart';
import 'package:mobile_management/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:mobile_management/features/profile/presentation/screens/profile_screen.dart';
import 'package:mobile_management/features/profile/presentation/providers/profile_provider.dart';

class AuditorMainScreen extends ConsumerStatefulWidget {
  const AuditorMainScreen({super.key});

  @override
  ConsumerState<AuditorMainScreen> createState() => _AuditorMainScreenState();
}

class _AuditorMainScreenState extends ConsumerState<AuditorMainScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const goldAccent = Color(0xFFD4AF37);
    const textSecondary = Color(0xFF94A3B8);

    final List<Widget> screens = [
      const AuditorDashboardScreen(),
      const _AuditorReviewTab(),
      const NotificationsScreen(),
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
          selectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 11,
          ),
          unselectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w500,
            fontSize: 11,
          ),
          elevation: 16,
          items: const [
            BottomNavigationBarItem(
              icon: Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Icon(Icons.home_outlined),
              ),
              activeIcon: Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Icon(Icons.home_rounded),
              ),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Icon(Icons.fact_check_outlined),
              ),
              activeIcon: Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Icon(Icons.fact_check_rounded),
              ),
              label: 'Review',
            ),
            BottomNavigationBarItem(
              icon: Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Icon(Icons.notifications_none_rounded),
              ),
              activeIcon: Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Icon(Icons.notifications_rounded),
              ),
              label: 'Alerts',
            ),
            BottomNavigationBarItem(
              icon: Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Icon(Icons.person_outline),
              ),
              activeIcon: Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Icon(Icons.person_rounded),
              ),
              label: 'You',
            ),
          ],
        ),
      ),
    );
  }
}

class _AuditorReviewTab extends ConsumerWidget {
  const _AuditorReviewTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final propertyId = ref.watch(effectivePropertyIdProvider);
    final selectedPropertyId = ref.watch(selectedHubPropertyProvider);
    final propertyName = ref
        .watch(profileProvider)
        .maybeWhen(
          data: (profile) {
            final properties = profile.authorization.properties;
            if (properties.isEmpty) return 'LodgeCore Property';
            for (final property in properties) {
              if (property.id == selectedPropertyId) return property.name;
            }
            return properties.first.name;
          },
          orElse: () => 'LodgeCore Property',
        );
    return NightAuditReviewScreen(
      propertyId: propertyId,
      propertyName: propertyName,
    );
  }
}
