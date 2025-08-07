<?php
// Discord Moderatör Takvim Sistemi - Güvenlik Katmanı
// XSS, CSRF, SQL Injection ve diğer güvenlik açıklarına karşı koruma

class Security {
    private static $instance = null;
    private $maxLoginAttempts = 5;
    private $lockoutTime = 1800; // 30 dakika
    
    private function __construct() {
        // Güvenlik başlıkları
        $this->setSecurityHeaders();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    // Güvenlik başlıklarını ayarla
    private function setSecurityHeaders() {
        // XSS koruması
        header('X-XSS-Protection: 1; mode=block');
        
        // Content type sniffing koruması
        header('X-Content-Type-Options: nosniff');
        
        // Clickjacking koruması
        header('X-Frame-Options: DENY');
        
        // HTTPS zorlama (production'da)
        if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
        
        // Content Security Policy
        header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: https:;");
        
        // Referrer policy
        header('Referrer-Policy: strict-origin-when-cross-origin');
    }
    
    // XSS koruması - HTML karakterleri escape et
    public static function escapeHtml($string) {
        return htmlspecialchars($string, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    
    // SQL Injection koruması - input temizle
    public static function sanitizeInput($input) {
        if (is_array($input)) {
            return array_map([self::class, 'sanitizeInput'], $input);
        }
        
        $input = trim($input);
        $input = stripslashes($input);
        return $input;
    }
    
    // CSRF token oluştur
    public static function generateCSRFToken() {
        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }
    
    // CSRF token doğrula
    public static function verifyCSRFToken($token) {
        return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
    }
    
    // Güçlü şifre kontrolü
    public static function isStrongPassword($password) {
        if (strlen($password) < 8) return false;
        if (!preg_match('/[A-Z]/', $password)) return false; // Büyük harf
        if (!preg_match('/[a-z]/', $password)) return false; // Küçük harf
        if (!preg_match('/[0-9]/', $password)) return false; // Rakam
        if (!preg_match('/[^A-Za-z0-9]/', $password)) return false; // Özel karakter
        return true;
    }
    
    // Şifre hash'le
    public static function hashPassword($password) {
        return password_hash($password, PASSWORD_ARGON2ID, [
            'memory_cost' => 65536, // 64 MB
            'time_cost' => 4,       // 4 iterations
            'threads' => 3          // 3 threads
        ]);
    }
    
    // Şifre doğrula
    public static function verifyPassword($password, $hash) {
        return password_verify($password, $hash);
    }
    
    // Brute force koruması
    public function checkLoginAttempts($username, $ip) {
        global $db;
        
        try {
            // Son 1 saatteki başarısız giriş denemelerini kontrol et
            $attempts = $db->fetch(
                "SELECT COUNT(*) as count, MAX(attempted_at) as last_attempt 
                 FROM login_attempts 
                 WHERE (username = ? OR ip_address = ?) 
                 AND success = FALSE 
                 AND attempted_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
                [$username, $ip]
            );
            
            if ($attempts && $attempts['count'] >= $this->maxLoginAttempts) {
                $lockoutEnd = strtotime($attempts['last_attempt']) + $this->lockoutTime;
                if (time() < $lockoutEnd) {
                    $remainingTime = ceil(($lockoutEnd - time()) / 60);
                    throw new Exception("Çok fazla başarısız giriş denemesi. $remainingTime dakika sonra tekrar deneyin.");
                }
            }
            
            return true;
        } catch (Exception $e) {
            error_log("Login attempt check error: " . $e->getMessage());
            throw $e;
        }
    }
    
    // Giriş denemesini kaydet
    public function logLoginAttempt($username, $ip, $success, $userAgent = '') {
        global $db;
        
        try {
            $db->execute(
                "INSERT INTO login_attempts (username, ip_address, success, user_agent, attempted_at) 
                 VALUES (?, ?, ?, ?, NOW())",
                [$username, $ip, $success ? 1 : 0, $userAgent]
            );
            
            // Eski kayıtları temizle (7 günden eski)
            $db->execute(
                "DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
            );
        } catch (Exception $e) {
            error_log("Login attempt logging error: " . $e->getMessage());
        }
    }
    
    // Rate limiting
    public function checkRateLimit($ip, $action = 'general', $maxRequests = 60, $timeWindow = 3600) {
        global $db;
        
        try {
            // Tablonun var olup olmadığını kontrol et, yoksa oluştur
            $db->execute("
                CREATE TABLE IF NOT EXISTS rate_limits (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ip_address VARCHAR(45) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    request_count INT DEFAULT 1,
                    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ip_action (ip_address, action),
                    INDEX idx_window_start (window_start)
                )
            ");
            
            $current = $db->fetch(
                "SELECT request_count, window_start 
                 FROM rate_limits 
                 WHERE ip_address = ? AND action = ? 
                 AND window_start > DATE_SUB(NOW(), INTERVAL ? SECOND)",
                [$ip, $action, $timeWindow]
            );
            
            if ($current) {
                if ($current['request_count'] >= $maxRequests) {
                    throw new Exception("Rate limit aşıldı. Lütfen daha sonra tekrar deneyin.");
                }
                
                // Sayacı artır
                $db->execute(
                    "UPDATE rate_limits 
                     SET request_count = request_count + 1 
                     WHERE ip_address = ? AND action = ? 
                     AND window_start > DATE_SUB(NOW(), INTERVAL ? SECOND)",
                    [$ip, $action, $timeWindow]
                );
            } else {
                // Yeni kayıt oluştur
                $db->execute(
                    "INSERT INTO rate_limits (ip_address, action, request_count) 
                     VALUES (?, ?, 1)",
                    [$ip, $action]
                );
            }
            
            // Eski kayıtları temizle
            $db->execute(
                "DELETE FROM rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL ? SECOND)",
                [$timeWindow * 2]
            );
            
            return true;
        } catch (Exception $e) {
            if (strpos($e->getMessage(), 'Rate limit') === 0) {
                throw $e;
            }
            error_log("Rate limit check error: " . $e->getMessage());
            return true; // Hata durumunda geçiş ver
        }
    }
    
    // IP adresini al (proxy arkasında da çalışır)
    public static function getRealIpAddr() {
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            return $_SERVER['HTTP_CLIENT_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            return $_SERVER['HTTP_X_FORWARDED_FOR'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED'])) {
            return $_SERVER['HTTP_X_FORWARDED'];
        } elseif (!empty($_SERVER['HTTP_FORWARDED_FOR'])) {
            return $_SERVER['HTTP_FORWARDED_FOR'];
        } elseif (!empty($_SERVER['HTTP_FORWARDED'])) {
            return $_SERVER['HTTP_FORWARDED'];
        } else {
            return $_SERVER['REMOTE_ADDR'];
        }
    }
    
    // Session güvenliğini artır
    public static function secureSession() {
        // Session cookie ayarları
        ini_set('session.cookie_httponly', 1);
        ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) ? 1 : 0);
        ini_set('session.cookie_samesite', 'Strict');
        ini_set('session.use_strict_mode', 1);
        ini_set('session.gc_maxlifetime', 3600); // 1 saat
        
        // Session ID'yi düzenli olarak yenile
        if (!isset($_SESSION['last_regeneration'])) {
            $_SESSION['last_regeneration'] = time();
        } elseif (time() - $_SESSION['last_regeneration'] > 300) { // 5 dakikada bir
            session_regenerate_id(true);
            $_SESSION['last_regeneration'] = time();
        }
    }
    
