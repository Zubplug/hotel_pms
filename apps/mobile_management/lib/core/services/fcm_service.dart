import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';

/// Handles FCM token registration and foreground message display.
class FcmService {
  final Ref _ref;
  FcmService(this._ref);

  Future<void> initialize() async {
    try {
      // 1. Request notification permission
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        return; // User denied — silently skip
      }

      // 2. Get FCM token and register with backend
      final token = await messaging.getToken();
      if (token != null) {
        await _registerToken(token);
      }

      // 3. Listen for token refresh
      messaging.onTokenRefresh.listen(_registerToken);

      // 4. Foreground messages — WebSocket handles live updates; FCM is the wakeup
      FirebaseMessaging.onMessage.listen((_) {});
    } catch (e) {
      debugPrint('[FcmService] Not available: $e');
    }
  }

  Future<void> _registerToken(String token) async {
    try {
      final platform = Platform.isIOS ? 'ios' : 'android';
      final dio = _ref.read(dioProvider);
      await dio.post('/manager/fcm/register', data: {
        'token': token,
        'platform': platform,
      });
    } catch (_) {
      // Non-fatal — the app works without push; WebSocket handles real-time
    }
  }

  Future<void> unregisterToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      final dio = _ref.read(dioProvider);
      await dio.delete('/manager/fcm/register', data: {'token': token});
    } catch (_) {}
  }
}

final fcmServiceProvider = Provider<FcmService>((ref) {
  return FcmService(ref);
});
