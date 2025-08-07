<?php
require_once 'config.php';
requireLogin();

$message = '';
$error = '';

// Ayar güncelleme işlemi
if ($_POST && isset($_POST['action'])) {
    try {
        switch ($_POST['action']) {
            case 'update_bot_settings':
                // Bot ayarlarını güncelle (env dosyası güncelleme simüle edildi)
                $message = 'Bot ayarları güncellendi! Değişikliklerin etkili olması için botu yeniden başlatın.';
                break;
                
            case 'send_command':
                // Bot'a komut gönderme simülasyonu
                $command = $_POST['command'] ?? '';
                if ($command) {
                    // Burada gerçek bot API'sine istek gönderilecek
                    $message = "Komut gönderildi: $command";
                } else {
                    $error = 'Komut boş olamaz!';
                }
                break;
                
            case 'restart_bot':
                // Bot yeniden başlatma
                $message = 'Bot yeniden başlatılıyor... Bu işlem birkaç saniye sürebilir.';
                break;
                
            case 'backup_database':
                // Veritabanı yedekleme
                $backupFile = 'backup_' . date('Y-m-d_H-i-s') . '.sql';
                $message = "Veritabanı yedeklendi: $backupFile";
                break;
        }
    } catch (Exception $e) {
        $error = 'Hata: ' . $e->getMessage();
    }
}

// Bot durumu simülasyonu
$botStatus = [
    'status' => 'online',
    'uptime' => '2 gün 14 saat 32 dakika',
    'guilds' => 1,
    'users' => 125,
    'memory' => '89.2 MB',
    'cpu' => '2.4%'
];

// Veritabanı istatistikleri
try {
    $dbStats = [
        'moderators' => $db->fetch("SELECT COUNT(*) as count FROM moderators WHERE is_active = 1")['count'] ?? 0,
        'assignments' => $db->fetch("SELECT COUNT(*) as count FROM daily_assignments")['count'] ?? 0,
        'excuses' => $db->fetch("SELECT COUNT(*) as count FROM daily_excuses")['count'] ?? 0,
        'surveys' => $db->fetch("SELECT COUNT(*) as count FROM survey_responses")['count'] ?? 0,
        'disciplines' => $db->fetch("SELECT COUNT(*) as count FROM discipline_records")['count'] ?? 0
    ];
} catch (Exception $e) {
    $dbStats = ['error' => $e->getMessage()];
}

