import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../dashboard/presentation/screens/main_screen.dart';
import '../../data/hub_repository.dart';
import '../../providers/hub_provider.dart';

const _bg = Color(0xFF070D1A);
const _panel = Color(0xFF101B30);
const _raised = Color(0xFF16243D);
const _line = Color(0xFF243653);
const _gold = Color(0xFFD8AD52);
const _white = Color(0xFFF1F5FF);
const _muted = Color(0xFF91A2BF);
const _faint = Color(0xFF647594);
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

  Future<void> _refresh() async {
    setState(_load);
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        automaticallyImplyLeading: false,
        titleSpacing: 20,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'RESERVATIONS',
              style: TextStyle(
                color: _gold,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.4,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Stay control',
              style: TextStyle(
                color: _white,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh reservations',
            onPressed: () => setState(_load),
            icon: const Icon(Icons.refresh_rounded, color: _muted),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const _LoadingState();
          }
          if (snapshot.hasError) {
            return _ErrorState(onRetry: () => setState(_load));
          }

          final data = snapshot.data ?? {};
          final groups = [
            _items(data['checkedIn']),
            _items(data['noShows']),
            _items(data['reserved']),
          ];
          const labels = ['Checked in', 'No-shows', 'Reserved · all dates'];

          return RefreshIndicator(
            color: _gold,
            backgroundColor: _raised,
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
              children: [
                _dateBanner(data['date']),
                const SizedBox(height: 16),
                _overview(groups),
                const SizedBox(height: 22),
                _tabBar(labels, groups),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Text(
                      labels[_tab].toUpperCase(),
                      style: const TextStyle(
                        color: _muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${groups[_tab].length} record${groups[_tab].length == 1 ? '' : 's'}',
                      style: const TextStyle(color: _faint, fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (groups[_tab].isEmpty)
                  _empty(labels[_tab])
                else
                  ...groups[_tab].map(
                    (item) => _ReservationCard(
                      item: item,
                      onTap: () => _openDetails(item['id'].toString()),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: _ReservationBottomNav(
        currentIndex: 4,
        onTap: (index) => _navigateToTab(context, index),
      ),
    );
  }

  List<Map<String, dynamic>> _items(dynamic value) =>
      List<Map<String, dynamic>>.from(
        (value as List<dynamic>? ?? const []).map(
          (item) => Map<String, dynamic>.from(item as Map),
        ),
      );

  Widget _dateBanner(dynamic value) {
    final date = _parseDate(value);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_raised, _panel],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _gold.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.calendar_month_rounded, color: _gold),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'BUSINESS DATE',
                  style: TextStyle(
                    color: _faint,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  date == null
                      ? value?.toString() ?? 'Current operating date'
                      : DateFormat('EEEE, d MMMM yyyy').format(date),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: _white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: _faint),
        ],
      ),
    );
  }

  Widget _overview(List<List<Map<String, dynamic>>> groups) {
    const labels = ['In house', 'No-shows', 'Arrivals'];
    const icons = [
      Icons.hotel_rounded,
      Icons.person_off_rounded,
      Icons.login_rounded,
    ];
    const colors = [_green, _red, _blue];
    return Row(
      children: [
        for (var i = 0; i < 3; i++)
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: i == 2 ? 0 : 8),
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 13, 8, 12),
                decoration: BoxDecoration(
                  color: _panel,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icons[i], color: colors[i], size: 17),
                    const SizedBox(height: 10),
                    Text(
                      '${groups[i].length}',
                      style: const TextStyle(
                        color: _white,
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      labels[i],
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: _muted, fontSize: 10),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _tabBar(List<String> labels, List<List<Map<String, dynamic>>> groups) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Padding(
              padding: EdgeInsets.only(right: i == labels.length - 1 ? 0 : 8),
              child: ChoiceChip(
                selected: _tab == i,
                label: Text('${labels[i]}  ${groups[i].length}'),
                onSelected: (_) => setState(() => _tab = i),
                selectedColor: _gold,
                backgroundColor: _panel,
                side: BorderSide(color: _tab == i ? _gold : _line),
                labelStyle: TextStyle(
                  color: _tab == i ? _bg : _muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _empty(String label) => Container(
    padding: const EdgeInsets.symmetric(vertical: 34, horizontal: 20),
    decoration: BoxDecoration(
      color: _panel,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _line),
    ),
    child: Column(
      children: [
        const Icon(Icons.event_available_rounded, color: _faint, size: 32),
        const SizedBox(height: 10),
        Text(
          'No $label reservations',
          style: const TextStyle(color: _white, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 5),
        const Text(
          'There is nothing requiring attention in this group.',
          textAlign: TextAlign.center,
          style: TextStyle(color: _muted, fontSize: 12),
        ),
      ],
    ),
  );

  Future<void> _openDetails(String id) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ReservationDetailScreen(
          id: id,
          propertyId: ref.read(effectivePropertyIdProvider),
          repository: ref.read(hubRepositoryProvider),
        ),
      ),
    );
    if (changed == true && mounted) setState(_load);
  }

  void _navigateToTab(BuildContext context, int index) {
    if (index == 4) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => MainScreen(initialIndex: index)),
      (route) => false,
    );
  }
}

class _ReservationCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onTap;

  const _ReservationCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final guest = Map<String, dynamic>.from(item['guest'] ?? {});
    final rooms = List<dynamic>.from(item['rooms'] ?? const []);
    final category = item['category']?.toString();
    final color = category == 'CHECKED_IN'
        ? _green
        : category == 'NO_SHOW'
        ? _red
        : _blue;
    final name = guest['name']?.toString().trim().isNotEmpty == true
        ? guest['name'].toString()
        : 'Guest';
    final roomLabel = rooms.isEmpty
        ? 'Room unassigned'
        : rooms.map((room) => room['number']).join(', ');
    final benefit = _benefitForRooms(rooms);
    final balanceSummary = Map<String, dynamic>.from(
      item['balanceSummary'] ?? const {},
    );
    final outstanding = _amount(balanceSummary['outstanding']);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _line),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: IntrinsicHeight(
            child: Row(
              children: [
                Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: const BorderRadius.horizontal(
                      left: Radius.circular(18),
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(13, 14, 12, 14),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: .12),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(
                            _initials(name),
                            style: TextStyle(
                              color: color,
                              fontWeight: FontWeight.w800,
                            ),
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
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: _white,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  if (guest['isVip'] == true)
                                    const Padding(
                                      padding: EdgeInsets.only(left: 6),
                                      child: Icon(
                                        Icons.star_rounded,
                                        color: _gold,
                                        size: 16,
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                roomLabel,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: _muted,
                                  fontSize: 11,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${_date(item['checkIn'])}  →  ${_date(item['checkOut'])}',
                                style: const TextStyle(
                                  color: _faint,
                                  fontSize: 11,
                                ),
                              ),
                              if (benefit != null) ...[
                                const SizedBox(height: 9),
                                _BenefitBadge(benefit: benefit),
                              ],
                              if (outstanding > 0.01) ...[
                                const SizedBox(height: 7),
                                _DebtBadge(
                                  amount: outstanding,
                                  currency:
                                      balanceSummary['currency']?.toString() ??
                                      item['currency']?.toString() ??
                                      'NGN',
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.arrow_forward_ios_rounded,
                          color: _faint,
                          size: 14,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String _initials(String value) {
    final parts = value
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.length > 1) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return value.substring(0, 1).toUpperCase();
  }

  static String _date(dynamic value) {
    final date = _parseDate(value);
    return date == null ? '—' : DateFormat('d MMM').format(date);
  }
}

class ReservationDetailScreen extends StatefulWidget {
  final String id;
  final String propertyId;
  final HubRepository repository;

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
    _load();
  }

  void _load() {
    _future = widget.repository.fetchReservationDetails(
      widget.id,
      propertyId: widget.propertyId,
    );
  }

  Future<void> _openCityLedgerCheckout({
    required String guestName,
    required String confirmationNumber,
    required double amount,
    required String currency,
  }) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CityLedgerCheckoutSheet(
        guestName: guestName,
        confirmationNumber: confirmationNumber,
        amount: amount,
        currency: currency,
        onConfirm: () async {
          await widget.repository.checkoutToCityLedger(widget.id);
          if (mounted) Navigator.of(context).pop(true);
        },
      ),
    );

    if (confirmed == true && mounted) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          tooltip: 'Back to reservations',
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: _white,
            size: 19,
          ),
        ),
        title: const Text(
          'Reservation',
          style: TextStyle(color: _white, fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            onPressed: () => setState(_load),
            icon: const Icon(Icons.refresh_rounded, color: _muted),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const _LoadingState();
          }
          if (snapshot.hasError) {
            return _ErrorState(
              onRetry: () => setState(_load),
              label: 'Unable to load reservation details',
            );
          }
          return _details(snapshot.data ?? {});
        },
      ),
      bottomNavigationBar: _ReservationBottomNav(
        currentIndex: 4,
        onTap: (index) => _navigateToTab(context, index),
      ),
    );
  }

  Widget _details(Map<String, dynamic> reservation) {
    final guest = Map<String, dynamic>.from(reservation['guest'] ?? {});
    final rooms = List<dynamic>.from(reservation['rooms'] ?? const []);
    final folios = List<dynamic>.from(reservation['folios'] ?? const []);
    final name = guest['name']?.toString().trim().isNotEmpty == true
        ? guest['name'].toString()
        : 'Guest';
    final category =
        reservation['category']?.toString().replaceAll('_', ' ') ??
        'RESERVATION';
    final status =
        reservation['status']?.toString().replaceAll('_', ' ') ?? category;
    final balanceSummary = Map<String, dynamic>.from(
      reservation['balanceSummary'] ?? const {},
    );
    final charges = _summaryAmount(
      balanceSummary['charges'],
      folios.fold<double>(
        0,
        (sum, folio) => sum + _amount(folio['totalCharges']),
      ),
    );
    final payments = _summaryAmount(
      balanceSummary['payments'],
      folios.fold<double>(
        0,
        (sum, folio) => sum + _amount(folio['totalPayments']),
      ),
    );
    final signedBalance = _summaryAmount(
      balanceSummary['balance'],
      charges - payments,
    );
    final credit = _summaryAmount(
      balanceSummary['credit'],
      folios.fold<double>(
        0,
        (sum, folio) => sum + _amount(folio['availableCredit']),
      ),
    );
    final outstanding = signedBalance > 0.01 ? signedBalance : 0.0;
    final currency =
        balanceSummary['currency']?.toString() ??
        reservation['currency']?.toString() ??
        'NGN';
    final color = reservation['category'] == 'CHECKED_IN'
        ? _green
        : reservation['category'] == 'NO_SHOW'
        ? _red
        : _blue;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 30),
      children: [
        _profileHero(name, guest, category, status, color),
        if (outstanding > 0.01) ...[
          const SizedBox(height: 12),
          _debtBanner(outstanding, currency),
        ],
        const SizedBox(height: 14),
        _balanceSection(
          charges: charges,
          payments: payments,
          credit: credit,
          balance: signedBalance,
          currency: currency,
        ),
        if (outstanding > 0.01 && reservation['status'] == 'CHECKED_IN') ...[
          const SizedBox(height: 12),
          _cityLedgerAction(
            guestName: name,
            confirmationNumber:
                reservation['confirmationNumber']?.toString() ?? '—',
            amount: outstanding,
            currency: currency,
          ),
        ],
        const SizedBox(height: 12),
        _sectionCard('STAY OVERVIEW', Icons.hotel_rounded, [
          _infoRow(
            Icons.confirmation_number_outlined,
            'Confirmation',
            reservation['confirmationNumber'],
          ),
          _infoRow(
            Icons.login_rounded,
            'Check-in',
            _date(reservation['checkIn']),
          ),
          _infoRow(
            Icons.logout_rounded,
            'Check-out',
            _date(reservation['checkOut']),
          ),
          _infoRow(
            Icons.people_alt_outlined,
            'Occupancy',
            '${reservation['adults'] ?? 0} adults · ${reservation['children'] ?? 0} children',
          ),
        ]),
        if (rooms.isNotEmpty) ...[
          const SizedBox(height: 12),
          _sectionCard('ROOM ASSIGNMENTS', Icons.king_bed_outlined, [
            for (final room in rooms) _roomRow(room, reservation['currency']),
          ]),
        ],
        const SizedBox(height: 12),
        _folioSection(folios),
      ],
    );
  }

  Widget _cityLedgerAction({
    required String guestName,
    required String confirmationNumber,
    required double amount,
    required String currency,
  }) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _red.withValues(alpha: .08),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _red.withValues(alpha: .24)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.account_balance_rounded, color: _red, size: 18),
            SizedBox(width: 8),
            Text(
              'DEPARTURE CONTROL',
              style: TextStyle(
                color: _red,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        const Text(
          'This guest has an outstanding balance.',
          style: TextStyle(color: _white, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        const Text(
          'Transfer the debt to City Ledger and complete checkout with an auditable receivable record.',
          style: TextStyle(color: _muted, fontSize: 12, height: 1.4),
        ),
        const SizedBox(height: 13),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => _openCityLedgerCheckout(
              guestName: guestName,
              confirmationNumber: confirmationNumber,
              amount: amount,
              currency: currency,
            ),
            icon: const Icon(Icons.arrow_forward_rounded, size: 17),
            label: const Text('Checkout to City Ledger'),
            style: FilledButton.styleFrom(
              backgroundColor: _red,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(44),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              textStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _debtBanner(double amount, String currency) => Container(
    padding: const EdgeInsets.all(15),
    decoration: BoxDecoration(
      color: _red.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _red.withValues(alpha: .34)),
    ),
    child: Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: _red.withValues(alpha: .16),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.warning_amber_rounded, color: _red, size: 21),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'OUTSTANDING GUEST BALANCE',
                style: TextStyle(
                  color: _red,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: .8,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$currency ${_wholeAmount(amount)} due',
                style: const TextStyle(
                  color: _white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
        const Icon(Icons.arrow_forward_ios_rounded, color: _red, size: 14),
      ],
    ),
  );

  Widget _balanceSection({
    required double charges,
    required double payments,
    required double credit,
    required double balance,
    required String currency,
  }) {
    final positionLabel = balance > 0.01
        ? 'Outstanding'
        : balance < -0.01
        ? 'Folio credit'
        : 'Settled';
    final positionColor = balance > 0.01
        ? _red
        : balance < -0.01
        ? _green
        : _muted;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_raised, _panel],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.account_balance_wallet_outlined,
                color: _gold,
                size: 17,
              ),
              SizedBox(width: 8),
              Text(
                'GUEST BALANCE',
                style: TextStyle(
                  color: _gold,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 13),
          Row(
            children: [
              Expanded(
                child: _balanceMetric(
                  'Guest charges',
                  charges,
                  currency,
                  _white,
                ),
              ),
              Expanded(
                child: _balanceMetric(
                  'Payments received',
                  payments,
                  currency,
                  _green,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _balanceMetric(
                  'Credit available',
                  credit,
                  currency,
                  _blue,
                ),
              ),
              Expanded(
                child: _balanceMetric(
                  positionLabel,
                  balance.abs(),
                  currency,
                  positionColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _balanceMetric(
    String label,
    double amount,
    String currency,
    Color color,
  ) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: _muted, fontSize: 10),
        ),
        const SizedBox(height: 4),
        Text(
          '$currency ${_wholeAmount(amount)}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );

  Widget _profileHero(
    String name,
    Map<String, dynamic> guest,
    String category,
    String status,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_raised, _panel],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .13),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  _initials(name),
                  style: TextStyle(
                    color: color,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: _white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      guest['phone']?.toString() ??
                          guest['email']?.toString() ??
                          'No contact recorded',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: _muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _statusPill(status, color),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  category,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: _gold,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .8,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _sectionCard(String title, IconData icon, List<Widget> children) =>
      Container(
        padding: const EdgeInsets.fromLTRB(16, 15, 16, 10),
        decoration: BoxDecoration(
          color: _panel,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: _gold, size: 17),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    color: _gold,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 9),
            ...children,
          ],
        ),
      );

  Widget _infoRow(IconData icon, String label, dynamic value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      children: [
        Icon(icon, color: _faint, size: 16),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: _muted, fontSize: 12),
          ),
        ),
        Flexible(
          child: Text(
            value?.toString() ?? '—',
            textAlign: TextAlign.right,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: _white,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _roomRow(dynamic room, dynamic currency) => Container(
    margin: const EdgeInsets.only(bottom: 6),
    padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 10),
    decoration: BoxDecoration(
      color: _raised,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                room['number']?.toString() ?? 'Unassigned room',
                style: const TextStyle(
                  color: _white,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                room['status']?.toString().replaceAll('_', ' ') ?? '—',
                style: const TextStyle(color: _muted, fontSize: 11),
              ),
            ],
          ),
        ),
        Text(
          '${currency ?? ''} ${room['rateAmount'] ?? '—'}',
          style: const TextStyle(
            color: _gold,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );

  Widget _folioSection(List<dynamic> folios) {
    if (folios.isEmpty) {
      return _sectionCard('FOLIO', Icons.receipt_long_outlined, [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Text(
            'No folio opened for this reservation.',
            style: TextStyle(color: _muted, fontSize: 12),
          ),
        ),
      ]);
    }
    return Column(
      children: [
        for (final folio in folios) ...[
          _sectionCard(
            'FOLIO ${folio['folioNumber'] ?? ''}',
            Icons.receipt_long_outlined,
            [
              _infoRow(
                Icons.account_balance_wallet_outlined,
                'Balance',
                '${folio['currency'] ?? ''} ${folio['balance'] ?? '0'}',
              ),
              _infoRow(
                Icons.payments_outlined,
                'Status',
                (folio['status'] ?? 'OPEN').toString().replaceAll('_', ' '),
              ),
              _infoRow(
                Icons.stars_outlined,
                'Credit available',
                '${folio['currency'] ?? ''} ${_wholeAmount(_amount(folio['availableCredit']))}',
              ),
            ],
          ),
          if (List<dynamic>.from(folio['items'] ?? const []).isNotEmpty) ...[
            const SizedBox(height: 8),
            _sectionCard('RECENT FOLIO ACTIVITY', Icons.timeline_rounded, [
              for (final line in List<dynamic>.from(folio['items']))
                _infoRow(
                  Icons.circle,
                  line['description'] ?? 'Folio item',
                  '${line['currency'] ?? folio['currency'] ?? ''} ${line['amount'] ?? '0'}',
                ),
            ]),
          ],
          if (folio != folios.last) const SizedBox(height: 12),
        ],
      ],
    );
  }

  Widget _statusPill(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: color.withValues(alpha: .28)),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: color,
        fontSize: 10,
        fontWeight: FontWeight.w800,
        letterSpacing: .4,
      ),
    ),
  );

  void _navigateToTab(BuildContext context, int index) {
    if (index == 4) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => MainScreen(initialIndex: index)),
      (route) => false,
    );
  }
}

