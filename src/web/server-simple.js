const express = require('express');
const path = require('path');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

// Çevre değişkenlerini yükle
require('dotenv').config();

// Bot bileşenlerini import et
const Database = require('../database/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Veritabanı bağlantısı
const database = new Database();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Session yapılandırması - Production için optimize
app.use(session({
    secret: process.env.WEB_SESSION_SECRET || 'discord-mod-panel-secret-key-' + Date.now(),
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // HTTPS kullanıyorsanız true yapın
        maxAge: 24 * 60 * 60 * 1000, // 24 saat
        httpOnly: true // XSS koruması
    },
    name: 'discord-mod-session' // Varsayılan session adını değiştir
}));

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        next();
    } else {
        res.redirect('/login.html');
    }
};

// Ana sayfa - Dashboard
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Login sayfası
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login işlemi - .env'den bilgileri al
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    // .env dosyasından admin bilgilerini al
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    // Eğer .env'de yoksa hata ver
    if (!adminUsername || !adminPassword) {
        console.log('❌ Admin bilgileri .env dosyasında bulunamadı!');
        return res.json({ 
            success: false, 
            error: 'Sunucu yapılandırması eksik! Lütfen .env dosyasını kontrol edin.' 
        });
    }
    
    if (username === adminUsername && password === adminPassword) {
        req.session.authenticated = true;
        req.session.username = username;
        req.session.loginTime = new Date().toISOString();
        
        console.log(`📊 Admin Girişi - Kullanıcı: ${username} - IP: ${req.ip} - Zaman: ${req.session.loginTime}`);
        res.json({ success: true });
    } else {
        console.log(`❌ Başarısız giriş denemesi - Kullanıcı: ${username} - IP: ${req.ip}`);
        res.json({ success: false, error: 'Kullanıcı adı veya şifre hatalı!' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    const username = req.session.username;
    req.session.destroy((err) => {
        if (err) {
            console.log('Logout hatası:', err);
        } else {
            console.log(`📊 Admin Çıkışı - Kullanıcı: ${username}`);
        }
        res.json({ success: true });
    });
});

// Dashboard verileri API
app.get('/api/dashboard', requireAuth, async (req, res) => {
    try {
        const moderators = await database.getActiveModerators();
        const today = new Date().toISOString().split('T')[0];
        const todayAssignments = await database.getDailyAssignments(today);
        const todayExcuses = await database.getDailyExcuses(today);
        
        const stats = {
            totalModerators: moderators.length,
            todayAssignments: todayAssignments.length,
            todayExcuses: todayExcuses.length,
            emptySlots: 5 - todayAssignments.length
        };

        res.json({
            success: true,
            data: {
                stats,
                moderators,
                todayAssignments,
                todayExcuses,
                today
            }
        });
    } catch (error) {
        console.error('Dashboard API hatası:', error);
        res.json({ success: false, error: 'Dashboard verileri yüklenemedi' });
    }
});

// Veritabanı istatistikleri API
app.get('/api/database/stats', requireAuth, async (req, res) => {
    try {
        // Tablo sayılarını gerçek veritabanından al
        const moderatorsCount = await database.get('SELECT COUNT(*) as count FROM moderators WHERE is_active = 1');
        const assignmentsCount = await database.get('SELECT COUNT(*) as count FROM daily_assignments');
        const excusesCount = await database.get('SELECT COUNT(*) as count FROM daily_excuses');
        const surveysCount = await database.get('SELECT COUNT(*) as count FROM survey_responses');
        const permanentShiftsCount = await database.get('SELECT COUNT(*) as count FROM permanent_shifts');
        
        // Veritabanı boyutunu hesapla (SQLite dosyası)
        const fs = require('fs');
        const path = require('path');
        let dbSize = '0 MB';
        try {
            const dbPath = path.join(__dirname, '../../data/moderator_schedule.db');
            const stats = fs.statSync(dbPath);
            const fileSizeInBytes = stats.size;
            const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
            dbSize = `${fileSizeInMB} MB`;
        } catch (error) {
            console.log('Veritabanı dosya boyutu hesaplanamadı:', error.message);
        }
        
        // Son yedek tarihi (şimdilik simüle)
        const lastBackup = 'Hiç';
        
        res.json({
            success: true,
            data: {
                moderators: moderatorsCount?.count || 0,
                assignments: assignmentsCount?.count || 0,
                excuses: excusesCount?.count || 0,
                surveys: surveysCount?.count || 0,
                permanentShifts: permanentShiftsCount?.count || 0,
                dbSize,
                lastBackup,
                status: 'online'
            }
        });
    } catch (error) {
        console.error('Veritabanı istatistikleri hatası:', error);
        res.json({ success: false, error: 'Veritabanı istatistikleri yüklenemedi' });
    }
});

// Haftalık aktivite verisi API
app.get('/api/dashboard/weekly', requireAuth, async (req, res) => {
    try {
        // Son 7 günün verilerini al
        const weeklyData = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const assignments = await database.getDailyAssignments(dateStr);
            const excuses = await database.getDailyExcuses(dateStr);
            
            weeklyData.push({
                date: dateStr,
                day: date.toLocaleDateString('tr-TR', { weekday: 'long' }),
                assignments: assignments.length,
                excuses: excuses.length
            });
        }
        
        res.json({
            success: true,
            data: weeklyData
        });
    } catch (error) {
        console.error('Haftalık veri hatası:', error);
        res.json({ success: false, error: 'Haftalık veriler yüklenemedi' });
    }
});

