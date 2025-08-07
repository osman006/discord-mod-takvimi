<?php
require_once 'config.php';
requireLogin();

// Dashboard verilerini al
try {
    // İstatistikler
    $stats = [
        'totalModerators' => $db->fetch("SELECT COUNT(*) as count FROM moderators WHERE is_active = 1")['count'] ?? 0,
        'todayAssignments' => $db->fetch("SELECT COUNT(*) as count FROM daily_assignments WHERE DATE(created_at) = CURDATE()")['count'] ?? 0,
        'todayExcuses' => $db->fetch("SELECT COUNT(*) as count FROM daily_excuses WHERE DATE(responded_at) = CURDATE()")['count'] ?? 0,
        'totalSurveys' => $db->fetch("SELECT COUNT(*) as count FROM survey_responses")['count'] ?? 0
    ];
    
    $stats['emptySlots'] = 5 - $stats['todayAssignments'];
    
    // Bugünkü atamalar
    $todayAssignments = $db->fetchAll("
        SELECT da.*, m.username, m.display_name 
        FROM daily_assignments da 
        LEFT JOIN moderators m ON da.user_id = m.user_id 
        WHERE DATE(da.created_at) = CURDATE()
        ORDER BY da.slot_id
    ");
    
    // Bugünkü mazeretler
    $todayExcuses = $db->fetchAll("
        SELECT de.*, m.display_name 
        FROM daily_excuses de 
        LEFT JOIN moderators m ON de.user_id = m.user_id 
        WHERE DATE(de.responded_at) = CURDATE()
        ORDER BY de.responded_at DESC
    ");
    
} catch (Exception $e) {
    $error = "Veri yükleme hatası: " . $e->getMessage();
}

$today = date('Y-m-d');
$todayFormatted = date('d.m.Y');
?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - <?= APP_NAME ?></title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    
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
        .stats-card {
            border: none;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }
        .stats-card:hover {
            transform: translateY(-5px);
        }
        .navbar-brand {
            font-weight: bold;
            color: #667eea !important;
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
                            <a class="nav-link active" href="dashboard.php">
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
                        
                        <hr class="text-white-50">
                        
                        <li class="nav-item">
                            <a class="nav-link" href="logout.php">
                                <i class="fas fa-sign-out-alt me-2"></i>
                                Çıkış Yap
                            </a>
                        </li>
                    </ul>
                    
                    <!-- Bot Durumu -->
                    <div class="mt-4 px-3">
                        <div class="card bg-transparent border-light">
                            <div class="card-body text-white text-center">
                                <h6>Bot Durumu</h6>
                                <div>
                                    <i class="fas fa-circle text-success"></i>
                                    <small>Çevrimiçi</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <!-- Ana İçerik -->
            <main class="col-md-10 ms-sm-auto main-content">
                <!-- Navbar -->
                <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm mb-4">
                    <div class="container-fluid">
                        <span class="navbar-brand mb-0 h1">
                            <i class="fas fa-tachometer-alt me-2"></i>
                            Dashboard
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
                    <!-- İstatistik Kartları -->
                    <div class="row mb-4">
                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card stats-card bg-primary text-white">
                                <div class="card-body">
                                    <div class="row no-gutters align-items-center">
                                        <div class="col mr-2">
                                            <div class="text-xs font-weight-bold text-uppercase mb-1">Toplam Moderatör</div>
                                            <div class="h5 mb-0 font-weight-bold"><?= $stats['totalModerators'] ?></div>
                                        </div>
                                        <div class="col-auto">
                                            <i class="fas fa-users fa-2x opacity-75"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card stats-card bg-success text-white">
                                <div class="card-body">
                                    <div class="row no-gutters align-items-center">
                                        <div class="col mr-2">
                                            <div class="text-xs font-weight-bold text-uppercase mb-1">Bugünkü Atamalar</div>
                                            <div class="h5 mb-0 font-weight-bold"><?= $stats['todayAssignments'] ?></div>
                                        </div>
                                        <div class="col-auto">
                                            <i class="fas fa-calendar-check fa-2x opacity-75"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card stats-card bg-warning text-white">
                                <div class="card-body">
                                    <div class="row no-gutters align-items-center">
                                        <div class="col mr-2">
                                            <div class="text-xs font-weight-bold text-uppercase mb-1">Bugünkü Mazeretler</div>
                                            <div class="h5 mb-0 font-weight-bold"><?= $stats['todayExcuses'] ?></div>
                                        </div>
                                        <div class="col-auto">
                                            <i class="fas fa-exclamation-triangle fa-2x opacity-75"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card stats-card bg-danger text-white">
                                <div class="card-body">
                                    <div class="row no-gutters align-items-center">
                                        <div class="col mr-2">
                                            <div class="text-xs font-weight-bold text-uppercase mb-1">Boş Vardiyalar</div>
                                            <div class="h5 mb-0 font-weight-bold"><?= $stats['emptySlots'] ?></div>
                                        </div>
                                        <div class="col-auto">
                                            <i class="fas fa-clock fa-2x opacity-75"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <!-- Bugünkü Takvim -->
                        <div class="col-lg-8 mb-4">
                            <div class="card shadow">
                                <div class="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                                    <h6 class="m-0 font-weight-bold text-primary">
                                        <i class="fas fa-calendar-day me-2"></i>
                                        Bugünkü Takvim (<?= $todayFormatted ?>)
                                    </h6>
                                    <a href="calendar.php" class="btn btn-sm btn-primary">
                                        <i class="fas fa-edit me-1"></i>
                                        Düzenle
                                    </a>
                                </div>
                                <div class="card-body">
                                    <?php if (count($todayAssignments) > 0): ?>
                                        <div class="table-responsive">
                                            <table class="table table-hover">
                                                <thead>
                                                    <tr>
                                                        <th>Vardiya</th>
                                                        <th>Moderatör</th>
                                                        <th>Atama Türü</th>
                                                        <th>Durum</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <?php foreach ($todayAssignments as $assignment): ?>
                                                        <?php
                                                        $slotEmojis = [
                                                            'slot1' => '🌚',
                                                            'slot2' => '🌅', 
                                                            'slot3' => '☀️',
                                                            'slot4' => '🌤️',
                                                            'slot5' => '🌆'
                                                        ];
                                                        
                                                        $typeLabels = [
                                                            'automatic' => '<span class="badge bg-success">Otomatik</span>',
                                                            'manual_web' => '<span class="badge bg-primary">Web Manuel</span>',
                                                            'daily_survey' => '<span class="badge bg-info">Anket</span>',
                                                            'manual' => '<span class="badge bg-secondary">Manuel</span>'
                                                        ];
                                                        ?>
                                                        <tr>
                                                            <td>
                                                                <span class="me-2"><?= $slotEmojis[$assignment['slot_id']] ?? '⏰' ?></span>
                                                                <?= htmlspecialchars($assignment['slot_name']) ?>
                                                            </td>
                                                            <td>
                                                                <div class="d-flex align-items-center">
                                                                    <i class="fas fa-user-circle fa-lg text-primary me-2"></i>
                                                                    <div>
                                                                        <strong><?= htmlspecialchars($assignment['username']) ?></strong>
                                                                        <?php if ($assignment['display_name']): ?>
                                                                            <br><small class="text-muted"><?= htmlspecialchars($assignment['display_name']) ?></small>
                                                                        <?php endif; ?>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td><?= $typeLabels[$assignment['assignment_type']] ?? '<span class="badge bg-secondary">Bilinmeyen</span>' ?></td>
                                                            <td>
                                                                <span class="badge bg-success">
                                                                    <i class="fas fa-check me-1"></i>
                                                                    Atandı
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    <?php endforeach; ?>
                                                </tbody>
                                            </table>
                                        </div>
                                    <?php else: ?>
                                        <div class="text-center py-4">
                                            <i class="fas fa-calendar-times fa-3x text-muted mb-3"></i>
                                            <h5 class="text-muted">Bugün için henüz vardiya ataması yok</h5>
                                            <p class="text-muted">Hemen bir takvim oluşturun veya manuel atama yapın.</p>
                                            <a href="calendar.php" class="btn btn-primary">
                                                <i class="fas fa-plus me-2"></i>
                                                Takvim Oluştur
                                            </a>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Hızlı İşlemler & Mazeretler -->
                        <div class="col-lg-4">
                            <!-- Hızlı İşlemler -->
                            <div class="card shadow mb-4">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-primary">
                                        <i class="fas fa-bolt me-2"></i>
                                        Hızlı İşlemler
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div class="d-grid gap-2">
                                        <a href="calendar.php?action=create&date=<?= $today ?>" class="btn btn-success">
                                            <i class="fas fa-calendar-plus me-2"></i>
                                            Bugün İçin Takvim Oluştur
                                        </a>
                                        <a href="calendar.php?action=survey&date=<?= $today ?>" class="btn btn-primary">
                                            <i class="fas fa-paper-plane me-2"></i>
                                            Anket Gönder
                                        </a>
                                        <button class="btn btn-warning" onclick="alert('Bu özellik yakında eklenecek!')">
                                            <i class="fas fa-bullhorn me-2"></i>
                                            Duyuru Yap
                                        </button>
                                        <a href="database.php" class="btn btn-info">
                                            <i class="fas fa-database me-2"></i>
                                            Veritabanı Yedekle
                                        </a>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Bugünkü Mazeretler -->
                            <div class="card shadow">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-warning">
                                        <i class="fas fa-exclamation-circle me-2"></i>
                                        Bugünkü Mazeretler
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <?php if (count($todayExcuses) > 0): ?>
                                        <?php foreach ($todayExcuses as $excuse): ?>
                                            <div class="border-start border-warning border-4 ps-3 mb-3">
                                                <div class="d-flex align-items-center mb-2">
                                                    <i class="fas fa-user text-warning me-2"></i>
                                                    <strong><?= htmlspecialchars($excuse['username']) ?></strong>
                                                    <small class="text-muted ms-auto"><?= date('H:i', strtotime($excuse['responded_at'])) ?></small>
                                                </div>
                                                <p class="mb-0 small"><?= htmlspecialchars($excuse['excuse']) ?></p>
                                            </div>
                                        <?php endforeach; ?>
                                    <?php else: ?>
                                        <div class="text-center py-3">
                                            <i class="fas fa-check-circle fa-2x text-success mb-2"></i>
                                            <p class="mb-0 text-muted">Bugün mazeret bildiren yok!</p>
                                        </div>
                                    <?php endif; ?>
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
</body>
</html> 