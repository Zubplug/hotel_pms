import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

class TokenStorage {
  final FlutterSecureStorage _storage;
  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _rememberedEmailKey = 'remembered_email';
  static const _biometricTokenKey = 'biometric_unlock_token';

  TokenStorage(this._storage);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  Future<String?> getAccessToken() async {
    return await _storage.read(key: _accessTokenKey);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _refreshTokenKey);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  Future<void> saveBiometricToken(String token) async {
    await _storage.write(key: _biometricTokenKey, value: token);
  }

  Future<String?> getBiometricToken() async {
    return _storage.read(key: _biometricTokenKey);
  }

  Future<void> clearBiometricToken() async {
    await _storage.delete(key: _biometricTokenKey);
  }

  Future<void> clearUserCache() async {
    for (final key in const [
      'manager_dashboard_cache',
      'auditor_dashboard_cache',
      'executive_finance_cache',
      'executive_rooms_cache',
    ]) {
      await _storage.delete(key: key);
    }
  }

  Future<void> saveRememberedEmail(String email) async {
    await _storage.write(key: _rememberedEmailKey, value: email);
  }

  Future<String?> getRememberedEmail() async {
    return await _storage.read(key: _rememberedEmailKey);
  }

  Future<void> clearRememberedEmail() async {
    await _storage.delete(key: _rememberedEmailKey);
  }
}

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return TokenStorage(storage);
});