class _ReservationBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const _ReservationBottomNav({
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.home_outlined, Icons.home_rounded, 'Home'),
      (Icons.king_bed_outlined, Icons.king_bed_rounded, 'Rooms'),
      (
        Icons.account_balance_wallet_outlined,
        Icons.account_balance_wallet_rounded,
        'Finance',
      ),
      (Icons.dashboard_outlined, Icons.dashboard_rounded, 'Ops'),
      (Icons.apps_rounded, Icons.apps_rounded, 'Control'),
    ];
    return Container(
      color: _bg,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 5, 8, 8),
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: GestureDetector(
                    onTap: () => onTap(i),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(
                        vertical: 7,
                        horizontal: 3,
                      ),
                      decoration: BoxDecoration(
                        color: currentIndex == i
                            ? _gold.withValues(alpha: .09)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(13),
                        border: currentIndex == i
                            ? Border.all(color: _gold.withValues(alpha: .18))
                            : null,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            currentIndex == i ? items[i].$2 : items[i].$1,
                            color: currentIndex == i ? _gold : _muted,
                            size: 21,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            items[i].$3,
                            style: TextStyle(
                              color: currentIndex == i ? _gold : _muted,
                              fontSize: 9,
                              fontWeight: currentIndex == i
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CityLedgerCheckoutSheet extends StatefulWidget {
  final String guestName;
  final String confirmationNumber;
  final double amount;
  final String currency;
  final Future<void> Function() onConfirm;

  const _CityLedgerCheckoutSheet({
    required this.guestName,
    required this.confirmationNumber,
    required this.amount,
    required this.currency,
    required this.onConfirm,
  });

  @override
  State<_CityLedgerCheckoutSheet> createState() =>
      _CityLedgerCheckoutSheetState();
}

class _CityLedgerCheckoutSheetState extends State<_CityLedgerCheckoutSheet> {
  bool _reviewing = false;
  bool _submitting = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.onConfirm();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
      decoration: const BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(top: BorderSide(color: _line)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: _faint,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: _red.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.account_balance_rounded, color: _red),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'CITY LEDGER CHECKOUT',
                        style: TextStyle(
                          color: _red,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Controlled departure transfer',
                        style: TextStyle(
                          color: _white,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: _submitting
                      ? null
                      : () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, color: _muted),
                ),
              ],
            ),
            const SizedBox(height: 18),
            if (_error != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _red.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _red.withValues(alpha: .24)),
                ),
                child: Text(
                  _error!,
                  style: const TextStyle(
                    color: _red,
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _raised,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: _line),
              ),
              child: Column(
                children: [
                  _sheetRow('Guest', widget.guestName),
                  _sheetRow('Confirmation', widget.confirmationNumber),
                  const Divider(color: _line, height: 20),
                  _sheetRow(
                    'Debt to transfer',
                    '${widget.currency} ${_wholeAmount(widget.amount)}',
                    valueColor: _red,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 13),
            Text(
              _reviewing
                  ? 'Confirming will create the City Ledger receivable, close the guest folio, check the guest out, and release the room for housekeeping.'
                  : 'The outstanding balance will be moved to the property City Ledger for controlled recovery. No payment will be recorded as received.',
              style: const TextStyle(color: _muted, fontSize: 12, height: 1.45),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting
                        ? null
                        : () => _reviewing
                              ? setState(() => _reviewing = false)
                              : Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _muted,
                      minimumSize: const Size.fromHeight(46),
                      side: const BorderSide(color: _line),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(13),
                      ),
                    ),
                    child: Text(_reviewing ? 'Go back' : 'Cancel'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: _submitting
                        ? null
                        : (_reviewing
                              ? _submit
                              : () => setState(() => _reviewing = true)),
                    icon: _submitting
                        ? const SizedBox(
                            width: 17,
                            height: 17,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Icon(
                            _reviewing
                                ? Icons.verified_rounded
                                : Icons.arrow_forward_rounded,
                            size: 17,
                          ),
                    label: Text(
                      _submitting
                          ? 'Processing…'
                          : (_reviewing
                                ? 'Confirm transfer'
                                : 'Review transfer'),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: _red,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(13),
                      ),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _sheetRow(String label, String value, {Color valueColor = _white}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(color: _muted, fontSize: 12),
              ),
            ),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: TextStyle(
                  color: valueColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      );
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator(color: _gold));
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  final String label;

  const _ErrorState({
    required this.onRetry,
    this.label = 'Unable to load reservations',
  });

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, color: _red, size: 36),
          const SizedBox(height: 12),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: _white, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 15),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try again'),
            style: OutlinedButton.styleFrom(
              foregroundColor: _gold,
              side: const BorderSide(color: _line),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _ReservationBenefit {
  final String label;
  final Color color;
  final IconData icon;

  const _ReservationBenefit({
    required this.label,
    required this.color,
    required this.icon,
  });
}

class _BenefitBadge extends StatelessWidget {
  final _ReservationBenefit benefit;

  const _BenefitBadge({required this.benefit});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: benefit.color.withValues(alpha: .10),
      borderRadius: BorderRadius.circular(9),
      border: Border.all(color: benefit.color.withValues(alpha: .28)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(benefit.icon, color: benefit.color, size: 13),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            benefit.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: benefit.color,
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: .65,
            ),
          ),
        ),
      ],
    ),
  );
}

