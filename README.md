# Discord Moderatör Takvim Botu

Bu bot, Discord sunucusundaki moderatörlerin çalışma takvimini otomatik olarak yönetir.

## 🚀 Yeni Özellikler (v2.0)

### ✨ Tam Otomatik Sistem
- **Otomatik takvim oluşturma**: Her gün saat 8:00'de otomatik olarak takvim kontrolü yapar
- **Akıllı anket sistemi**: Takvim yoksa otomatik anket gönderir
- **5 saat süre**: Moderatörlere 5 saat yanıt süresi verir
- **Otomatik ceza sistemi**: Yanıt vermeyenleri otomatik cezalandırır
- **Yerine atama**: Gelmeyenler için otomatik yerine moderatör atar

### 🎯 Birleştirilmiş Admin Komutları
Tüm admin komutları `/admin` altında birleştirildi:

- `/admin takvim-olustur` - Günlük takvim oluştur
- `/admin kullanici-izin` - Kullanıcıya özel izin/kısıtlama
- `/admin kalici-saat` - Kalıcı vardiya atama (bot her zaman aynı saate atar)
- `/admin saat-degistir` - Kullanıcının saatini değiştir (DM ile bildirir)
- `/admin mod-ekle` - Sisteme yeni moderatör ekle
- `/admin modlari-guncelle` - Tüm moderatörleri tara ve güncelle
- `/admin takvim-gonder` - Moderatörlere anket gönder
- `/admin takvim-sil` - Belirtilen tarihin takvimini sil
- `/admin cezali-listesi` - Cezalı kullanıcıları listele
- `/admin ban-kaldir` - Kullanıcının banını kaldır
- `/admin stats` - Bot istatistikleri
- `/admin permissions` - Bot yetkilerini kontrol et

### 📊 Gelişmiş Ceza Sistemi
1. **İlk ihlal**: 2 gün moderatörlük yasağı
2. **İkinci ihlal**: 1 saat yazma yasağı
3. **Üçüncü+ ihlal**: 1 gün moderatörlük yasağı

### 📱 Ayrı Kanal Sistemi
- **Log Kanalı**: Sistem logları (kullanıcı geldi/gelmedi, cezalar vs)
- **Takvim Kanalı**: Moderatörlerin görebileceği takvim listesi
- **Admin Kanalı**: Admin bildirimleri

## 📋 Kurulum

### 1. Gereksinimler
- Node.js 16+
- Discord Bot Token
- Ubuntu/Linux (önerilen)

### 2. Kurulum Adımları

```bash
# Projeyi klonla
git clone <repo-url>
cd discord-mod-schedule-bot

# Bağımlılıkları yükle
npm install

# Konfigürasyon dosyasını kopyala
cp config.example.env .env

# Konfigürasyonu düzenle
nano .env
```

### 3. Konfigürasyon (.env)

```env
# Discord Bot Token
DISCORD_TOKEN=your_bot_token_here

# Discord Server ID
GUILD_ID=your_server_id_here

# Kanallar (ayrı kanallar için)
ADMIN_MOD_CHANNEL_ID=your_admin_channel_id
LOG_CHANNEL_ID=your_log_channel_id
SCHEDULE_CHANNEL_ID=your_schedule_channel_id
MOD_SCHEDULE_CHANNEL_ID=your_mod_schedule_channel_id

# Moderatör Rolleri
MOD_ROLES=MOD,SR MOD,HEAD MOD

# Otomatik Sistem
AUTO_SCHEDULE_ENABLED=true
DAILY_SCHEDULE_HOUR=8
SURVEY_TIMEOUT_HOURS=5

# Ceza Süreleri
FIRST_VIOLATION_DAYS=2
SECOND_VIOLATION_DAYS=1
THIRD_VIOLATION_DAYS=1
WRITE_TIMEOUT_MINUTES=60
```

### 4. Botu Başlat

