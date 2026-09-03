import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/api/api_client.dart';
import '../data/live_room_repository.dart';
import '../data/room_models.dart';
import 'widgets/room_status_badge.dart';
import 'widgets/room_activity_timeline.dart';

class RoomDetailsScreen extends StatefulWidget {
  final String roomId;
  final String roomNumber;

  const RoomDetailsScreen({super.key, required this.roomId, required this.roomNumber});

  @override
  State<RoomDetailsScreen> createState() => _RoomDetailsScreenState();
}

class _RoomDetailsScreenState extends State<RoomDetailsScreen> {
  late Future<RoomDetailsData> _roomDetailsFuture;
  final NumberFormat _currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    // In a real app this uses GetIt or Provider
    final apiClient = ApiClient();
    final repository = LiveRoomRepository(apiClient);
    _roomDetailsFuture = repository.getRoomDetails(widget.roomId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Room ${widget.roomNumber}', style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: FutureBuilder<RoomDetailsData>(
        future: _roomDetailsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Text(
                'Failed to load details\n${snapshot.error}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.redAccent),
              ),
            );
          }

          final data = snapshot.data!;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(data),
                const SizedBox(height: 24),
                
                if (data.currentGuestName != null || data.nextArrivalName != null) ...[
                  _buildGuestSection(data),
                  const SizedBox(height: 24),
                ],

                if (data.folio != null) ...[
                  _buildFolioSection(data.folio!),
                  const SizedBox(height: 24),
                ],

                _buildRoomStatusSection(data),
                const SizedBox(height: 24),

                const Text(
                  'ROOM ACTIVITY',
                  style: TextStyle(
                    color: Colors.white54,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 12),
                RoomActivityTimeline(timelineEvents: data.timeline),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeader(RoomDetailsData data) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          data.roomTypeName.toUpperCase(),
          style: const TextStyle(
            color: Colors.blueAccent,
            fontSize: 13,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            RoomStatusBadge(status: data.displayStatus),
            const SizedBox(width: 8),
            if (data.maintenanceStatus != 'NONE')
              const RoomStatusBadge(status: 'MAINTENANCE', isIndicator: true),
          ],
        )
      ],
    );
  }

  Widget _buildGuestSection(RoomDetailsData data) {
    if (data.displayStatus == 'OCCUPIED' && data.currentGuestName != null) {
      final ci = DateTime.parse(data.currentGuestCheckIn!).toLocal();
      final co = DateTime.parse(data.currentGuestCheckOut!).toLocal();
      
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              data.currentGuestName!,
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              '${data.currentGuestCount} Guest${data.currentGuestCount > 1 ? 's' : ''}',
              style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 14),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildDateBlock('Check-in', ci),
                _buildDateBlock('Check-out', co),
              ],
            )
          ],
        ),
      );
    } else if (data.nextArrivalName != null) {
       return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Next Arrival',
              style: TextStyle(color: Colors.greenAccent, fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              data.nextArrivalName!,
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Date: ${data.nextArrivalDate}',
              style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14),
            ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildDateBlock(String label, DateTime date) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
        ),
        const SizedBox(height: 4),
        Text(
          DateFormat('dd MMM yyyy').format(date),
          style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }

  Widget _buildFolioSection(MobileFolioData folio) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'CURRENT FOLIO',
          style: TextStyle(
            color: Colors.white54,
            fontSize: 12,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Column(
            children: [
              _buildFolioRow('Total Charges', _currencyFormat.format(folio.totalCharges)),
              const SizedBox(height: 8),
              _buildFolioRow('Paid', _currencyFormat.format(folio.paid), color: Colors.greenAccent),
              const Divider(color: Colors.white12, height: 24),
              _buildFolioRow('Balance', _currencyFormat.format(folio.balance), 
                isBold: true, 
                color: folio.balance > 0 ? Colors.redAccent : Colors.white
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFolioRow(String label, String value, {bool isBold = false, Color color = Colors.white}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: isBold ? Colors.white : Colors.white.withOpacity(0.7),
            fontSize: isBold ? 16 : 14,
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: isBold ? 16 : 14,
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ],
    );
  }

  Widget _buildRoomStatusSection(RoomDetailsData data) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'ROOM STATUS',
          style: TextStyle(
            color: Colors.white54,
            fontSize: 12,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildStatusRow('Housekeeping', 
                data.housekeepingStatus == 'CLEAN' ? '✓ Clean' : 'Dirty/Pending',
                isGood: data.housekeepingStatus == 'CLEAN'
              ),
              const SizedBox(height: 16),
              _buildStatusRow('Maintenance', 
                data.maintenanceStatus == 'NONE' ? '✓ No issues' : 'Attention required',
                isGood: data.maintenanceStatus == 'NONE'
              ),
              if (data.contextualNote != null) ...[
                 const SizedBox(height: 16),
                 Text(
                   data.contextualNote!,
                   style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                 )
              ]
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatusRow(String label, String value, {required bool isGood}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: isGood ? Colors.greenAccent : Colors.orangeAccent,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