// Takvim verileri API
app.get('/api/calendar', requireAuth, async (req, res) => {
    try {
        const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
        const assignments = await database.getDailyAssignments(selectedDate);
        const excuses = await database.getDailyExcuses(selectedDate);
        const moderators = await database.getActiveModerators();

        res.json({
            success: true,
            data: {
                selectedDate,
                assignments,
                excuses,
                moderators
            }
        });
    } catch (error) {
        console.error('Takvim API hatası:', error);
        res.json({ success: false, error: 'Takvim verileri yüklenemedi' });
    }
});

// Manuel atama API
app.post('/api/assignment/manual', requireAuth, async (req, res) => {
    try {
        const { date, userId, slotId } = req.body;
        
        await database.assignToSlot(date, userId, slotId, 'manual_web');
        
        // Socket.io ile gerçek zamanlı güncelleme
        io.emit('assignment_updated', { date, userId, slotId });
        
        res.json({ success: true, message: 'Atama başarılı' });
    } catch (error) {
        console.error('Manuel atama hatası:', error);
        res.json({ success: false, error: error.message });
    }
});

// Atama silme API
app.delete('/api/assignment/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Atama silme işlemi
        await database.run('DELETE FROM daily_assignments WHERE id = ?', [id]);
        
        io.emit('assignment_deleted', { id });
        
        res.json({ success: true, message: 'Atama silindi' });
    } catch (error) {
        console.error('Atama silme hatası:', error);
        res.json({ success: false, error: error.message });
    }
});

// Takvim oluşturma API
app.post('/api/schedule/create', requireAuth, async (req, res) => {
    try {
        const { date } = req.body;
        
        // Günlük takvim oluşturma işlemi
        const DailyModManager = require('../utils/dailyModManager');
        const dailyMod = new DailyModManager({ database, logger: console });
        
        const result = await dailyMod.sendDailyScheduleSurvey(date);
        
        if (result.success) {
            res.json({ success: true, message: `${date} için takvim oluşturuldu ve anket gönderildi` });
        } else {
            res.json({ success: false, error: result.error || 'Takvim oluşturulamadı' });
        }
    } catch (error) {
        console.error('Takvim oluşturma hatası:', error);
        res.json({ success: false, error: error.message });
    }
});

// Anket gönderme API
app.post('/api/survey/send', requireAuth, async (req, res) => {
    try {
        const { date, type } = req.body;
        
        if (type === 'daily') {
            const DailyModManager = require('../utils/dailyModManager');
            const dailyMod = new DailyModManager({ database, logger: console });
            
            const result = await dailyMod.sendDailyScheduleSurvey(date);
            
            if (result.success) {
                res.json({ success: true, message: `${date} için günlük anket gönderildi` });
            } else {
                res.json({ success: false, error: result.error || 'Anket gönderilemedi' });
            }
        } else {
            res.json({ success: false, error: 'Geçersiz anket türü' });
        }
    } catch (error) {
        console.error('Anket gönderme hatası:', error);
        res.json({ success: false, error: error.message });
    }
});

// Moderatör listesi API
app.get('/api/moderators', requireAuth, async (req, res) => {
    try {
        const moderators = await database.getActiveModerators();
        const permanentShifts = await database.getAllPermanentShifts();
        
        res.json({
            success: true,
            data: {
                moderators,
                permanentShifts
            }
        });
    } catch (error) {
        console.error('Moderatör listesi hatası:', error);
        res.json({ success: false, error: 'Moderatör listesi yüklenemedi' });
    }
});

// Socket.io bağlantıları
io.on('connection', (socket) => {
    console.log('Yeni web paneli bağlantısı:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Web paneli bağlantısı kesildi:', socket.id);
    });
});

// Sunucuyu başlat
const PORT = process.env.WEB_PORT || 6060;

async function startWebServer() {
    try {
        // Veritabanı bağlantısı ve optimizasyon
        await database.connect();
        await database.init();
        
        // SQLite optimizasyon ayarları
        await database.run('PRAGMA journal_mode = WAL;'); // Write-Ahead Logging
        await database.run('PRAGMA synchronous = NORMAL;'); // Daha hızlı yazma
        await database.run('PRAGMA cache_size = 10000;'); // Daha büyük cache
        await database.run('PRAGMA temp_store = MEMORY;'); // Temp veriler RAM'de
        await database.run('PRAGMA mmap_size = 268435456;'); // Memory mapping (256MB)
        
        console.log('🔧 SQLite optimizasyon ayarları uygulandı');
        
        // Admin bilgilerini kontrol et
        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (!adminUsername || !adminPassword) {
            console.log('⚠️  UYARI: .env dosyasında ADMIN_USERNAME veya ADMIN_PASSWORD bulunamadı!');
            console.log('📝 Lütfen .env dosyasına şu satırları ekleyin:');
            console.log('   ADMIN_USERNAME=admin');
            console.log('   ADMIN_PASSWORD=your_secure_password');
        } else {
            console.log(`👤 Admin kullanıcısı: ${adminUsername}`);
            console.log(`🔐 Şifre uzunluğu: ${adminPassword.length} karakter`);
        }
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 Web Yönetim Paneli başlatıldı: http://localhost:${PORT}`);
            console.log(`🔗 Dış erişim: http://YOUR_SERVER_IP:${PORT}`);
            console.log(`📊 Session süresi: 24 saat`);
            console.log(`🔒 Güvenlik: Session tabanlı authentication`);
        });
    } catch (error) {
        console.error('❌ Web sunucu başlatma hatası:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Web sunucu kapatılıyor...');
    await database.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Web sunucu kapatılıyor...');
    await database.close();
    process.exit(0);
});

startWebServer();

module.exports = { app, io }; 