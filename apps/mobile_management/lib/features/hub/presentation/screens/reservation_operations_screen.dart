import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../providers/hub_provider.dart';

const _bg = Color(0xFF070D1A);
const _panel = Color(0xFF101B30);
const _line = Color(0xFF243653);
const _gold = Color(0xFFD8AD52);
const _white = Color(0xFFF1F5FF);
const _muted = Color(0xFF91A2BF);
const _green = Color(0xFF42D392);
const _red = Color(0xFFF07478);
const _blue = Color(0xFF55B9F2);

class ReservationOperationsScreen extends ConsumerStatefulWidget {
  const ReservationOperationsScreen({super.key});
  @override
  ConsumerState<ReservationOperationsScreen> createState() =>
      _ReservationOperationsScreenState();
}

class _ReservationOperationsScreenState
    extends ConsumerState<ReservationOperationsScreen> {
  int _tab = 0;
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = ref
        .read(hubRepositoryProvider)
        .fetchReservations(propertyId: ref.read(effectivePropertyIdProvider));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _bg,
    appBar: AppBar(
      backgroundColor: _bg,
      elevation: 0,
      title: const Text(
        'Reservations',
        style: TextStyle(color: _white, fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(
          onPressed: () => setState(_load),
          icon: const Icon(Icons.refresh_rounded, color: _muted),
        ),
      ],
    ),
    body: FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting)
          return const Center(child: CircularProgressIndicator(color: _gold));
        if (snapshot.hasError)
          return const Center(
            child: Text(
              'Unable to load reservations',
              style: TextStyle(color: _white),
            ),
          );
        final data = snapshot.data ?? {};
        final groups = [
          List<Map<String, dynamic>>.from(data['checkedIn'] ?? const []),
          List<Map<String, dynamic>>.from(data['noShows'] ?? const []),
          List<Map<String, dynamic>>.from(data['reserved'] ?? const []),
        ];
        const labels = ['Checked in', 'No-shows', 'Reserved'];
        return RefreshIndicator(
          color: _gold,
          onRefresh: () async => setState(_load),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
            children: [
              const Text(
                'Daily arrival control',
                style: TextStyle(
                  color: _white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                data['date']?.toString() ?? 'Business date',
                style: const TextStyle(color: _muted, fontSize: 12),
              ),
              const SizedBox(height: 18),
              _tabs(labels, groups),
              const SizedBox(height: 16),
              if (groups[_tab].isEmpty)
                _empty(labels[_tab])
              else
                ...groups[_tab].map(
                  (item) => _ReservationTile(
                    item: item,
                    onTap: () => _openDetails(item['id'].toString()),
                  ),
                ),
            ],
          ),
        );
      },
    ),
  );

  Widget _tabs(List<String> labels, List<List<Map<String, dynamic>>> groups) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _tab = i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  decoration: BoxDecoration(
                    color: _tab == i ? _gold : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${labels[i]}\n${groups[i].length}',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _tab == i ? _bg : _muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _empty(String label) => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      color: _panel,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _line),
    ),
    child: Center(
      child: Text(
        'No $label reservations for this business date.',
        textAlign: TextAlign.center,
        style: const TextStyle(color: _muted, fontSize: 13),
      ),
    ),
  );

  Future<void> _openDetails(String id) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ReservationDetailScreen(
          id: id,
          propertyId: ref.read(effectivePropertyIdProvider),
          repository: ref.read(hubRepositoryProvider),
        ),
      ),
    );
  }
}

