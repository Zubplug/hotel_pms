import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../storage/secure_storage_provider.dart';

final webSocketServiceProvider = Provider<WebSocketService>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return WebSocketService(tokenStorage);
});

class WebSocketService {
  final TokenStorage _tokenStorage;
  WebSocketChannel? _channel;
  final String _wsUrl = 'ws://localhost:3000/api/v1/realtime'; // Adjust to actual WS URL

  WebSocketService(this._tokenStorage);

  Future<void> connect() async {
    final token = await _tokenStorage.getAccessToken();
    if (token == null) return;

    final uri = Uri.parse('$_wsUrl?token=$token');
    try {
      _channel = WebSocketChannel.connect(uri);
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
