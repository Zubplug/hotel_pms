import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/storage/secure_storage_provider.dart';
import '../../../../core/services/fcm_service.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthNotifier extends StateNotifier<AuthStatus> {
  final TokenStorage _tokenStorage;
  final Ref _ref;

  AuthNotifier(this._tokenStorage, this._ref) : super(AuthStatus.unknown) {
    _init();
  }

  Future<void> _init() async {
    final token = await _tokenStorage.getAccessToken();
    state = (token != null && token.isNotEmpty)
        ? AuthStatus.authenticated
        : AuthStatus.unauthenticated;
  }

  Future<void> login(String token) async {
    await _tokenStorage.saveTokens(accessToken: token, refreshToken: '');
    state = AuthStatus.authenticated;
  }

  Future<void> logout() async {
    // Remove the device registration while the access token is still valid.
    // Clearing tokens first makes the unregister request unauthorized, leaving
    // this device subscribed to the previous user's push notifications.
    await _ref.read(fcmServiceProvider).unregisterToken();
    await _tokenStorage.clearTokens();
    await _tokenStorage.clearUserCache();
    state = AuthStatus.unauthenticated;

    // Invalidate everything to clear in-memory state
    _ref.invalidate(authProvider);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthStatus>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return AuthNotifier(tokenStorage, ref);
});
