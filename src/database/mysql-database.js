const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

class MySQLDatabase {
    constructor() {
        this.connection = null;
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'discord_user',
            password: process.env.DB_PASS || 'discord_pass_2024',
            database: process.env.DB_NAME || 'discord_mod_db',
            charset: 'utf8mb4',
            timezone: '+00:00',
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true,
            multipleStatements: true
        };
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection(this.config);
            console.log('✅ MySQL veritabanına bağlanıldı.');
            return true;
        } catch (error) {
            console.error('❌ MySQL bağlantı hatası:', error.message);
            throw error;
        }
    }

    async init() {
        if (!this.connection) {
            await this.connect();
        }

        try {
            // Tabloları oluştur
            await this.createTables();
            console.log('✅ MySQL tabloları hazır.');
        } catch (error) {
            console.error('❌ Tablo oluşturma hatası:', error);
            throw error;
        }
    }

    async createTables() {
        const createTablesSQL = `
            -- Moderatörler tablosu
            CREATE TABLE IF NOT EXISTS moderators (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL UNIQUE,
                username VARCHAR(255) NOT NULL,
                display_name VARCHAR(255),
                roles JSON,
                day_restriction BOOLEAN DEFAULT FALSE,
                night_restriction BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_active (is_active)
            );

            -- Moderatör yanıtları tablosu
            CREATE TABLE IF NOT EXISTS mod_responses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                period VARCHAR(255) NOT NULL,
                availability JSON,
                excuse TEXT,
                responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_period (user_id, period),
                INDEX idx_period (period)
            );

            -- Günlük atamalar tablosu
            CREATE TABLE IF NOT EXISTS daily_assignments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                slot_id VARCHAR(50) NOT NULL,
                slot_name VARCHAR(255) NOT NULL,
                assignment_type ENUM('automatic', 'manual', 'daily_survey', 'manual_web') DEFAULT 'automatic',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_date (date),
                INDEX idx_user_date (user_id, date),
                INDEX idx_slot_date (slot_id, date),
                UNIQUE KEY unique_slot_date (slot_id, date)
            );

            -- Günlük mazeretler tablosu
            CREATE TABLE IF NOT EXISTS daily_excuses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                period VARCHAR(255) NOT NULL,
                excuse TEXT NOT NULL,
                responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_period (user_id, period),
                INDEX idx_period (period),
                INDEX idx_date (responded_at)
            );

            -- Anket yanıtları tablosu
            CREATE TABLE IF NOT EXISTS survey_responses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                period VARCHAR(255) NOT NULL,
                availability JSON,
                response_type ENUM('available', 'excuse') DEFAULT 'available',
                responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_period (user_id, period),
                INDEX idx_period (period)
            );

            -- Disiplin kayıtları tablosu
            CREATE TABLE IF NOT EXISTS discipline_records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                violation_type ENUM('no_response', 'late_response', 'manual') DEFAULT 'no_response',
                period VARCHAR(255) NOT NULL,
                ban_days INT DEFAULT 0,
                ban_end_date TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_period (period),
                INDEX idx_ban_end (ban_end_date)
            );

            -- Sabit vardiyalar tablosu
            CREATE TABLE IF NOT EXISTS permanent_shifts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                slot_id VARCHAR(50) NOT NULL,
                slot_name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_slot_id (slot_id),
                INDEX idx_active (is_active)
            );

            -- Anket durumları tablosu
            CREATE TABLE IF NOT EXISTS survey_status (
                id INT AUTO_INCREMENT PRIMARY KEY,
                period VARCHAR(255) NOT NULL UNIQUE,
                status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
                survey_deadline TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_period (period),
                INDEX idx_status (status)
            );

            -- Ceza kayıtları tablosu
            CREATE TABLE IF NOT EXISTS punishment_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                reason TEXT NOT NULL,
                punishment_type ENUM('mod_ban', 'write_timeout', 'warning') DEFAULT 'warning',
                punishment_end TIMESTAMP NULL,
                violation_count INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_date (date),
                INDEX idx_punishment_end (punishment_end)
            );
        `;

        await this.connection.execute(createTablesSQL);
    }

    // SQLite uyumlu metodlar
    async run(sql, params = []) {
        try {
            const [result] = await this.connection.execute(sql, params);
            return {
                lastID: result.insertId || 0,
                changes: result.affectedRows || 0
            };
        } catch (error) {
            console.error('SQL run hatası:', error.message);
            throw error;
        }
    }

    async get(sql, params = []) {
        try {
            const [rows] = await this.connection.execute(sql, params);
            return rows[0] || null;
        } catch (error) {
            console.error('SQL get hatası:', error.message);
            throw error;
        }
    }

    async all(sql, params = []) {
        try {
            const [rows] = await this.connection.execute(sql, params);
            return rows || [];
        } catch (error) {
            console.error('SQL all hatası:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.connection) {
            try {
                await this.connection.end();
                console.log('✅ MySQL bağlantısı kapatıldı.');
            } catch (error) {
                console.error('MySQL kapatma hatası:', error.message);
            }
        }
    }

    // Moderatör işlemleri
    async addModerator(userId, username, displayName, roles) {
        const sql = `
            INSERT INTO moderators (user_id, username, display_name, roles, is_active) 
            VALUES (?, ?, ?, ?, TRUE)
            ON DUPLICATE KEY UPDATE 
                username = VALUES(username),
                display_name = VALUES(display_name),
                roles = VALUES(roles),
                updated_at = CURRENT_TIMESTAMP
        `;
        return await this.run(sql, [userId, username, displayName, JSON.stringify(roles)]);
    }

    async getActiveModerators() {
        const sql = 'SELECT * FROM moderators WHERE is_active = TRUE ORDER BY username';
        return await this.all(sql);
    }

    // Günlük atama işlemleri
    async getDailyAssignments(date) {
        const sql = `
            SELECT da.*, m.display_name 
            FROM daily_assignments da 
            LEFT JOIN moderators m ON da.user_id = m.user_id 
            WHERE da.date = ? 
            ORDER BY da.slot_id
        `;
        return await this.all(sql, [date]);
    }

    async assignToSlot(date, userId, slotId, assignmentType = 'manual') {
        const slotNames = {
            'slot1': '🌚 Gece Vardiyası (00:00-05:00)',
            'slot2': '🌅 Sabah Vardiyası (05:00-10:00)',
            'slot3': '☀️ Öğle Vardiyası (10:00-15:00)',
            'slot4': '🌤️ İkindi Vardiyası (15:00-20:00)',
            'slot5': '🌆 Akşam Vardiyası (20:00-24:00)'
        };

        // Kullanıcı bilgisini al
        const user = await this.get('SELECT username FROM moderators WHERE user_id = ?', [userId]);
        if (!user) {
            throw new Error('Moderatör bulunamadı');
        }

        const sql = `
            INSERT INTO daily_assignments (date, user_id, username, slot_id, slot_name, assignment_type) 
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                user_id = VALUES(user_id),
                username = VALUES(username),
                assignment_type = VALUES(assignment_type)
        `;
        
        return await this.run(sql, [
            date, userId, user.username, slotId, 
            slotNames[slotId] || 'Bilinmeyen Vardiya', 
            assignmentType
        ]);
    }

    // Mazeret işlemleri
    async getDailyExcuses(date) {
        const sql = `
            SELECT de.*, m.display_name 
            FROM daily_excuses de 
            LEFT JOIN moderators m ON de.user_id = m.user_id 
            WHERE DATE(de.responded_at) = ? 
            ORDER BY de.responded_at DESC
        `;
        return await this.all(sql, [date]);
    }

    async saveDailyExcuse(userId, username, date, excuse) {
        const sql = `
            INSERT INTO daily_excuses (user_id, username, period, excuse) 
            VALUES (?, ?, ?, ?)
        `;
        return await this.run(sql, [userId, username, `daily_${date}`, excuse]);
    }

    // Anket işlemleri
    async saveSurveyResponse(userId, username, period, availability) {
        const sql = `
            INSERT INTO survey_responses (user_id, username, period, availability, response_type) 
            VALUES (?, ?, ?, ?, 'available')
            ON DUPLICATE KEY UPDATE 
                availability = VALUES(availability),
                responded_at = CURRENT_TIMESTAMP
        `;
        return await this.run(sql, [userId, username, period, JSON.stringify(availability)]);
    }

    // İstatistikler
    async getStats() {
        const stats = {};
        
        stats.totalModerators = (await this.get('SELECT COUNT(*) as count FROM moderators WHERE is_active = 1'))?.count || 0;
        stats.totalAssignments = (await this.get('SELECT COUNT(*) as count FROM daily_assignments'))?.count || 0;
        stats.totalExcuses = (await this.get('SELECT COUNT(*) as count FROM daily_excuses'))?.count || 0;
        stats.totalSurveys = (await this.get('SELECT COUNT(*) as count FROM survey_responses'))?.count || 0;
        
        return stats;
    }
}

module.exports = MySQLDatabase; 