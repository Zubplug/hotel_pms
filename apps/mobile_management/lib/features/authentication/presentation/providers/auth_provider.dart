import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../../core/storage/secure_storage_provider.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthNotifier extends StateNotifier<AuthStatus> {
  final TokenStorage _tokenStorage;
  final FlutterSecureStorage _secureStorage;
  final Ref _ref;

  AuthNotifier(this._tokenStorage, this._secureStorage, this._ref) : super(AuthStatus.unknown) {
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
    await _tokenStorage.clearTokens();
    await _secureStorage.deleteAll(); // Clear all sensitive cached data
    state = AuthStatus.unauthenticated;
    
    // Invalidate everything to clear in-memory state
    _ref.invalidate(authProvider);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthStatus>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final secureStorage = ref.watch(secureStorageProvider);
  return AuthNotifier(tokenStorage, secureStorage, ref);
});
