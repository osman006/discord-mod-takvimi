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
        const firstViolationDays = await question('🚫 İlk ihlal ban süresi (gün): ') || '1';
        const secondViolationDays = await question('🚫 İkinci+ ihlal ban süresi (gün): ') || '5';

        // Saat aralıkları
        console.log('\n🕐 Varsayılan saat aralıkları kullanılsın mı?');
        console.log('   18:00-21:00, 21:00-24:00, 00:00-03:00, 03:00-06:00,');
        console.log('   06:00-09:00, 09:00-12:00, 12:00-15:00, 15:00-18:00');
        const useDefaultSlots = await question('Varsayılan aralıkları kullan? (Y/n): ') || 'y';
        
        let timeSlots;
        if (useDefaultSlots.toLowerCase() === 'y' || useDefaultSlots.toLowerCase() === 'yes') {
            timeSlots = '["18:00-21:00","21:00-24:00","00:00-03:00","03:00-06:00","06:00-09:00","09:00-12:00","12:00-15:00","15:00-18:00"]';
        } else {
            const customSlots = await question('🕐 Özel saat aralıkları (JSON format): ');
            timeSlots = customSlots || '["18:00-21:00","21:00-24:00"]';
        }

        // .env dosyasını oluştur
        const envContent = `# Discord Bot Token
DISCORD_TOKEN=${token}

# Discord Guild (Server) ID
GUILD_ID=${guildId}

# Admin-Mod Channel ID (bot sadece burada mesaj atar)
ADMIN_MOD_CHANNEL_ID=${adminChannelId}

# Moderatör Rolleri (virgülle ayırın)
MOD_ROLES=${modRoles}

# DM Anket Gönderim Zamanı (Cron format: saniye dakika saat gün ay haftanın_günü)
# Örnek: Her Pazar 18:00 = "0 0 18 * * 0"
SURVEY_CRON=${surveyCron}

# Yanıt verme süresi (saat cinsinden)
RESPONSE_TIMEOUT_HOURS=${responseHours}

# Ban süreleri (gün cinsinden)
FIRST_VIOLATION_DAYS=${firstViolationDays}
SECOND_VIOLATION_DAYS=${secondViolationDays}

# Saat aralıkları (JSON format)
TIME_SLOTS=${timeSlots}

# Veritabanı dosyası
DATABASE_PATH=./data/bot.db

# Log seviyesi (info, warn, error, debug)
LOG_LEVEL=info
`;

        fs.writeFileSync('.env', envContent);

        console.log('\n✅ Kurulum tamamlandı!');
        console.log('\n📋 Sonraki adımlar:');
        console.log('1. Bot\'u Discord Developer Portal\'dan sunucunuza davet edin');
        console.log('2. Bot\'a gerekli izinleri verin (Ban Members, Send Messages, vb.)');
        console.log('3. npm start komutu ile bot\'u çalıştırın');
        console.log('\n📚 Detaylı bilgi için README.md dosyasını okuyun');
        console.log('\n🎉 İyi kullanımlar!');

    } catch (error) {
        console.error('❌ Kurulum sırasında hata oluştu:', error.message);
    }

    rl.close();
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