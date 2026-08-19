import '../presentation/models/room_data.dart';

abstract class RoomsRepository {
  Future<RoomDashboardData> fetchRoomsData();
  Future<RoomDetailsData> getRoomDetails(String roomId);
}
