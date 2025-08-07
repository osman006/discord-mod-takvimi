# 🤖 Discord Moderatör Takvim Botu

Modern ve güvenli Discord moderatör çalışma takvimi otomasyonu. **MySQL veritabanı** ve **PHP web yönetim paneli** ile tam otomatik moderatör vardiya sistemi.

## ✨ Özellikler

### 🎯 **Ana Özellikler**
- ✅ **Otomatik Anket Sistemi** - Haftalık moderatör vardiya anketi
- ✅ **Akıllı Vardiya Dağılımı** - 5 vardiya (24 saat eşit dağıtım)
- ✅ **Disiplin Sistemi** - Otomatik ban/timeout sistemi
- ✅ **Gerçek Zamanlı Takip** - Moderatör aktivite monitoring
- ✅ **PHP Web Yönetim Paneli** - Komple bot kontrolü
- ✅ **MySQL Veritabanı** - Performanslı ve güvenli veri saklama

### 🛡️ **Güvenlik Özellikleri**
- 🔒 **XSS/CSRF Koruması** - Web panel güvenliği
- 🔒 **SQL Injection Koruması** - Veritabanı güvenliği  
- 🔒 **Brute Force Koruması** - Login attempt limiting
- 🔒 **Rate Limiting** - API abuse koruması
- 🔒 **Session Security** - Güvenli oturum yönetimi

### 📊 **Vardiya Sistemi**
```
🌚 Vardiya 1: 00:00-05:00 (Gece Yarısı)
🌅 Vardiya 2: 05:00-10:00 (Sabah)
☀️ Vardiya 3: 10:00-15:00 (Öğlen)
🌤️ Vardiya 4: 15:00-20:00 (Öğleden Sonra)
🌆 Vardiya 5: 20:00-24:00 (Akşam-Gece)
```

## 🚀 Hızlı Kurulum

### 1️⃣ **Sistem Gereksinimleri**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm mysql-server php-fpm php-mysql nginx -y

# Node.js 16+ gerekli
node --version  # v16.0.0+
```

### 2️⃣ **Projeyi İndirin**
```bash
git clone https://github.com/osman006/discord-mod-takvimi.git
cd discord-mod-takvimi
npm install
```

### 3️⃣ **MySQL Kurulumu**
```bash
# MySQL'i başlat
sudo systemctl start mysql
sudo systemctl enable mysql

# Veritabanı ve kullanıcı oluştur
mysql -u root -p < web-panel/install.sql
```

### 4️⃣ **Bot Yapılandırması**
```bash
# İnteraktif kurulum
npm run setup

# Veya manuel olarak
cp config.example.env .env
nano .env
```

### 5️⃣ **Web Panel Kurulumu**
```bash
# Web panel dosyalarını kopyala
sudo cp -r web-panel/ /var/www/html/

# Nginx yapılandır
sudo nano /etc/nginx/sites-available/discord-panel
```

### 6️⃣ **Bot'u Başlat**
```bash
# Development
npm start

# Production (PM2)
npm run pm2:start
```

## ⚙️ Yapılandırma

### 🔑 **Discord Bot Ayarları**
```env
DISCORD_TOKEN=your_bot_token_here
GUILD_ID=your_server_id_here
ADMIN_MOD_CHANNEL_ID=your_admin_channel_id
```

### 🗄️ **MySQL Ayarları**
```env
DB_HOST=localhost
DB_NAME=discord_mod_db
DB_USER=discord_user
DB_PASS=your_mysql_password
```

### 🌐 **Web Panel Ayarları**
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
SESSION_TIMEOUT=3600
MAX_LOGIN_ATTEMPTS=5
```

## 🎮 Komutlar

### 👨‍💼 **Admin Komutları**
- `/admin moderator-add` - Yeni moderatör ekle
- `/admin moderator-remove` - Moderatör kaldır
- `/admin moderator-list` - Moderatör listesi
- `/admin survey-send` - Manuel anket gönder
- `/admin survey-results` - Anket sonuçları
- `/admin discipline-check` - Disiplin durumu

### 📊 **Moderatör Komutları**
- `/mod schedule-view` - Vardiya takvimi görüntüle
- `/mod excuse-submit` - Mazeret bildirimi
- `/mod status-check` - Kendi durumu kontrol et

### ℹ️ **Genel Komutlar**
- `/help` - Yardım menüsü
- `/help admin` - Admin komutları
- `/help mod` - Moderatör komutları

## 🌐 Web Yönetim Paneli

### 📊 **Dashboard Özellikleri**
- **Bot Durumu** - Gerçek zamanlı bot monitoring
- **Aktif Moderatörler** - Online/offline durumu
- **Vardiya Dağılımı** - Günlük/haftalık istatistikler
- **Sistem Logları** - Detaylı aktivite takibi

### 🛠️ **Admin Panel**
- **Bot Kontrolü** - Start/stop/restart
- **Komut Konsolu** - Terminal benzeri bot kontrolü
- **Veritabanı Yönetimi** - Backup/restore
- **Güvenlik Logları** - Login attempts, rate limits

### 📈 **İstatistikler**
- **Moderatör Performansı** - Vardiya katılım oranları
- **Disiplin Raporları** - Ban/timeout istatistikleri
- **Sistem Metrikleri** - Memory/CPU kullanımı

