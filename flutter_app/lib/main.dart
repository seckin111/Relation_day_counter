import 'dart:async';
import 'package:flutter/material.dart';
import 'domain/models/models.dart';
import 'ui/widgets/heart_painter.dart';

void main() {
  runApp(const BizimAskHikayemizApp());
}

class BizimAskHikayemizApp extends StatelessWidget {
  const BizimAskHikayemizApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Bizim Aşk Hikayemiz',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F0C20),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFF2A6D),
          secondary: Color(0xFFFFB703),
        ),
      ),
      home: const MainHomeScreen(),
    );
  }
}

class MainHomeScreen extends StatefulWidget {
  const MainHomeScreen({super.key});

  @override
  State<MainHomeScreen> createState() => _MainHomeScreenState();
}

class _MainHomeScreenState extends State<MainHomeScreen> {
  int _currentIndex = 0;
  String partner1 = "Seçkin";
  String partner2 = "Tuğçe";
  DateTime startDate = DateTime.now().subtract(const Duration(days: 438, hours: 4));

  late Timer _timer;
  Duration _duration = Duration.zero;

  List<Memory> memories = [];
  List<FuturePlan> futurePlans = [];
  List<UserNote> userNotes = [];

  @override
  void initState() {
    super.initState();
    _calculateDuration();
    // Live 1-Second Real-Time Update Timer
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _calculateDuration();
    });
  }

  void _calculateDuration() {
    setState(() {
      _duration = DateTime.now().difference(startDate);
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F0C20), Color(0xFF1A0B2E), Color(0xFF2B0826)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(context),
              Expanded(
                child: IndexedStack(
                  index: _currentIndex,
                  children: [
                    _buildMainCounterAndCalendarTab(),
                    _buildMemoriesTimelineTab(),
                    _buildFuturePlansTab(),
                    _buildNotesTab(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) => setState(() => _currentIndex = idx),
        backgroundColor: const Color(0xFF150921),
        selectedItemColor: const Color(0xFFFF2A6D),
        unselectedItemColor: Colors.white54,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: 'Takvim'),
          BottomNavigationBarItem(icon: Icon(Icons.star), label: 'Anı Galerisi'),
          BottomNavigationBarItem(icon: Icon(Icons.flight_takeoff), label: 'Gelecek'),
          BottomNavigationBarItem(icon: Icon(Icons.note_alt), label: 'Notlarım'),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
      child: Row(
        mainAxisAlignment: MainState.between,
        children: [
          Row(
            children: const [
              Icon(Icons.favorite, color: Color(0xFFFF2A6D), size: 28),
              SizedBox(width: 8),
              Text(
                'Bizim Aşk Hikayemiz',
                style: TextStyle(
                  fontFamily: 'Dancing Script',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.pin_drop, color: Color(0xFFFFB703)),
                tooltip: 'Kilit Ekranında Sabitle',
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('📌 Canlı Kalpli Bildirim Kilit Ekranına Sabitlendi! ❤️')),
                  );
                },
              ),
              IconButton(
                icon: const Icon(Icons.settings, color: Colors.white70),
                onPressed: () => _showSettingsDialog(context),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMainCounterAndCalendarTab() {
    int years = _duration.inDays ~/ 365;
    int months = (_duration.inDays % 365) ~/ 30;
    int days = (_duration.inDays % 365) % 30;
    int hours = _duration.inHours % 24;
    int minutes = _duration.inMinutes % 60;
    int seconds = _duration.inSeconds % 60;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          // Couples Profile Header Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.08),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white24),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainState.center,
                  children: [
                    const CircleAvatar(radius: 30, backgroundColor: Color(0xFFFF2A6D), child: Text('❤️', fontSize: 24)),
                    const SizedBox(width: 16),
                    const Icon(Icons.favorite, color: Color(0xFFFF2A6D), size: 30),
                    const SizedBox(width: 16),
                    const CircleAvatar(radius: 30, backgroundColor: Color(0xFFFF2A6D), child: Text('💖', fontSize: 24)),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  '$partner1 & $partner2',
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 4),
                Text(
                  'Birliktelik Başlangıcı: ${startDate.day}.${startDate.month}.${startDate.year}',
                  style: const TextStyle(fontSize: 13, color: Colors.white70),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          const Text(
            '❤️ Birlikte Geçen Her An ❤️',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFFFF85A2)),
          ),
          const SizedBox(height: 16),

          // 5 Live Glowing Heart Counters (YIL, AY, GÜN, SAAT, DK)
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            children: [
              _buildHeartCard('$years', 'YIL'),
              _buildHeartCard('$months', 'AY'),
              _buildHeartCard('$days', 'GÜN'),
              _buildHeartCard(hours.toString().padLeft(2, '0'), 'SAAT'),
              _buildHeartCard(minutes.toString().padLeft(2, '0'), 'DK'),
              _buildHeartCard(seconds.toString().padLeft(2, '0'), 'SANİYE'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeartCard(String value, String label) {
    return CustomPaint(
      painter: HeartPainter(),
      child: Center(
        child: Column(
          mainAxisAlignment: MainState.center,
          children: [
            Text(
              value,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            Text(
              label,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFFFB703)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMemoriesTimelineTab() {
    return Center(
      child: Column(
        mainAxisAlignment: MainState.center,
        children: const [
          Icon(Icons.photo_library, size: 60, color: Color(0xFFFF2A6D)),
          SizedBox(height: 12),
          Text('Anı Galerisi & Fotoğraf Günlüğü', style: TextStyle(fontSize: 18, color: Colors.white)),
        ],
      ),
    );
  }

  Widget _buildFuturePlansTab() {
    return Center(
      child: Column(
        mainAxisAlignment: MainState.center,
        children: const [
          Icon(Icons.flight_takeoff, size: 60, color: Color(0xFFFFB703)),
          SizedBox(height: 12),
          Text('Gelecek Planları & Tatiller', style: TextStyle(fontSize: 18, color: Colors.white)),
        ],
      ),
    );
  }

  Widget _buildNotesTab() {
    return Center(
      child: Column(
        mainAxisAlignment: MainState.center,
        children: const [
          Icon(Icons.alarm, size: 60, color: Color(0xFF05D9E8)),
          SizedBox(height: 12),
          Text('Özel Notlarım & Hatırlatıcı Alarmlar', style: TextStyle(fontSize: 18, color: Colors.white)),
        ],
      ),
    );
  }

  void _showSettingsDialog(BuildContext context) {
    final p1Ctrl = TextEditingController(text: partner1);
    final p2Ctrl = TextEditingController(text: partner2);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('İlişki Ayarları'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: p1Ctrl, decoration: const InputDecoration(labelText: '1. Kişi İsim')),
            TextField(controller: p2Ctrl, decoration: const InputDecoration(labelText: '2. Kişi İsim')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('İptal')),
          ElevatedButton(
            onPressed: () {
              setState(() {
                partner1 = p1Ctrl.text;
                partner2 = p2Ctrl.text;
              });
              Navigator.pop(ctx);
            },
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
  }
}