```bash
# Veritabanını kurulum
npm run setup

# Botu başlat
npm start

# Geliştirme modu
npm run dev
```

## 🔧 Sistem Nasıl Çalışır?

### Otomatik Takvim Süreci:
1. **Her gün saat 8:00**: Bot bugün ve yarın için takvim var mı kontrol eder
2. **Takvim yoksa**: Otomatik olarak tüm moderatörlere anket gönderir
3. **5 saat süre**: Moderatörler 5 saat içinde yanıt vermeli
4. **Süre dolunca**: 
   - Yanıt vermeyenler otomatik cezalandırılır
   - Yerine başka moderatör atanır
   - Takvim otomatik oluşturulur ve yayınlanır

### Ceza Sistemi:
- **1. İhlal**: 2 gün moderatörlük yapamaz
- **2. İhlal**: 1 saat hiçbir yere yazamaz (yazma banı)
- **3. İhlal**: 1 gün moderatörlük yapamaz
- **Ceza bitince**: Otomatik kaldırılır ve DM ile bildirilir

### Özel Özellikler:
- **Kalıcı vardiya**: Admin bir kullanıcıya kalıcı saat atayabilir
- **Zaman kısıtlamaları**: Belirli saatlerde çalışma izni/yasağı
- **Manuel değişiklik**: Admin istediği zaman saatleri değiştirebilir
- **Otomatik bildirimler**: Tüm değişiklikler DM ile bildirilir

## 📊 Veritabanı Tabloları

Sistem aşağıdaki tabloları kullanır:
- `moderators` - Moderatör bilgileri
- `daily_assignments` - Günlük vardiya atamaları
- `mod_responses` - Anket yanıtları
- `absent_users` - Cezalı kullanıcılar (gelmeyen tablosu)
- `permanent_shifts` - Kalıcı vardiya atamaları
- `user_time_permissions` - Kullanıcı zaman izinleri
- `schedule_status` - Otomatik takvim durumu

## 🚨 Önemli Notlar

1. **Ubuntu'da çalışır**: Sistem Ubuntu/Linux ortamında test edilmiştir
2. **Otomatik başlatma**: Sistem reboot sonrası otomatik çalışır
3. **Hata yönetimi**: Tüm hatalar log kanalına bildirilir
4. **Yedekleme**: Veritabanını düzenli yedekleyin
5. **Bot yetkileri**: Botun DM gönderme ve kanal mesaj atma yetkisi olmalı

## 🔧 Sorun Giderme

### Bot çalışmıyor:
```bash
# Logları kontrol et
tail -f logs/bot.log

# Veritabanını kontrol et
sqlite3 data/bot.db ".tables"

# Botu yeniden başlat
npm restart
```

### Anket gönderilmiyor:
- Bot yetkilerini kontrol edin
- DM ayarlarını kontrol edin
- Log kanalını kontrol edin

### Otomatik sistem çalışmıyor:
- `AUTO_SCHEDULE_ENABLED=true` olduğundan emin olun
- Cron job'ların çalıştığını kontrol edin
- Sistem saatini kontrol edin

## 📝 Changelog

### v2.0 - Tam Otomatik Sistem
- ✅ Tüm komutları `/admin` altında birleştirme
- ✅ Otomatik takvim oluşturma sistemi
- ✅ 5 saatlik anket süresi
- ✅ Otomatik ceza sistemi (2 gün → 1 saat → 1 gün)
- ✅ Gelmeyen kullanıcılar tablosu
- ✅ Ayrı log ve takvim kanalları
- ✅ DM bildirim sistemi
- ✅ Kalıcı vardiya ataması
- ✅ Kullanıcı zaman izinleri
- ✅ Otomatik yerine atama sistemi

## 📞 Destek

Sorunlarınız için GitHub Issues kullanın veya Discord'dan iletişime geçin.

---

**Not**: Bu bot Ubuntu ortamında çalışmak üzere optimize edilmiştir. Diğer işletim sistemlerinde test edilmemiştir. 