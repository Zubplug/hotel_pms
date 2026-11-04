import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/storage/secure_storage_provider.dart';
import '../../../../core/services/fcm_service.dart';
import '../../../dashboard/presentation/providers/auditor_dashboard_provider.dart';
import '../../../dashboard/presentation/providers/dashboard_provider.dart';
import '../../../profile/presentation/providers/profile_provider.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthNotifier extends StateNotifier<AuthStatus> {
  final TokenStorage _tokenStorage;
  final Ref _ref;
  bool _hasSeenWelcome = false;

  AuthNotifier(this._tokenStorage, this._ref) : super(AuthStatus.unknown) {
    _init();
  }

  Future<void> _init() async {
    final preferences = await SharedPreferences.getInstance();
    _hasSeenWelcome = preferences.getBool(_welcomeShownKey) ?? false;
    final token = await _tokenStorage.getAccessToken();
    state = (token != null && token.isNotEmpty)
        ? AuthStatus.authenticated
        : AuthStatus.unauthenticated;
  }

  bool get hasSeenWelcome => _hasSeenWelcome;

  Future<void> markWelcomeShown() async {
    _hasSeenWelcome = true;
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool(_welcomeShownKey, true);
  }

  Future<void> login(String token) async {
    await _tokenStorage.saveTokens(accessToken: token, refreshToken: '');
    _invalidateSessionProviders();
    state = AuthStatus.authenticated;
  }

  Future<void> logout() async {
    // Remove the device registration while the access token is still valid.
    // Clearing tokens first makes the unregister request unauthorized, leaving
    // this device subscribed to the previous user's push notifications.
    await _ref.read(fcmServiceProvider).unregisterToken();

    // Move the router to the signed-out branch before invalidating any
    // session-backed providers. Otherwise their listeners can refetch while
    // the token is already being removed, resulting in expected-but-noisy
    // 401 responses during logout.
    state = AuthStatus.unauthenticated;
    await _tokenStorage.clearTokens();
    await _tokenStorage.clearUserCache();
    _invalidateSessionProviders();
  }

  void _invalidateSessionProviders() {
    // Profile data controls the role-specific dashboard. Clear it on both
    // sides of a session transition so the next account cannot inherit the
    // previous account's role or dashboard state.
    _ref.invalidate(profileProvider);
    _ref.invalidate(dashboardDataProvider);
    _ref.invalidate(auditorDashboardDataProvider);
  }
}

const _welcomeShownKey = 'welcome_screen_shown';

final authProvider = StateNotifierProvider<AuthNotifier, AuthStatus>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return AuthNotifier(tokenStorage, ref);
});