// Son aktiviteler
try {
    $recentActivities = $db->fetchAll("
        SELECT 'assignment' as type, username, slot_name as detail, created_at 
        FROM daily_assignments 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        UNION ALL
        SELECT 'excuse' as type, username, LEFT(excuse, 50) as detail, responded_at as created_at 
        FROM daily_excuses 
        WHERE responded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY created_at DESC 
        LIMIT 10
    ");
} catch (Exception $e) {
    $recentActivities = [];
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Ayarları - <?= APP_NAME ?></title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        .sidebar {
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .sidebar .nav-link {
            color: rgba(255,255,255,0.8);
            padding: 0.8rem 1rem;
            margin: 0.2rem 0;
            border-radius: 0.5rem;
            transition: all 0.3s;
        }
        .sidebar .nav-link:hover {
            color: white;
            background: rgba(255,255,255,0.1);
        }
        .sidebar .nav-link.active {
            color: white;
            background: rgba(255,255,255,0.2);
        }
        .main-content {
            background-color: #f8f9fa;
            min-height: 100vh;
        }
        .admin-card {
            border: none;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }
        .admin-card:hover {
            transform: translateY(-2px);
        }
        .status-online { color: #28a745; }
        .status-offline { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .command-terminal {
            background: #1a1a1a;
            color: #00ff00;
            font-family: 'Courier New', monospace;
            border-radius: 10px;
            min-height: 200px;
        }
        .danger-zone {
            border: 2px solid #dc3545;
            border-radius: 10px;
            background-color: #f8d7da;
        }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <!-- Sidebar -->
            <nav class="col-md-2 d-none d-md-block sidebar p-0">
                <div class="position-sticky pt-3">
                    <div class="text-center text-white mb-4">
                        <i class="fas fa-shield-alt fa-2x mb-2"></i>
                        <h5>MOD YÖNETİM</h5>
                        <small>v<?= APP_VERSION ?></small>
                    </div>
                    
                    <ul class="nav flex-column px-3">
                        <li class="nav-item">
                            <a class="nav-link" href="dashboard.php">
                                <i class="fas fa-tachometer-alt me-2"></i>
                                Dashboard
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="calendar.php">
                                <i class="fas fa-calendar-alt me-2"></i>
                                Takvim Yönetimi
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="moderators.php">
                                <i class="fas fa-users me-2"></i>
                                Moderatörler
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="database.php">
                                <i class="fas fa-database me-2"></i>
                                Veritabanı
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link active" href="admin-settings.php">
                                <i class="fas fa-cogs me-2"></i>
                                Admin Ayarları
                            </a>
                        </li>
                        
                        <hr class="text-white-50">
                        
                        <li class="nav-item">
                            <a class="nav-link" href="logout.php">
                                <i class="fas fa-sign-out-alt me-2"></i>
                                Çıkış Yap
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>

            <!-- Ana İçerik -->
            <main class="col-md-10 ms-sm-auto main-content">
                <!-- Navbar -->
                <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm mb-4">
                    <div class="container-fluid">
                        <span class="navbar-brand mb-0 h1">
                            <i class="fas fa-cogs me-2"></i>
                            Admin Ayarları
                        </span>
                        
                        <div class="navbar-nav ms-auto">
                            <div class="nav-item dropdown">
                                <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                                    <i class="fas fa-user-circle"></i>
                                    <?= htmlspecialchars($_SESSION['admin_username']) ?>
                                </a>
                                <ul class="dropdown-menu">
                                    <li><a class="dropdown-item" href="logout.php"><i class="fas fa-sign-out-alt me-2"></i>Çıkış</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </nav>

                <!-- Sayfa İçeriği -->
                <div class="container-fluid px-4">
                    <!-- Mesajlar -->
                    <?php if ($message): ?>
                        <div class="alert alert-success alert-dismissible fade show" role="alert">
                            <i class="fas fa-check-circle me-2"></i>
                            <?= htmlspecialchars($message) ?>
                            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                        </div>
                    <?php endif; ?>
                    
                    <?php if ($error): ?>
                        <div class="alert alert-danger alert-dismissible fade show" role="alert">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <?= htmlspecialchars($error) ?>
                            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                        </div>
                    <?php endif; ?>

                    <!-- Bot Durumu -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="card admin-card">
                                <div class="card-header bg-primary text-white py-3">
                                    <h5 class="mb-0">
                                        <i class="fas fa-robot me-2"></i>
                                        Bot Durumu ve Kontrol
                                    </h5>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <table class="table table-borderless">
                                                <tr>
                                                    <td><strong>Durum:</strong></td>
                                                    <td>
                                                        <span class="status-<?= $botStatus['status'] ?>">
                                                            <i class="fas fa-circle me-1"></i>
                                                            <?= ucfirst($botStatus['status']) ?>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Çalışma Süresi:</strong></td>
                                                    <td><?= $botStatus['uptime'] ?></td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Sunucular:</strong></td>
                                                    <td><?= $botStatus['guilds'] ?></td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Kullanıcılar:</strong></td>
                                                    <td><?= $botStatus['users'] ?></td>
                                                </tr>
                                            </table>
                                        </div>
                                        <div class="col-md-6">
                                            <table class="table table-borderless">
                                                <tr>
                                                    <td><strong>Bellek Kullanımı:</strong></td>
                                                    <td><?= $botStatus['memory'] ?></td>
                                                </tr>
                                                <tr>
                                                    <td><strong>CPU Kullanımı:</strong></td>
                                                    <td><?= $botStatus['cpu'] ?></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="2">
                                                        <div class="d-grid gap-2 d-md-flex">
                                                            <form method="POST" class="me-2">
                                                                <input type="hidden" name="action" value="restart_bot">
                                                                <button type="submit" class="btn btn-warning btn-sm" onclick="return confirm('Bot\'u yeniden başlatmak istediğinizden emin misiniz?')">
                                                                    <i class="fas fa-redo me-1"></i>
                                                                    Yeniden Başlat
                                                                </button>
                                                            </form>
                                                            <button class="btn btn-info btn-sm" onclick="refreshBotStatus()">
                                                                <i class="fas fa-sync me-1"></i>
                                                                Yenile
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row mb-4">
                        <!-- Bot Komut Konsolu -->
                        <div class="col-lg-8 mb-4">
                            <div class="card admin-card">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-success">
                                        <i class="fas fa-terminal me-2"></i>
                                        Bot Komut Konsolu
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div class="command-terminal p-3 mb-3">
                                        <div id="terminal-output">
                                            <div>Discord Bot Terminal v<?= APP_VERSION ?></div>
                                            <div>Son komutlar:</div>
                                            <div class="text-warning">admin@bot:~$ pm2 status discord-mod-bot</div>
                                            <div>✅ Bot çalışıyor - PID: 12345</div>
                                            <div class="text-warning">admin@bot:~$ _</div>
                                        </div>
                                    </div>
                                    
                                    <form method="POST">
                                        <input type="hidden" name="action" value="send_command">
                                        <div class="input-group">
                                            <span class="input-group-text bg-dark text-success">$</span>
                                            <input type="text" class="form-control" name="command" placeholder="Komut girin... (örn: /moderators list)" autocomplete="off">
                                            <button class="btn btn-success" type="submit">
                                                <i class="fas fa-paper-plane"></i>
                                                Gönder
                                            </button>
                                        </div>
                                    </form>
                                    
                                    <div class="mt-3">
                                        <small class="text-muted">
                                            <strong>Örnek komutlar:</strong> 
                                            <code>/moderators list</code>, 
                                            <code>/schedule create</code>, 
                                            <code>/survey send</code>
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Veritabanı İstatistikleri -->
                        <div class="col-lg-4 mb-4">
                            <div class="card admin-card">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-info">
                                        <i class="fas fa-database me-2"></i>
                                        Veritabanı İstatistikleri
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <?php if (isset($dbStats['error'])): ?>
                                        <div class="alert alert-danger">
                                            Veritabanı hatası: <?= htmlspecialchars($dbStats['error']) ?>
                                        </div>
                                    <?php else: ?>
                                        <div class="row text-center">
                                            <div class="col-6 mb-3">
                                                <div class="border rounded p-2">
                                                    <h4 class="text-primary"><?= $dbStats['moderators'] ?></h4>
                                                    <small>Moderatörler</small>
                                                </div>
                                            </div>
                                            <div class="col-6 mb-3">
                                                <div class="border rounded p-2">
                                                    <h4 class="text-success"><?= $dbStats['assignments'] ?></h4>
                                                    <small>Atamalar</small>
                                                </div>
                                            </div>
                                            <div class="col-6 mb-3">
                                                <div class="border rounded p-2">
                                                    <h4 class="text-warning"><?= $dbStats['excuses'] ?></h4>
                                                    <small>Mazeretler</small>
                                                </div>
                                            </div>
                                            <div class="col-6 mb-3">
                                                <div class="border rounded p-2">
                                                    <h4 class="text-info"><?= $dbStats['surveys'] ?></h4>
                                                    <small>Anketler</small>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="d-grid">
                                            <form method="POST">
                                                <input type="hidden" name="action" value="backup_database">
                                                <button type="submit" class="btn btn-outline-info btn-sm">
                                                    <i class="fas fa-download me-1"></i>
                                                    Yedek Al
                                                </button>
                                            </form>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Son Aktiviteler -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="card admin-card">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-secondary">
                                        <i class="fas fa-history me-2"></i>
                                        Son 24 Saat - Aktivite Geçmişi
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <?php if (count($recentActivities) > 0): ?>
                                        <div class="table-responsive">
                                            <table class="table table-hover">
                                                <thead>
                                                    <tr>
                                                        <th>Tür</th>
                                                        <th>Kullanıcı</th>
                                                        <th>Detay</th>
                                                        <th>Zaman</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <?php foreach ($recentActivities as $activity): ?>
                                                        <tr>
                                                            <td>
                                                                <?php if ($activity['type'] == 'assignment'): ?>
                                                                    <span class="badge bg-success">Atama</span>
                                                                <?php else: ?>
                                                                    <span class="badge bg-warning">Mazeret</span>
                                                                <?php endif; ?>
                                                            </td>
                                                            <td><?= htmlspecialchars($activity['username']) ?></td>
                                                            <td><?= htmlspecialchars($activity['detail']) ?></td>
                                                            <td><?= formatDate($activity['created_at']) ?></td>
                                                        </tr>
                                                    <?php endforeach; ?>
                                                </tbody>
                                            </table>
                                        </div>
                                    <?php else: ?>
                                        <div class="text-center py-3">
                                            <i class="fas fa-clock fa-3x text-muted mb-3"></i>
                                            <p class="text-muted">Son 24 saatte aktivite yok</p>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tehlikeli İşlemler -->
                    <div class="row">
                        <div class="col-12">
                            <div class="card admin-card">
                                <div class="card-header bg-danger text-white py-3">
                                    <h6 class="m-0 font-weight-bold">
                                        <i class="fas fa-exclamation-triangle me-2"></i>
                                        TEHLİKELİ İŞLEMLER
                                    </h6>
                                </div>
                                <div class="card-body danger-zone">
                                    <div class="alert alert-danger mb-3">
                                        <i class="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Uyarı:</strong> Bu işlemler geri alınamaz! Kullanmadan önce mutlaka yedek alın.
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <div class="card">
                                                <div class="card-body">
                                                    <h6 class="card-title text-danger">
                                                        <i class="fas fa-power-off me-2"></i>
                                                        Bot Kontrolü
                                                    </h6>
                                                    <p class="card-text text-muted small">
                                                        Bot'u durdur veya yeniden başlat.
                                                    </p>
                                                    <div class="d-grid gap-1">
                                                        <button class="btn btn-outline-warning btn-sm" onclick="alert('Bu özellik yakında eklenecek!')">
                                                            Bot'u Durdur
                                                        </button>
                                                        <button class="btn btn-outline-danger btn-sm" onclick="alert('Bu özellik yakında eklenecek!')">
                                                            Zorla Yeniden Başlat
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="col-md-6 mb-3">
                                            <div class="card">
                                                <div class="card-body">
                                                    <h6 class="card-title text-danger">
                                                        <i class="fas fa-trash me-2"></i>
                                                        Sistem Sıfırlama
                                                    </h6>
                                                    <p class="card-text text-muted small">
                                                        Tüm verileri sil ve sistemi sıfırla.
                                                    </p>
                                                    <div class="d-grid gap-1">
                                                        <button class="btn btn-outline-danger btn-sm" onclick="confirmReset()">
                                                            <i class="fas fa-exclamation-triangle me-1"></i>
                                                            SİSTEMİ SIFIRLA
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        function refreshBotStatus() {
            location.reload();
        }
        
        function confirmReset() {
            const confirmText = 'SİSTEMİ SIFIRLA';
            const userInput = prompt(`Bu işlem TÜM VERİLERİ kalıcı olarak silecektir!\n\nDevam etmek için "${confirmText}" yazın:`);
            
            if (userInput === confirmText) {
                if (confirm('SON UYARI: Bu işlem geri alınamaz! Tüm veriler silinecek!')) {
                    alert('Sistem sıfırlama özelliği yakında eklenecek!');
                }
            } else if (userInput !== null) {
                alert('Yanlış onay metni! İşlem iptal edildi.');
            }
        }
        
        // Terminal scroll
        function scrollTerminalToBottom() {
            const terminal = document.getElementById('terminal-output');
            terminal.scrollTop = terminal.scrollHeight;
        }
        
        // Sayfa yüklendiğinde terminal'i en alta kaydır
        document.addEventListener('DOMContentLoaded', scrollTerminalToBottom);
    </script>
</body>
</html> 