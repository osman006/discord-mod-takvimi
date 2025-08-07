<?php
// Discord Moderatör Takvim Sistemi - PHP Web Panel
// Veritabanı ve Genel Ayarlar

// Production modunda hata raporlamayı kapat
if (getenv('APP_ENV') !== 'development') {
    error_reporting(0);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', __DIR__ . '/logs/php_errors.log');
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

// Güvenlik katmanını yükle
require_once 'security.php';

// Session başlat
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// MySQL Veritabanı Ayarları
define('DB_HOST', 'localhost');
define('DB_NAME', 'discord_mod_db');
define('DB_USER', 'discord_user');
define('DB_PASS', 'discord_pass_2024');

// Admin Giriş Bilgileri (.env'den alınacak)
define('ADMIN_USERNAME', getenv('ADMIN_USERNAME') ?: 'admin');
define('ADMIN_PASSWORD', getenv('ADMIN_PASSWORD') ?: 'admin123');

// Uygulama Ayarları
define('APP_NAME', 'Discord Mod Yönetim Paneli');
define('APP_VERSION', '2.0.0');
define('TIMEZONE', 'Europe/Istanbul');

// Zaman dilimini ayarla
date_default_timezone_set(TIMEZONE);

// Veritabanı Bağlantısı
class Database {
    private static $instance = null;
    private $connection;
    
    private function __construct() {
        try {
            $this->connection = new PDO(
                "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch (PDOException $e) {
            die("Veritabanı bağlantı hatası: " . $e->getMessage());
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    public function query($sql, $params = []) {
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
    
    public function fetch($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetch();
    }
    
    public function fetchAll($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }
    
    public function execute($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->rowCount();
    }
    
    public function lastInsertId() {
        return $this->connection->lastInsertId();
    }
}

// Yardımcı Fonksiyonlar
function isLoggedIn() {
    return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: login.php');
        exit;
    }
}

function redirect($url) {
    header("Location: $url");
    exit;
}

function formatDate($date) {
    return date('d.m.Y H:i', strtotime($date));
}

function formatDateOnly($date) {
    return date('d.m.Y', strtotime($date));
}

function jsonResponse($data) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function successResponse($message, $data = null) {
    jsonResponse([
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
}

function errorResponse($message, $code = 400) {
    http_response_code($code);
    jsonResponse([
        'success' => false,
        'error' => $message
    ]);
}

// CSRF Token Fonksiyonları
function generateCSRFToken() {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCSRFToken($token) {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

// Veritabanı instance'ını hazır et
$db = Database::getInstance();
?> 