class _ReservationTile extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onTap;
  const _ReservationTile({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final guest = Map<String, dynamic>.from(item['guest'] ?? {});
    final rooms = List<dynamic>.from(item['rooms'] ?? const []);
    final category = item['category'];
    final color = category == 'CHECKED_IN'
        ? _green
        : category == 'NO_SHOW'
        ? _red
        : _blue;
    final name = guest['name']?.toString() ?? 'Guest';
    return Card(
      color: _panel,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: _line),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            children: [
              CircleAvatar(
                radius: 21,
                backgroundColor: color.withValues(alpha: .12),
                child: Text(
                  name.substring(0, 1).toUpperCase(),
                  style: TextStyle(color: color, fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: const TextStyle(
                              color: _white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (guest['isVip'] == true)
                          const Icon(
                            Icons.star_rounded,
                            color: _gold,
                            size: 16,
                          ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${item['confirmationNumber']} · ${rooms.isEmpty ? 'Room unassigned' : rooms.map((r) => r['number']).join(', ')}',
                      style: const TextStyle(color: _muted, fontSize: 11),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${_date(item['checkIn'])} → ${_date(item['checkOut'])}',
                      style: const TextStyle(color: _muted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: _muted),
            ],
          ),
        ),
      ),
    );
  }

  String _date(dynamic value) => value == null
      ? '—'
      : DateFormat('d MMM').format(DateTime.parse(value.toString()));
}

class ReservationDetailScreen extends StatefulWidget {
  final String id;
  final String propertyId;
  final dynamic repository;
  const ReservationDetailScreen({
    super.key,
    required this.id,
    required this.propertyId,
    required this.repository,
  });
  @override
  State<ReservationDetailScreen> createState() =>
      _ReservationDetailScreenState();
}

class _ReservationDetailScreenState extends State<ReservationDetailScreen> {
  late Future<Map<String, dynamic>> _future;
  @override
  void initState() {
    super.initState();
    _future = widget.repository.fetchReservationDetails(
      widget.id,
      propertyId: widget.propertyId,
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _bg,
    appBar: AppBar(
      backgroundColor: _bg,
      title: const Text(
        'Reservation details',
        style: TextStyle(color: _white, fontWeight: FontWeight.w800),
      ),
    ),
    body: FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData)
          return Center(
            child: snapshot.hasError
                ? const Text(
                    'Unable to load reservation',
                    style: TextStyle(color: _white),
                  )
                : const CircularProgressIndicator(color: _gold),
          );
        final r = snapshot.data!;
        final guest = Map<String, dynamic>.from(r['guest'] ?? {});
        final folios = List<dynamic>.from(r['folios'] ?? const []);
        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            _hero(guest, r),
            _section('Stay', [
              _detailLine('Confirmation', r['confirmationNumber']),
              _detailLine('Status', r['status']),
              _detailLine(
                'Dates',
                '${_date(r['checkIn'])} → ${_date(r['checkOut'])}',
              ),
              _detailLine(
                'Occupancy',
                '${r['adults']} adults · ${r['children']} children',
              ),
            ]),
            _section('Rooms', [
              for (final room in List<dynamic>.from(r['rooms'] ?? const []))
                _detailLine(
                  room['number'],
                  '${room['status']} · ${r['currency']} ${room['rateAmount']}',
                ),
            ]),
            _section(
              'Folio',
              folios.isEmpty
                  ? [_detailLine('Folio', 'No folio opened')]
                  : [
                      for (final f in folios)
                        _detailLine(
                          f['folioNumber'] ?? 'Folio',
                          '${f['currency']} ${f['balance']} balance',
                        ),
                    ],
            ),
            for (final f in folios)
              if (List<dynamic>.from(f['items'] ?? const []).isNotEmpty)
                _section('Folio activity', [
                  for (final line in List<dynamic>.from(f['items']))
                    _detailLine(
                      line['description'],
                      '${line['currency']} ${line['amount']}',
                    ),
                ]),
          ],
        );
      },
    ),
  );

  Widget _hero(Map<String, dynamic> guest, Map<String, dynamic> r) => Container(
    padding: const EdgeInsets.all(18),
    margin: const EdgeInsets.only(bottom: 14),
    decoration: BoxDecoration(
      color: _panel,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: _line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          guest['name'] ?? 'Guest',
          style: const TextStyle(
            color: _white,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          guest['phone'] ?? guest['email'] ?? 'No contact recorded',
          style: const TextStyle(color: _muted, fontSize: 12),
        ),
        const SizedBox(height: 12),
        Text(
          r['category']?.toString().replaceAll('_', ' ') ?? '',
          style: const TextStyle(
            color: _gold,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: .8,
          ),
        ),
      ],
    ),
  );
  Widget _section(String title, List<Widget> children) => Container(
    padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
    margin: const EdgeInsets.only(bottom: 12),
    decoration: BoxDecoration(
      color: _panel,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.toUpperCase(),
          style: const TextStyle(
            color: _gold,
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 8),
        ...children,
      ],
    ),
  );
  Widget _detailLine(dynamic label, dynamic value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label?.toString() ?? '—',
            style: const TextStyle(color: _muted, fontSize: 12),
          ),
        ),
        Text(
          value?.toString() ?? '—',
          style: const TextStyle(
            color: _white,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
  String _date(dynamic value) => value == null
      ? '—'
      : DateFormat('d MMM yyyy').format(DateTime.parse(value.toString()));
}
