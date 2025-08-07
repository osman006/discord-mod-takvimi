const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setup() {
    console.log('🤖 Discord Moderatör Takvim Botu - İlk Kurulum\n');
    console.log('Bu script size .env dosyasını oluşturmada yardımcı olacak.\n');

    try {
        // Gerekli klasörleri oluştur
        const directories = ['data', 'logs', 'temp'];
        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`✅ ${dir}/ klasörü oluşturuldu`);
            }
        });

        // .env dosyası zaten var mı kontrol et
        if (fs.existsSync('.env')) {
            const overwrite = await question('⚠️  .env dosyası zaten mevcut. Üzerine yazılsın mı? (y/N): ');
            if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
                console.log('❌ Kurulum iptal edildi.');
                rl.close();
                return;
            }
        }

        console.log('\n📝 Lütfen aşağıdaki bilgileri girin:\n');

        // Discord Bot Token
        const token = await question('🔑 Discord Bot Token: ');
        if (!token || token.length < 50) {
            console.log('❌ Geçersiz bot token! Token en az 50 karakter olmalıdır.');
            rl.close();
            return;
        }

        // Guild ID
        const guildId = await question('🏠 Discord Sunucu ID\'si: ');
        if (!guildId || !/^\d+$/.test(guildId)) {
            console.log('❌ Geçersiz sunucu ID! Sadece sayılar içermelidir.');
            rl.close();
            return;
        }

        // Admin-Mod Channel ID
        const adminChannelId = await question('📢 Admin-Mod Kanal ID\'si: ');
        if (!adminChannelId || !/^\d+$/.test(adminChannelId)) {
            console.log('❌ Geçersiz kanal ID! Sadece sayılar içermelidir.');
            rl.close();
            return;
        }

        // Ek kanal ayarları
        const logChannelId = await question(`📋 Log Kanal ID (boş bırakırsanız admin kanal kullanılır): `) || adminChannelId;
        const scheduleChannelId = await question(`📅 Takvim Kanal ID (boş bırakırsanız admin kanal kullanılır): `) || adminChannelId;
        const modScheduleChannelId = await question(`🗓️ Moderatör Takvim Kanal ID (boş bırakırsanız takvim kanal kullanılır): `) || scheduleChannelId;

        // Moderatör Rolleri
        const modRoles = await question('👥 Moderatör Rolleri (virgülle ayırın, örn: MOD,SR MOD,ADMIN): ') || 'MOD,SR MOD,ADMIN';

        // Anket Gönderim Zamanı
        console.log('\n⏰ Anket gönderim zamanı (Cron format):');
        console.log('   Örnekler:');
        console.log('   - Her Pazar 18:00: 0 0 18 * * 0');
        console.log('   - Her Pazartesi 09:00: 0 0 9 * * 1');
        console.log('   - Her gün 20:00: 0 0 20 * * *');
        const surveyCron = await question('📅 Cron ifadesi: ') || '0 0 18 * * 0';

        // Yanıt süresi
        const responseHours = await question('⏳ Yanıt verme süresi (saat): ') || '24';

        // Ban süreleri
        const firstViolationDays = await question('🚫 İlk ihlal ban süresi (gün): ') || '2';
        const secondViolationDays = await question('🚫 İkinci ihlal ban süresi (saat): ') || '1';
        const thirdViolationDays = await question('🚫 Üçüncü+ ihlal ban süresi (gün): ') || '1';
        const writeTimeoutMinutes = await question('✍️ Yazma yasağı süresi (dakika): ') || '60';

        // Saat aralıkları - YENİ 5 vardiya sistemi
        console.log('\n🕐 Vardiya sistemi:');
        console.log('   Yeni 5 vardiya sistemi (24 saat eşit dağıtım):');
        console.log('   🌚 Vardiya 1: 00:00-05:00 (Gece Yarısı)');
        console.log('   🌅 Vardiya 2: 05:00-10:00 (Sabah)');
        console.log('   ☀️ Vardiya 3: 10:00-15:00 (Öğlen)');
        console.log('   🌤️ Vardiya 4: 15:00-20:00 (Öğleden Sonra)');
        console.log('   🌆 Vardiya 5: 20:00-24:00 (Akşam-Gece)');
        const useDefaultSlots = await question('Varsayılan 5 vardiya sistemini kullan? (Y/n): ') || 'y';
        
        let timeSlots;
        if (useDefaultSlots.toLowerCase() === 'y' || useDefaultSlots.toLowerCase() === 'yes') {
            timeSlots = '["00:00-05:00","05:00-10:00","10:00-15:00","15:00-20:00","20:00-24:00"]';
        } else {
            const customSlots = await question('🕐 Özel saat aralıkları (JSON format): ');
            timeSlots = customSlots || '["00:00-05:00","05:00-10:00","10:00-15:00","15:00-20:00","20:00-24:00"]';
        }

        // Otomatik takvim sistemi
        const autoScheduleEnabled = await question('🤖 Otomatik günlük takvim sistemi aktif olsun mu? (Y/n): ') || 'y';
        const dailyScheduleHour = await question('⏰ Günlük takvim kontrolü saati (0-23): ') || '8';
        const surveyTimeoutHours = await question('📝 Günlük anket yanıt süresi (saat): ') || '5';

        // Web Paneli Ayarları
        console.log('\n🌐 Web Yönetim Paneli Kurulumu:');
        const setupWebPanel = await question('Web yönetim panelini kurmak istiyor musunuz? (Y/n): ') || 'y';
        
        let webPanelConfig = '';
        if (setupWebPanel.toLowerCase() === 'y' || setupWebPanel.toLowerCase() === 'yes') {
            const webPort = await question('🌐 Web paneli portu (varsayılan 3000): ') || '3000';
            const adminUsername = await question('👤 Admin kullanıcı adı (varsayılan admin): ') || 'admin';
            const adminPassword = await question('🔒 Admin şifresi (güçlü bir şifre girin): ') || generateRandomPassword();
            const sessionSecret = generateRandomSecret();
            
            console.log('\n📝 Web Panel Bilgileri:');
            console.log(`   🌐 URL: http://localhost:${webPort}`);
            console.log(`   👤 Kullanıcı: ${adminUsername}`);
            console.log(`   🔒 Şifre: ${adminPassword}`);
            console.log('   ⚠️  Bu bilgileri not alın!');
            
            await question('\nDevam etmek için Enter\'a basın...');
            
            webPanelConfig = `
# Web Yönetim Paneli Ayarları
WEB_PORT=${webPort}
WEB_SESSION_SECRET=${sessionSecret}
ADMIN_USERNAME=${adminUsername}
ADMIN_PASSWORD=${adminPassword}

# Web Paneli Güvenlik
WEB_HTTPS_ENABLED=false
WEB_RATE_LIMIT=100`;
        }

        // .env dosyasını oluştur
        const envContent = `# Discord Moderatör Takvim Sistemi - Otomatik Oluşturulan Ayarlar
# Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}

# Discord Bot Ayarları
DISCORD_TOKEN=${token}
GUILD_ID=${guildId}

# Discord Kanal Ayarları
ADMIN_MOD_CHANNEL_ID=${adminChannelId}
LOG_CHANNEL_ID=${logChannelId}
SCHEDULE_CHANNEL_ID=${scheduleChannelId}
MOD_SCHEDULE_CHANNEL_ID=${modScheduleChannelId}

# Moderatör Ayarları
MOD_ROLES=${modRoles}

# Zaman Ayarları
SURVEY_CRON=${surveyCron}
RESPONSE_TIMEOUT_HOURS=${responseHours}

# Ceza Ayarları
FIRST_VIOLATION_DAYS=${firstViolationDays}
SECOND_VIOLATION_DAYS=${secondViolationDays}
THIRD_VIOLATION_DAYS=${thirdViolationDays}
WRITE_TIMEOUT_MINUTES=${writeTimeoutMinutes}

# Sistem Ayarları
TIME_SLOTS=${timeSlots}
DATABASE_PATH=./data/bot.db
LOG_LEVEL=info

# Otomatik Takvim Sistemi
AUTO_SCHEDULE_ENABLED=${autoScheduleEnabled.toLowerCase() === 'y' ? 'true' : 'false'}
DAILY_SCHEDULE_HOUR=${dailyScheduleHour}
SURVEY_TIMEOUT_HOURS=${surveyTimeoutHours}${webPanelConfig}
`;

        fs.writeFileSync('.env', envContent);

        console.log('\n✅ Kurulum tamamlandı!');
        console.log('\n📋 Sonraki adımlar:');
        console.log('1. Bot\'u Discord Developer Portal\'dan sunucunuza davet edin');
        console.log('2. Bot\'a gerekli izinleri verin (Ban Members, Send Messages, vb.)');
        console.log('3. npm start komutu ile Discord bot\'u çalıştırın');
        if (setupWebPanel.toLowerCase() === 'y') {
            console.log('4. npm run web komutu ile web panelini başlatın (ayrı terminal)');
        }
        console.log('\n📚 Detaylı bilgi için README.md dosyasını okuyun');
        console.log('\n🎉 İyi kullanımlar!');

    } catch (error) {
        console.error('❌ Kurulum sırasında hata oluştu:', error.message);
    }

    rl.close();
}

