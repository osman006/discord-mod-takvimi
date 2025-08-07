const express = require('express');
const path = require('path');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

// Bot bileşenlerini import et
const Database = require('../database/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Veritabanı bağlantısı
const database = new Database();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session yapılandırması
app.use(session({
    secret: process.env.WEB_SESSION_SECRET || 'discord-mod-panel-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 saat
    }
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

// Login işlemi
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (username === adminUsername && password === adminPassword) {
        req.session.authenticated = true;
        req.session.username = username;
        console.log(`📊 Admin Girişi - Kullanıcı: ${username}`);
        res.json({ success: true });
    } else {
        console.log(`❌ Başarısız giriş denemesi - Kullanıcı: ${username}`);
        res.json({ success: false, error: 'Kullanıcı adı veya şifre hatalı!' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
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
        await database.connect();
        await database.init();
        
        server.listen(PORT, () => {
            console.log(`🌐 Web Yönetim Paneli başlatıldı: http://localhost:${PORT}`);
            console.log(`📊 Admin Girişi - Kullanıcı: ${process.env.ADMIN_USERNAME || 'admin'}`);
        });
    } catch (error) {
        console.error('Web sunucu başlatma hatası:', error);
        process.exit(1);
    }
}

startWebServer();

module.exports = { app, io }; 