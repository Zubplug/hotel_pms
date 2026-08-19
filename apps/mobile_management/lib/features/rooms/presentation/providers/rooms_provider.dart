import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../../data/live_rooms_repository.dart';
import '../models/room_data.dart';

final liveRoomsRepositoryProvider = Provider<LiveRoomsRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return LiveRoomsRepository(
    dio: dio,
  );
});

final roomsDataProvider = FutureProvider<RoomDashboardData>((ref) async {
  final repository = ref.watch(liveRoomsRepositoryProvider);
  return await repository.fetchRoomsData();
});
