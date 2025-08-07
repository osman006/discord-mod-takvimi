-- Discord Moderatör Takvim Sistemi - MySQL Kurulumu
-- Bu script veritabanını ve tabloları oluşturur

-- Veritabanı oluştur
CREATE DATABASE IF NOT EXISTS discord_mod_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Kullanıcı oluştur ve yetki ver
CREATE USER IF NOT EXISTS 'discord_user'@'localhost' IDENTIFIED BY 'discord_pass_2024';
GRANT ALL PRIVILEGES ON discord_mod_db.* TO 'discord_user'@'localhost';
FLUSH PRIVILEGES;

-- Veritabanını seç
USE discord_mod_db;

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

-- Örnek veri ekle (test için)
INSERT IGNORE INTO moderators (user_id, username, display_name, is_active) VALUES
('123456789', 'test_mod1', 'Test Moderator 1', TRUE),
('123456790', 'test_mod2', 'Test Moderator 2', TRUE),
('123456791', 'test_mod3', 'Test Moderator 3', TRUE);

-- Başarı mesajı
SELECT 'Discord Moderatör Veritabanı başarıyla kuruldu!' as message; 