    // Dosya yükleme güvenliği
    public static function validateFileUpload($file, $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'], $maxSize = 2097152) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('Dosya yükleme hatası.');
        }
        
        if ($file['size'] > $maxSize) {
            throw new Exception('Dosya boyutu çok büyük.');
        }
        
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedTypes)) {
            throw new Exception('Geçersiz dosya türü.');
        }
        
        // MIME type kontrolü
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        $allowedMimes = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg', 
            'png' => 'image/png',
            'gif' => 'image/gif'
        ];
        
        if (!isset($allowedMimes[$extension]) || $allowedMimes[$extension] !== $mimeType) {
            throw new Exception('Dosya türü uyuşmazlığı.');
        }
        
        return true;
    }
    
    // SQL Injection'a karşı ek koruma
    public static function detectSQLInjection($input) {
        $sqlPatterns = [
            '/(\s*(union|select|insert|update|delete|drop|create|alter|exec|execute)\s+)/i',
            '/(\'|\"|;|--|\#|\*|\|)/i',
            '/(\s*(or|and)\s+\d+\s*=\s*\d+)/i'
        ];
        
        foreach ($sqlPatterns as $pattern) {
            if (preg_match($pattern, $input)) {
                error_log("Potential SQL injection detected: " . $input . " from IP: " . self::getRealIpAddr());
                throw new Exception('Geçersiz input tespit edildi.');
            }
        }
        
        return false;
    }
    
    // XSS saldırılarını tespit et
    public static function detectXSS($input) {
        $xssPatterns = [
            '/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/mi',
            '/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/mi',
            '/javascript:/i',
            '/on\w+\s*=/i'
        ];
        
        foreach ($xssPatterns as $pattern) {
            if (preg_match($pattern, $input)) {
                error_log("Potential XSS detected: " . $input . " from IP: " . self::getRealIpAddr());
                throw new Exception('Geçersiz input tespit edildi.');
            }
        }
        
        return false;
    }
}

// Güvenlik tablosunu oluştur
function createSecurityTables() {
    global $db;
    
    try {
        // Login attempts tablosu
        $db->execute("
            CREATE TABLE IF NOT EXISTS login_attempts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255),
                ip_address VARCHAR(45) NOT NULL,
                success BOOLEAN NOT NULL,
                user_agent TEXT,
                attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_username (username),
                INDEX idx_ip_address (ip_address),
                INDEX idx_attempted_at (attempted_at)
            )
        ");
        
        // Rate limits tablosu
        $db->execute("
            CREATE TABLE IF NOT EXISTS rate_limits (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ip_address VARCHAR(45) NOT NULL,
                action VARCHAR(50) NOT NULL,
                request_count INT DEFAULT 1,
                window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ip_action (ip_address, action),
                INDEX idx_window_start (window_start)
            )
        ");
        
    } catch (Exception $e) {
        error_log("Security tables creation error: " . $e->getMessage());
    }
}

// Güvenlik instance'ını başlat
$security = Security::getInstance();
Security::secureSession();

// Güvenlik tablolarını oluştur
createSecurityTables();
?> 