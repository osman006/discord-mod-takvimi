const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const moment = require('moment');

// Bot bileşenlerini import et
const Database = require('../database/database');
const config = require('../utils/config');

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
        secure: false, // HTTPS için true yapın
        maxAge: 24 * 60 * 60 * 1000 // 24 saat
    }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Routes
app.get('/', requireAuth, async (req, res) => {
    try {
        // Dashboard verileri
        const moderators = await database.getActiveModerators();
        const today = moment().format('YYYY-MM-DD');
        const todayAssignments = await database.getDailyAssignments(today);
        const todayExcuses = await database.getDailyExcuses(today);
        
        // İstatistikler
        const stats = {
            totalModerators: moderators.length,
            todayAssignments: todayAssignments.length,
            todayExcuses: todayExcuses.length,
            emptySlots: 5 - todayAssignments.length
        };

        res.render('dashboard', {
            title: 'Moderatör Yönetim Paneli',
            stats,
            moderators,
            todayAssignments,
            todayExcuses,
            today,
            moment
        });
    } catch (error) {
        console.error('Dashboard yükleme hatası:', error);
        res.render('error', { error: 'Dashboard yüklenemedi' });
    }
});

// Login sayfası
app.get('/login', (req, res) => {
    res.render('login', { title: 'Giriş Yap', error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Basit admin kontrolü (geliştirilmeli)
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (username === adminUsername && password === adminPassword) {
        req.session.authenticated = true;
        req.session.username = username;
        res.redirect('/');
    } else {
        res.render('login', { 
            title: 'Giriş Yap', 
            error: 'Kullanıcı adı veya şifre hatalı!' 
        });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Takvim yönetimi
app.get('/calendar', requireAuth, async (req, res) => {
    try {
        const selectedDate = req.query.date || moment().format('YYYY-MM-DD');
        const assignments = await database.getDailyAssignments(selectedDate);
        const excuses = await database.getDailyExcuses(selectedDate);
        const moderators = await database.getActiveModerators();

        res.render('calendar', {
            title: 'Takvim Yönetimi',
            selectedDate,
            assignments,
            excuses,
            moderators,
            moment
        });
    } catch (error) {
        console.error('Takvim yükleme hatası:', error);
        res.render('error', { error: 'Takvim yüklenemedi' });
    }
});

// Moderatör yönetimi
app.get('/moderators', requireAuth, async (req, res) => {
    try {
        const moderators = await database.getActiveModerators();
        const permanentShifts = await database.getAllPermanentShifts();
        
        res.render('moderators', {
            title: 'Moderatör Yönetimi',
            moderators,
            permanentShifts,
            moment
        });
    } catch (error) {
        console.error('Moderatör listesi yükleme hatası:', error);
        res.render('error', { error: 'Moderatör listesi yüklenemedi' });
    }
});

// Veritabanı araçları
app.get('/database', requireAuth, async (req, res) => {
    try {
        res.render('database', {
            title: 'Veritabanı Araçları'
        });
    } catch (error) {
        console.error('Veritabanı araçları yükleme hatası:', error);
        res.render('error', { error: 'Veritabanı araçları yüklenemedi' });
    }
});

// API Endpoints
app.post('/api/schedule/create', requireAuth, async (req, res) => {
    try {
        const { date } = req.body;
        
        // Yeni takvim oluşturma işlemi
        // Bu kısım bot'un AutoScheduleManager'ını kullanabilir
        
        res.json({ success: true, message: 'Takvim oluşturuldu' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/assignment/manual', requireAuth, async (req, res) => {
    try {
        const { date, userId, slotId } = req.body;
        
        await database.assignToSlot(date, userId, slotId, 'manual_web');
        
        // Socket.io ile gerçek zamanlı güncelleme
        io.emit('assignment_updated', { date, userId, slotId });
        
        res.json({ success: true, message: 'Atama başarılı' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.delete('/api/assignment/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Atama silme işlemi
        await database.deleteAssignment(id);
        
        io.emit('assignment_deleted', { id });
        
        res.json({ success: true, message: 'Atama silindi' });
    } catch (error) {
        res.json({ success: false, error: error.message });
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