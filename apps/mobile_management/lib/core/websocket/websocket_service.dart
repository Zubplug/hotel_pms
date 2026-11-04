import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/app_config.dart';
import '../storage/secure_storage_provider.dart';

final webSocketServiceProvider = Provider<WebSocketService>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return WebSocketService(tokenStorage);
});

class WebSocketService {
  final TokenStorage _tokenStorage;
  WebSocketChannel? _channel;

  WebSocketService(this._tokenStorage);

  Future<void> connect() async {
    final token = await _tokenStorage.getAccessToken();
    if (token == null) return;

    final configuredUri = Uri.parse(AppConfig.wsUrl);
    final scheme = configuredUri.scheme == 'https'
        ? 'wss'
        : configuredUri.scheme == 'http'
        ? 'ws'
        : configuredUri.scheme;
    final uri = configuredUri.replace(
      scheme: scheme,
      port: configuredUri.port == 0 ? null : configuredUri.port,
      queryParameters: {...configuredUri.queryParameters, 'token': token},
    );
    try {
      _channel = WebSocketChannel.connect(uri);
      await _channel!.ready;
      _channel!.stream.listen(
        (message) {
          _handleMessage(message);
        },
        onDone: () {
          debugPrint('WebSocket connection closed.');
          // Implement reconnect logic
        },
        onError: (error) {
          debugPrint('WebSocket Error: $error');
        },
      );
    } catch (e) {
      debugPrint('Failed to connect to WebSocket: $e');
    }
  }

  void _handleMessage(dynamic message) {
    try {
      final decoded = jsonDecode(message as String);
      // Process incoming state updates
      // e.g. "occupancy_changed", "new_approval_request", etc.
      debugPrint('Received WS Message: $decoded');
    } catch (e) {
      debugPrint('Failed to decode WS message: $e');
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
  }
}