## 🔧 Gelişmiş Ayarlar

### ⏰ **Anket Zamanlaması**
```env
# Her Pazar 18:00
SURVEY_CRON=0 0 18 * * 0

# Her Pazartesi 09:00  
SURVEY_CRON=0 0 9 * * 1

# Her gün 20:00
SURVEY_CRON=0 0 20 * * *
```

### 🚫 **Disiplin Sistemi**
```env
FIRST_VIOLATION_DAYS=2   # İlk ihlal: 2 gün ban
SECOND_VIOLATION_DAYS=1  # İkinci ihlal: 1 saat ban
THIRD_VIOLATION_DAYS=1   # Üçüncü ihlal: 1 gün ban
WRITE_TIMEOUT_MINUTES=60 # Yazma yasağı: 60 dakika
```

### 🕐 **Vardiya Özelleştirme**
```env
# 5 vardiya (varsayılan)
TIME_SLOTS=["00:00-05:00","05:00-10:00","10:00-15:00","15:00-20:00","20:00-24:00"]

# 4 vardiya (örnek)
TIME_SLOTS=["00:00-06:00","06:00-12:00","12:00-18:00","18:00-24:00"]

# 6 vardiya (örnek)
TIME_SLOTS=["00:00-04:00","04:00-08:00","08:00-12:00","12:00-16:00","16:00-20:00","20:00-24:00"]
```

## 🔒 Güvenlik

### 🛡️ **Web Panel Güvenliği**
- **HTTPS Zorunluluğu** - SSL sertifikası gerekli
- **Session Timeout** - Otomatik oturum sonlandırma
- **IP Whitelisting** - Belirli IP'lerden erişim
- **2FA Desteği** - İki faktörlü doğrulama

### 🔐 **Veritabanı Güvenliği**
- **Prepared Statements** - SQL injection koruması
- **Encrypted Passwords** - Argon2ID hash algoritması
- **Connection Encryption** - TLS/SSL bağlantı
- **Regular Backups** - Otomatik yedekleme

## 📁 Proje Yapısı

```
discord-mod-takvimi/
├── src/                    # Bot kaynak kodları
│   ├── commands/          # Slash komutları
│   ├── events/            # Discord event handlers
│   ├── database/          # MySQL veritabanı sınıfı
│   ├── utils/             # Yardımcı fonksiyonlar
│   ├── index.js           # Ana bot dosyası
│   └── setup.js           # İnteraktif kurulum
├── web-panel/             # PHP web yönetim paneli
│   ├── config.php         # Panel yapılandırması
│   ├── security.php       # Güvenlik katmanı
│   ├── login.php          # Giriş sayfası
│   ├── dashboard.php      # Ana panel
│   ├── admin-settings.php # Admin ayarları
│   └── install.sql        # MySQL kurulum scripti
├── package.json           # Node.js bağımlılıkları
├── ecosystem.config.js    # PM2 yapılandırması
└── config.example.env     # Örnek yapılandırma
```

## 🐛 Sorun Giderme

### ❌ **Sık Karşılaşılan Hatalar**

**MySQL Bağlantı Hatası:**
```bash
# MySQL servisini kontrol et
sudo systemctl status mysql

# MySQL'i yeniden başlat
sudo systemctl restart mysql

# Kullanıcı izinlerini kontrol et
mysql -u root -p
SHOW GRANTS FOR 'discord_user'@'localhost';
```

**Bot Token Hatası:**
```bash
# Token'ı kontrol et
echo $DISCORD_TOKEN

# .env dosyasını kontrol et
cat .env | grep DISCORD_TOKEN
```

**Web Panel 500 Hatası:**
```bash
# PHP hata loglarını kontrol et
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/www/html/web-panel/logs/php_errors.log

# PHP-FPM'i yeniden başlat
sudo systemctl restart php8.1-fpm
```

### 🔍 **Debug Modu**
```env
# Development modunu aktif et
APP_ENV=development
LOG_LEVEL=debug
```

## 📊 Performans

### 🚀 **Optimizasyon İpuçları**
- **MySQL InnoDB** - MyISAM yerine InnoDB kullanın
- **Connection Pooling** - MySQL connection pool ayarları
- **Redis Cache** - Session ve cache için Redis
- **Nginx Gzip** - Static dosya sıkıştırma

### 📈 **Monitoring**
```bash
# PM2 monitoring
npm run pm2:monit

# MySQL performans
mysql -u root -p -e "SHOW PROCESSLIST;"

# Sistem kaynakları
htop
```

## 🤝 Katkıda Bulunma

1. Repository'yi fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🆘 Destek

- 📧 **Email:** [support@example.com](mailto:support@example.com)
- 💬 **Discord:** [Discord Sunucusu](https://discord.gg/your-server)
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/osman006/discord-mod-takvimi/issues)
- 📚 **Dokümantasyon:** [Wiki Sayfası](https://github.com/osman006/discord-mod-takvimi/wiki)

## 🎉 Teşekkürler

Bu projeyi kullandığınız için teşekkürler! Discord sunucunuzda moderatör yönetimini otomatikleştirmenin keyfini çıkarın.

---

**⭐ Projeyi beğendiyseniz yıldız vermeyi unutmayın!** 