// Rastgele şifre oluştur
function generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Rastgele secret oluştur
function generateRandomSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

// Test veritabanı bağlantısı
async function testDatabase() {
    try {
        const Database = require('./database/database');
        const db = new Database('./data/bot.db');
        
        await db.connect();
        await db.init();
        await db.close();
        
        console.log('✅ Veritabanı bağlantısı başarılı');
        return true;
    } catch (error) {
        console.log('❌ Veritabanı hatası:', error.message);
        return false;
    }
}

// Bot konfigürasyonunu test et
async function testConfig() {
    try {
        const config = require('./utils/config');
        console.log('✅ Konfigürasyon yüklendi');
        console.log(`📊 Toplam ${config.timeSlots.length} saat aralığı tanımlı`);
        return true;
    } catch (error) {
        console.log('❌ Konfigürasyon hatası:', error.message);
        return false;
    }
}

// Komut satırı argümanlarını kontrol et
const args = process.argv.slice(2);

if (args.includes('--test')) {
    console.log('🧪 Konfigürasyon testi yapılıyor...\n');
    
    Promise.all([testConfig(), testDatabase()]).then(([configOk, dbOk]) => {
        if (configOk && dbOk) {
            console.log('\n✅ Tüm testler başarılı! Bot çalıştırılmaya hazır.');
        } else {
            console.log('\n❌ Bazı testler başarısız. Konfigürasyonu kontrol edin.');
        }
    });
} else {
    setup();
} 