class _DebtBadge extends StatelessWidget {
  final double amount;
  final String currency;

  const _DebtBadge({required this.amount, required this.currency});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: _red.withValues(alpha: .11),
      borderRadius: BorderRadius.circular(9),
      border: Border.all(color: _red.withValues(alpha: .3)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.warning_amber_rounded, color: _red, size: 13),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            'OUTSTANDING · $currency ${_wholeAmount(amount)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: _red,
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: .45,
            ),
          ),
        ),
      ],
    ),
  );
}

_ReservationBenefit? _benefitForRooms(List<dynamic> rooms) {
  for (final rawRoom in rooms) {
    final room = rawRoom is Map ? rawRoom : const <String, dynamic>{};
    final type = room['discountType']?.toString();
    if (type == 'COMPLIMENTARY') {
      return const _ReservationBenefit(
        label: 'COMPLIMENTARY BENEFIT',
        color: _green,
        icon: Icons.auto_awesome_rounded,
      );
    }
  }

  for (final rawRoom in rooms) {
    final room = rawRoom is Map ? rawRoom : const <String, dynamic>{};
    final type = room['discountType']?.toString();
    if (type == 'PERCENTAGE' && _amount(room['discountPercent']) > 0) {
      return _ReservationBenefit(
        label: 'DISCOUNT ${_wholeAmount(_amount(room['discountPercent']))}%',
        color: _gold,
        icon: Icons.local_offer_rounded,
      );
    }
    if (type == 'FIXED_AMOUNT' && _amount(room['discountAmount']) > 0) {
      return const _ReservationBenefit(
        label: 'DISCOUNT APPLIED',
        color: _gold,
        icon: Icons.local_offer_rounded,
      );
    }
  }
  return null;
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

String _date(dynamic value) {
  final date = _parseDate(value);
  return date == null ? '—' : DateFormat('d MMM yyyy').format(date);
}

String _initials(String value) {
  final parts = value
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.length > 1) {
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
  return value.isEmpty ? '?' : value.substring(0, 1).toUpperCase();
}

double _amount(dynamic value) {
  final amount = double.tryParse(value?.toString() ?? '');
  return amount?.isFinite == true ? amount! : 0;
}

double _summaryAmount(dynamic value, double fallback) {
  if (value == null) return fallback;
  final amount = double.tryParse(value.toString());
  return amount?.isFinite == true ? amount! : fallback;
}

String _wholeAmount(double value) {
  return NumberFormat('#,##0.##').format(value.abs());
}
