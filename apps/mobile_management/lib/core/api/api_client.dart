import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage_provider.dart';
import '../config/app_config.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ),
  );

  final tokenStorage = ref.watch(tokenStorageProvider);

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final accessToken = await tokenStorage.getAccessToken();
        if (accessToken != null && accessToken.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $accessToken';
        }
        if (kDebugMode) {
          debugPrint('[LodgeCore API] ${options.method} ${options.uri}');
        }
        return handler.next(options);
      },
      onResponse: (response, handler) {
        if (kDebugMode) {
          debugPrint(
            '[LodgeCore API] ${response.statusCode} ${response.requestOptions.uri}',
          );
        }
        return handler.next(response);
      },
      onError: (DioException e, handler) async {
        if (kDebugMode) {
          debugPrint(
            '[LodgeCore API ERROR] ${e.response?.statusCode ?? 'NETWORK'} '
            '${e.requestOptions.method} ${e.requestOptions.uri}',
          );
          debugPrint('[LodgeCore API ERROR] ${e.message}');
          if (e.response?.data != null) {
            debugPrint('[LodgeCore API ERROR BODY] ${e.response?.data}');
          }
        }
        // Do not clear credentials here. A 401 can be caused by a single
        // endpoint's permission/property scope, and clearing tokens from a
        // transport interceptor logs the user out during an ordinary refresh.
        // Authentication expiry should be handled explicitly by the auth flow.
        return handler.next(e);
      },
    ),
  );

  return dio;
});
