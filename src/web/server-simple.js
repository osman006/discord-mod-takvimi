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
        res.json({ success: true });
    } else {
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
        
        // Basit takvim oluşturma - tüm moderatörlere anket gönder
        const AutoScheduleManager = require('../utils/autoScheduleManager');
        const autoSchedule = new AutoScheduleManager({ database, logger: console });
        
        const result = await autoSchedule.createDailySchedule(date);
        
        if (result.success) {
            res.json({ success: true, message: 'Takvim oluşturuldu' });
        } else {
            res.json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Takvim oluşturma hatası:', error);
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
const PORT = process.env.WEB_PORT || 3000;

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