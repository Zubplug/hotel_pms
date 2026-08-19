import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/storage/secure_storage_provider.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthNotifier extends StateNotifier<AuthStatus> {
  final TokenStorage _tokenStorage;

  AuthNotifier(this._tokenStorage) : super(AuthStatus.unknown) {
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
    state = AuthStatus.unauthenticated;
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthStatus>((ref) {
  final storage = ref.watch(tokenStorageProvider);
  return AuthNotifier(storage);
});
