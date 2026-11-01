import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../presentation/models/user_profile.dart';

class ProfileRepository {
  final Dio _dio;

  ProfileRepository(this._dio);

  Future<UserProfileData> getProfile() async {
    try {
      final response = await _dio.get('/mobile/v1/me');

      if (response.data != null && response.data['data'] != null) {
        return UserProfileData.fromJson(response.data['data']);
      }
      throw Exception('Invalid profile response format');
    } on DioException catch (e) {
      if (e.response?.data != null && e.response?.data is Map) {
        final data = e.response!.data;
        if (data['error'] != null && data['error']['message'] != null) {
          throw Exception(data['error']['message']);
        }
        if (data['message'] != null) {
          throw Exception(data['message']);
        }
      }
      throw Exception(e.message ?? 'Failed to load profile');
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _request(
      () => _dio.patch(
        '/mobile/v1/security/password',
        data: {'currentPassword': currentPassword, 'newPassword': newPassword},
      ),
      'Unable to update password',
    );
  }

  Future<void> setLoginPin({
    required String currentPassword,
    required String pin,
  }) async {
    await _request(
      () => _dio.post(
        '/manager/auth/pin/setup',
        data: {'currentPassword': currentPassword, 'pin': pin},
      ),
      'Unable to configure login PIN',
    );
  }

  Future<void> _request(
    Future<Response<dynamic>> Function() request,
    String fallback,
  ) async {
    try {
      final response = await request();
      final data = response.data;
      if (data is Map && data['success'] == false) {
        throw Exception(
          data['error']?['message'] ?? data['message'] ?? fallback,
        );
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) {
        final message = data['error'] is Map
            ? data['error']['message']
            : data['message'];
        throw Exception(message ?? fallback);
      }
      throw Exception(e.message ?? fallback);
    }
  }
}

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return ProfileRepository(dio);
});
