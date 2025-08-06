require('dotenv').config();

const config = {
    // Discord Bot Ayarları
    discord: {
        token: process.env.DISCORD_TOKEN,
        guildId: process.env.GUILD_ID,
        adminModChannelId: process.env.ADMIN_MOD_CHANNEL_ID,
        modScheduleChannelId: process.env.MOD_SCHEDULE_CHANNEL_ID || process.env.ADMIN_MOD_CHANNEL_ID,
        logChannelId: process.env.LOG_CHANNEL_ID || process.env.ADMIN_MOD_CHANNEL_ID, // Ayrı log kanalı
        scheduleChannelId: process.env.SCHEDULE_CHANNEL_ID || process.env.MOD_SCHEDULE_CHANNEL_ID, // Ayrı takvim kanalı
        modRoles: process.env.MOD_ROLES ? process.env.MOD_ROLES.split(',').map(role => role.trim()) : ['MOD', 'SR MOD', 'ADMIN']
    },

    // Zamanlama Ayarları
    schedule: {
        surveyCron: process.env.SURVEY_CRON || '0 0 18 * * 0', // Her Pazar 18:00
        responseTimeoutHours: parseInt(process.env.RESPONSE_TIMEOUT_HOURS) || 24,
        autoScheduleEnabled: process.env.AUTO_SCHEDULE_ENABLED !== 'false', // Otomatik takvim açık
        dailyScheduleHour: parseInt(process.env.DAILY_SCHEDULE_HOUR) || 8, // Günlük takvim saati
        surveyTimeoutHours: parseInt(process.env.SURVEY_TIMEOUT_HOURS) || 5 // Günlük anket süresi
    },

    // Disiplin Ayarları
    discipline: {
        firstViolationDays: parseInt(process.env.FIRST_VIOLATION_DAYS) || 2, // İlk ihlal 2 gün
        secondViolationDays: parseInt(process.env.SECOND_VIOLATION_DAYS) || 1, // İkinci ihlal 1 saat
        thirdViolationDays: parseInt(process.env.THIRD_VIOLATION_DAYS) || 1, // Üçüncü ihlal 1 gün
        writeTimeoutMinutes: parseInt(process.env.WRITE_TIMEOUT_MINUTES) || 60 // Yazma banı süresi (dakika)
    },

    // Saat Aralıkları - 5 moderatör için 24 saat eşit dağılım
    timeSlots: process.env.TIME_SLOTS ? JSON.parse(process.env.TIME_SLOTS) : [
        "00:00-05:00",   // Vardiya 1: 5 saat - Gece
        "05:00-10:00",   // Vardiya 2: 5 saat - Sabah
        "10:00-15:00",   // Vardiya 3: 5 saat - Öğlen  
        "15:00-20:00",   // Vardiya 4: 5 saat - Öğleden Sonra
        "20:00-24:00"    // Vardiya 5: 4 saat - Akşam
    ],

    // Veritabanı Ayarları
    database: {
        path: process.env.DATABASE_PATH || './data/bot.db'
    },

    // Log Ayarları
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
};

// Zorunlu alanları kontrol et
const requiredFields = [
    'discord.token',
    'discord.guildId', 
    'discord.adminModChannelId'
];

for (const field of requiredFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], config);
    if (!value) {
        console.error(`❌ Zorunlu konfigürasyon eksik: ${field}`);
        process.exit(1);
    }
}

// Saat aralığı validasyonu
function validateTimeSlots(slots) {
    if (!Array.isArray(slots)) return false;
    
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-4]):[0-5][0-9]$/;
    
    return slots.every(slot => {
        if (typeof slot !== 'string') return false;
        
        const match = slot.match(timeRegex);
        if (!match) return false;
        
        const [, startHour, startMin, endHour, endMin] = match;
        const startTime = parseInt(startHour) * 60 + parseInt(startMin);
        let endTime = parseInt(endHour) * 60 + parseInt(endMin);
        
        // 24:00 durumunu handle et
        if (endHour === '24' && endMin === '00') {
            endTime = 24 * 60;
        }
        
        // Gece yarısını geçen durumları handle et
        if (endTime <= startTime && endHour !== '24') {
            endTime += 24 * 60;
        }
        
        return endTime > startTime;
    });
}

// if (!validateTimeSlots(config.timeSlots)) {
//     console.error('❌ Geçersiz saat aralığı formatı. Doğru format: "18:00-21:00"');
//     process.exit(1);
// }

// Hafta numarası hesapla (ISO 8601)
function getWeekNumber(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Dönem formatı oluştur (2025-W32)
function getCurrentPeriod() {
    const now = new Date();
    const year = now.getFullYear();
    const week = getWeekNumber(now);
    return `${year}-W${week.toString().padStart(2, '0')}`;
}

// Sonraki Pazar gününü bul
function getNextSunday() {
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);
    nextSunday.setHours(18, 0, 0, 0); // Pazar 18:00
    return nextSunday;
}

module.exports = {
    ...config,
    utils: {
        getCurrentPeriod,
        getNextSunday,
        getWeekNumber,
        validateTimeSlots
    }
}; 