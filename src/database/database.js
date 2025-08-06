const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor(dbPath = './data/bot.db') {
        this.dbPath = dbPath;
        this.db = null;
        
        // Data klasörünü oluştur
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Veritabanı bağlantı hatası:', err.message);
                    reject(err);
                } else {
                    console.log('SQLite veritabanına bağlanıldı.');
                    resolve();
                }
            });
        });
    }

    async init() {
        const createTables = `
            -- Moderatör yanıtları tablosu
            CREATE TABLE IF NOT EXISTS mod_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                period TEXT NOT NULL,
                availability TEXT, -- JSON format: ["18:00-21:00", "21:00-24:00"]
                excuse TEXT,
                responded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Disiplin kayıtları tablosu
            CREATE TABLE IF NOT EXISTS discipline_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                violation_type TEXT NOT NULL, -- 'no_response', 'late_response'
                period TEXT NOT NULL,
                ban_days INTEGER NOT NULL,
                ban_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                ban_end DATETIME NOT NULL,
                applied BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Anket dönemleri tablosu
            CREATE TABLE IF NOT EXISTS survey_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period TEXT UNIQUE NOT NULL, -- "2025-W32" formatında
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                survey_sent_at DATETIME,
                deadline DATETIME NOT NULL,
                published BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Moderatör bilgileri tablosu (cache)
            CREATE TABLE IF NOT EXISTS moderators (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                display_name TEXT,
                roles TEXT, -- JSON format: ["MOD", "SR MOD"]
                is_active BOOLEAN DEFAULT TRUE,
                day_restriction BOOLEAN DEFAULT FALSE, -- Gündüz yasağı
                night_restriction BOOLEAN DEFAULT FALSE, -- Gece yasağı
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Günlük vardiya atamaları tablosu (yeni slot sistemi)
            CREATE TABLE IF NOT EXISTS daily_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL, -- YYYY-MM-DD formatında
                user_id TEXT NOT NULL, -- Atanan moderatör
                slot_id TEXT NOT NULL, -- slot1, slot2, slot3, slot4, slot5
                slot_name TEXT NOT NULL, -- Vardiya adı ve saati
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                assignment_type TEXT DEFAULT 'automatic', -- automatic, manual
                assigned_by TEXT, -- Manuel atama yapan admin user_id
                UNIQUE(date, slot_id)
            );

            -- Kullanıcı zaman izinleri tablosu
            CREATE TABLE IF NOT EXISTS user_time_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                start_time TEXT NOT NULL, -- HH:MM formatında
                end_time TEXT NOT NULL, -- HH:MM formatında
                permission_type TEXT NOT NULL, -- 'allow' veya 'restrict'
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Kalıcı vardiya atamaları tablosu
            CREATE TABLE IF NOT EXISTS permanent_shifts (
                user_id TEXT PRIMARY KEY,
                slot_id TEXT NOT NULL, -- slot1, slot2, slot3, slot4, slot5
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Gelmeyen kullanıcılar tablosu (cezalı kullanıcılar)
            CREATE TABLE IF NOT EXISTS absent_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                date TEXT NOT NULL, -- YYYY-MM-DD formatında
                reason TEXT NOT NULL, -- 'no_response', 'no_show', 'late_response'
                punishment_type TEXT NOT NULL, -- 'warning', 'ban_2day', 'ban_1hour'
                punishment_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                punishment_end DATETIME NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                violation_count INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Otomatik takvim durumu tablosu
            CREATE TABLE IF NOT EXISTS schedule_status (
                date TEXT PRIMARY KEY, -- YYYY-MM-DD formatında
                status TEXT NOT NULL, -- 'pending', 'survey_sent', 'completed', 'failed'
                survey_sent_at DATETIME,
                survey_deadline DATETIME,
                completed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- İndeksler
            CREATE INDEX IF NOT EXISTS idx_responses_period ON mod_responses(period);
            CREATE INDEX IF NOT EXISTS idx_responses_user ON mod_responses(user_id);
            CREATE INDEX IF NOT EXISTS idx_discipline_user ON discipline_records(user_id);
            CREATE INDEX IF NOT EXISTS idx_discipline_period ON discipline_records(period);
            CREATE INDEX IF NOT EXISTS idx_moderators_active ON moderators(is_active);
            CREATE INDEX IF NOT EXISTS idx_time_permissions_user ON user_time_permissions(user_id);
            CREATE INDEX IF NOT EXISTS idx_absent_users_date ON absent_users(date);
            CREATE INDEX IF NOT EXISTS idx_absent_users_active ON absent_users(is_active);
            CREATE INDEX IF NOT EXISTS idx_schedule_status_date ON schedule_status(date);
        `;

        return new Promise((resolve, reject) => {
            this.db.exec(createTables, (err) => {
                if (err) {
                    console.error('Tablo oluşturma hatası:', err.message);
                    reject(err);
                } else {
                    console.log('Veritabanı tabloları hazır.');
                    resolve();
                }
            });
        });
    }

    // Moderatör yanıtı kaydet
    async saveModResponse(userId, username, period, availability, excuse = '') {
        const sql = `
            INSERT OR REPLACE INTO mod_responses 
            (user_id, username, period, availability, excuse, responded_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [userId, username, period, JSON.stringify(availability), excuse], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Dönem için yanıtları getir
    async getResponsesForPeriod(period) {
        const sql = `
            SELECT * FROM mod_responses 
            WHERE period = ? 
            ORDER BY responded_at ASC
        `;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [period], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        availability: JSON.parse(row.availability || '[]')
                    })));
                }
            });
        });
    }

    // Disiplin kaydı ekle
    async addDisciplineRecord(userId, username, violationType, period, banDays) {
        const banEnd = new Date();
        banEnd.setDate(banEnd.getDate() + banDays);
        
        const sql = `
            INSERT INTO discipline_records 
            (user_id, username, violation_type, period, ban_days, ban_end)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [userId, username, violationType, period, banDays, banEnd.toISOString()], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Kullanıcının ihlal sayısını getir
    async getViolationCount(userId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM discipline_records 
            WHERE user_id = ?
        `;
        
        return new Promise((resolve, reject) => {
            this.db.get(sql, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    // Anket dönemi kaydet
    async saveSurveyPeriod(period, startDate, endDate, deadline) {
        const sql = `
            INSERT OR REPLACE INTO survey_periods 
            (period, start_date, end_date, deadline, survey_sent_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [period, startDate, endDate, deadline], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Moderatör bilgilerini güncelle
    async updateModerator(userId, username, displayName, roles, dayRestriction = false, nightRestriction = false) {
        const sql = `
            INSERT OR REPLACE INTO moderators 
            (user_id, username, display_name, roles, day_restriction, night_restriction, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [userId, username, displayName, JSON.stringify(roles), dayRestriction, nightRestriction], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Moderatör kısıtlamalarını güncelle
    async updateModeratorRestrictions(userId, dayRestriction, nightRestriction) {
        const sql = `
            UPDATE moderators 
            SET day_restriction = ?, night_restriction = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [dayRestriction, nightRestriction, userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Günlük atama kaydet
    async saveDailyAssignment(date, dayMod1, dayMod2, nightMod1, nightMod2) {
        const sql = `
            INSERT OR REPLACE INTO daily_assignments 
            (date, day_mod_1, day_mod_2, night_mod_1, night_mod_2)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [date, dayMod1, dayMod2, nightMod1, nightMod2], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Günlük atamayı getir
    async getDailyAssignment(date) {
        const sql = `
            SELECT * FROM daily_assignments 
            WHERE date = ?
        `;
        
        return new Promise((resolve, reject) => {
            this.db.get(sql, [date], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Müsait moderatörleri getir (kısıtlamalara göre)
    async getAvailableModerators(shiftType) {
        const restrictionColumn = shiftType === 'day' ? 'day_restriction' : 'night_restriction';
        const sql = `
            SELECT * FROM moderators 
            WHERE is_active = TRUE AND ${restrictionColumn} = FALSE
            ORDER BY username ASC
        `;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        roles: JSON.parse(row.roles || '[]')
                    })));
                }
            });
        });
    }

    // Aktif moderatörleri getir
    async getActiveModerators() {
        const sql = `
            SELECT * FROM moderators 
            WHERE is_active = TRUE 
            ORDER BY username ASC
        `;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        roles: JSON.parse(row.roles || '[]')
                    })));
                }
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Veritabanı kapatma hatası:', err.message);
                    } else {
                        console.log('Veritabanı bağlantısı kapatıldı.');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Günlük slot atamaları için yeni fonksiyonlar
    async saveDailySlotAssignment(assignment) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO daily_assignments 
                (date, user_id, slot_id, slot_name, assigned_at, assignment_type, assigned_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                assignment.date,
                assignment.user_id,
                assignment.slot_id,
                assignment.slot_name,
                assignment.assigned_at,
                assignment.assignment_type || 'automatic',
                assignment.assigned_by || null
            );
            
            stmt.finalize((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getDailySlotAssignments(date) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM daily_assignments WHERE date = ? ORDER BY slot_id`,
                [date],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    async updateDailySlotAssignment(date, slotId, userId, assignmentType, assignedBy) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE daily_assignments 
                SET user_id = ?, assignment_type = ?, assigned_by = ?, assigned_at = ?
                WHERE date = ? AND slot_id = ?
            `);
            
            stmt.run(
                userId,
                assignmentType,
                assignedBy,
                new Date().toISOString(),
                date,
                slotId
            );
            
            stmt.finalize((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getSlotAssignments(period, slotId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM daily_assignments WHERE date LIKE ? AND slot_id = ?`,
                [`%${period}%`, slotId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    async getModerator(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM moderators WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || null);
                }
            );
        });
    }

    // Kullanıcı zaman izni ayarla
    async setUserTimePermission(userId, startTime, endTime, permissionType, description = '') {
        const sql = `
            INSERT OR REPLACE INTO user_time_permissions 
            (user_id, start_time, end_time, permission_type, description, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [userId, startTime, endTime, permissionType, description], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // Kalıcı vardiya ayarla
    async setPermanentShift(userId, slotId, description = '') {
        const sql = `
            INSERT OR REPLACE INTO permanent_shifts 
            (user_id, slot_id, description, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [userId, slotId, description], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // Kullanıcı vardiyasını değiştir
    async changeUserShift(userId, newSlotId, date, reason) {
        const sql = `
            UPDATE daily_assignments 
            SET slot_id = ?, slot_name = ?, assignment_type = 'manual_change'
            WHERE user_id = ? AND date = ?
        `;

        const slotNames = {
            'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
            'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
            'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
            'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
            'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
        };
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [newSlotId, slotNames[newSlotId], userId, date], function(err) {
                if (err) {
                    reject(err);
                } else if (this.changes === 0) {
                    resolve({ success: false, error: 'Bu tarih için atama bulunamadı' });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    // Moderatör ekle
    async addModerator(userId, username, displayName, roles) {
        const sql = `
            INSERT OR REPLACE INTO moderators 
            (user_id, username, display_name, roles, is_active, updated_at)
            VALUES (?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [userId, username, displayName, JSON.stringify(roles)], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // Tarih için takvimi sil
    async deleteScheduleForDate(date) {
        const sql = `DELETE FROM daily_assignments WHERE date = ?`;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [date], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    // Cezalı kullanıcıları getir
    async getPunishedUsers() {
        const sql = `
            SELECT * FROM absent_users 
            WHERE is_active = TRUE AND punishment_end > CURRENT_TIMESTAMP
            ORDER BY punishment_end ASC
        `;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // Ban kaldır
    async removeBan(userId) {
        const sql = `
            UPDATE absent_users 
            SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND is_active = TRUE
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [userId], function(err) {
                if (err) {
                    reject(err);
                } else if (this.changes === 0) {
                    resolve({ success: false, error: 'Aktif ban bulunamadı' });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    // Otomatik takvim durumu kaydet
    async saveScheduleStatus(date, status, surveyDeadline = null) {
        const sql = `
            INSERT OR REPLACE INTO schedule_status 
            (date, status, survey_sent_at, survey_deadline, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [date, status, surveyDeadline], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // Takvim durumu getir
    async getScheduleStatus(date) {
        const sql = `SELECT * FROM schedule_status WHERE date = ?`;
        
        return new Promise((resolve, reject) => {
            this.db.get(sql, [date], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    // Gelmeyen kullanıcı kaydet
    async recordAbsentUser(userId, username, date, reason, punishmentType, punishmentEnd) {
        // Önce mevcut ihlal sayısını kontrol et
        const countSql = `SELECT COUNT(*) as count FROM absent_users WHERE user_id = ? AND is_active = TRUE`;
        
        return new Promise((resolve, reject) => {
            this.db.get(countSql, [userId], (err, countRow) => {
                if (err) {
                    reject(err);
                    return;
                }

                const violationCount = (countRow?.count || 0) + 1;

                const insertSql = `
                    INSERT INTO absent_users 
                    (user_id, username, date, reason, punishment_type, punishment_end, violation_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                this.db.run(insertSql, [userId, username, date, reason, punishmentType, punishmentEnd, violationCount], function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, violationCount });
                });
            });
        });
    }

    // Kullanıcının kalıcı vardiyasını getir
    async getPermanentShift(userId) {
        const sql = `SELECT * FROM permanent_shifts WHERE user_id = ?`;
        
        return new Promise((resolve, reject) => {
            this.db.get(sql, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    // Kullanıcının zaman izinlerini getir
    async getUserTimePermissions(userId) {
        const sql = `SELECT * FROM user_time_permissions WHERE user_id = ? AND is_active = TRUE`;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // Bugün için takvim var mı kontrol et
    async hasScheduleForDate(date) {
        const sql = `SELECT COUNT(*) as count FROM daily_assignments WHERE date = ?`;
        
        return new Promise((resolve, reject) => {
            this.db.get(sql, [date], (err, row) => {
                if (err) reject(err);
                else resolve((row?.count || 0) > 0);
            });
        });
    }

    // Tarih için yanıtları getir
    async getResponsesForDate(date) {
        const sql = `
            SELECT * FROM mod_responses 
            WHERE period = ? 
            ORDER BY responded_at ASC
        `;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [date], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => ({
                    ...row,
                    availability: JSON.parse(row.availability || '[]')
                })));
            });
        });
    }

    // Süresi biten cezaları getir
    async getExpiredPunishments() {
        const sql = `
            SELECT * FROM absent_users 
            WHERE is_active = TRUE AND punishment_end <= CURRENT_TIMESTAMP
            ORDER BY punishment_end ASC
        `;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // Slot için atama getir
    async getAssignmentForSlot(date, slotId) {
        const sql = `SELECT * FROM daily_assignments WHERE date = ? AND slot_id = ?`;
        
        return new Promise((resolve, reject) => {
            this.db.get(sql, [date, slotId], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    // Slot'a ata
    async assignToSlot(date, userId, slotId, assignmentType = 'automatic') {
        const slotNames = {
            'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
            'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
            'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
            'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
            'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
        };

        const sql = `
            INSERT OR REPLACE INTO daily_assignments 
            (date, user_id, slot_id, slot_name, assignment_type)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, [date, userId, slotId, slotNames[slotId], assignmentType], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // Tüm kalıcı vardiyaları getir
    async getAllPermanentShifts() {
        const sql = `SELECT * FROM permanent_shifts`;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // Tarih için tüm atamaları getir
    async getAssignmentsForDate(date) {
        const sql = `SELECT * FROM daily_assignments WHERE date = ? ORDER BY slot_id ASC`;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [date], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // Moderatör bilgisi getir
    async getModerator(userId) {
        const sql = `SELECT * FROM moderators WHERE user_id = ?`;
        
        return new Promise((resolve, reject) => {
            this.db.get(sql, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row ? {
                    ...row,
                    roles: JSON.parse(row.roles || '[]')
                } : null);
            });
        });
    }

    // İhlal geçmişi getir
    async getViolationHistory(userId) {
        const sql = `
            SELECT * FROM absent_users 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // Kullanıcının belirli tarihteki atamalarını getir
    async getUserAssignmentsForDate(userId, date) {
        const sql = `
            SELECT * FROM daily_assignments 
            WHERE user_id = ? AND date = ?
            ORDER BY slot_id ASC
        `;
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, [userId, date], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
}

module.exports = Database; 