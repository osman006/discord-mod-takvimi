const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Kendi modüllerimiz
const config = require('./utils/config');
const Logger = require('./utils/logger');
const Database = require('./database/database');
const FullyAutomaticScheduler = require('./utils/fullyAutomaticScheduler');

// Global değişkenler
const logger = new Logger(config.logging.level);
const database = new Database(config.database.path);
let automaticScheduler = null;

// Discord Client oluştur
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Komut koleksiyonu
client.commands = new Collection();
client.database = database;
client.logger = logger;
client.config = config;

// Komutları yükle
function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
        fs.mkdirSync(commandsPath, { recursive: true });
    }
    
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            logger.debug(`Komut yüklendi: ${command.data.name}`);
        } else {
            logger.warn(`Komut dosyasında 'data' veya 'execute' property eksik: ${filePath}`);
        }
    }
}

// Event'leri yükle
function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath, { recursive: true });
    }
    
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        
        logger.debug(`Event yüklendi: ${event.name}`);
    }
}

// Slash komutları Discord'a kaydet
async function deployCommands() {
    try {
        const commands = [];
        client.commands.forEach(command => {
            commands.push(command.data.toJSON());
        });

        const rest = new REST().setToken(config.discord.token);

        logger.info(`${commands.length} slash komut Discord'a kaydediliyor...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(client.user.id, config.discord.guildId),
            { body: commands }
        );

        logger.info(`${data.length} slash komut başarıyla kaydedildi.`);
    } catch (error) {
        logger.botError(error, 'Slash komut kaydetme');
    }
}

// Moderatörleri tara ve veritabanını güncelle
async function scanModerators() {
    try {
        const guild = client.guilds.cache.get(config.discord.guildId);
        if (!guild) {
            logger.error('Guild bulunamadı!');
            return;
        }

        await guild.members.fetch(); // Tüm üyeleri getir

        const moderators = [];
        
        for (const [userId, member] of guild.members.cache) {
            const userRoles = member.roles.cache.map(role => role.name);
            const modRoles = userRoles.filter(role => config.discord.modRoles.includes(role));
            
            if (modRoles.length > 0) {
                moderators.push({
                    userId: member.user.id,
                    username: member.user.username,
                    displayName: member.displayName,
                    roles: modRoles
                });
                
                // Veritabanına kaydet
                await database.updateModerator(
                    member.user.id,
                    member.user.username,
                    member.displayName,
                    modRoles
                );
            }
        }

        logger.info(`${moderators.length} moderatör tespit edildi ve veritabanı güncellendi.`);
        return moderators;
    } catch (error) {
        logger.botError(error, 'Moderatör tarama');
        return [];
    }
}

// Haftalık anket gönderme işlemi
async function sendWeeklySurvey() {
    try {
        logger.info('Haftalık anket gönderimi başlıyor...');
        
        const currentPeriod = config.utils.getCurrentPeriod();
        const moderators = await scanModerators();
        
        if (moderators.length === 0) {
            logger.warn('Gönderilecek moderatör bulunamadı.');
            return;
        }

        // Anket dönemini kaydet
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const deadline = new Date(now.getTime() + config.schedule.responseTimeoutHours * 60 * 60 * 1000);
        
        await database.saveSurveyPeriod(currentPeriod, now.toISOString(), nextWeek.toISOString(), deadline.toISOString());

        // Her moderatöre DM gönder
        let sentCount = 0;
        let failedCount = 0;

        for (const mod of moderators) {
            try {
                const user = await client.users.fetch(mod.userId);
                
                // DM gönder (bu fonksiyonu ayrı dosyada yazacağız)
                const SurveyManager = require('./utils/surveyManager');
                const surveyManager = new SurveyManager(client);
                await surveyManager.sendSurveyDM(user, currentPeriod);
                
                sentCount++;
                logger.info(`Anket gönderildi: ${mod.username}`);
                
                // Rate limiting için bekle
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                failedCount++;
                logger.error(`${mod.username} kullanıcısına DM gönderilemedi:`, error.message);
            }
        }

        logger.info(`Anket gönderimi tamamlandı. Başarılı: ${sentCount}, Başarısız: ${failedCount}`);
    } catch (error) {
        logger.botError(error, 'Haftalık anket gönderimi');
    }
}

// Cron job'ları ayarla
function setupCronJobs() {
    // Haftalık anket gönderimi
    cron.schedule(config.schedule.surveyCron, () => {
        logger.info('Cron tetiklendi: Haftalık anket');
        sendWeeklySurvey();
    }, {
        scheduled: true,
        timezone: "Europe/Istanbul"
    });

    // Günlük disiplin kontrolü (her gün 09:00)
    cron.schedule('0 0 9 * * *', async () => {
        logger.info('Cron tetiklendi: Disiplin kontrolü');
        
        try {
            const DisciplineManager = require('./utils/disciplineManager');
            const disciplineManager = new DisciplineManager(client);
            await disciplineManager.checkAndApplyDiscipline();
        } catch (error) {
            logger.botError(error, 'Disiplin kontrolü');
        }
    }, {
        scheduled: true,
        timezone: "Europe/Istanbul"
    });

    // Haftalık takvim yayınlama (Pazartesi 09:00)
    cron.schedule('0 0 9 * * 1', async () => {
        logger.info('Cron tetiklendi: Haftalık takvim yayınlama');
        
        try {
            const currentPeriod = config.utils.getCurrentPeriod();
            const SchedulePublisher = require('./utils/schedulePublisher');
            const schedulePublisher = new SchedulePublisher(client);
            await schedulePublisher.publishSchedule(currentPeriod);
        } catch (error) {
            logger.botError(error, 'Haftalık takvim yayınlama');
        }
    }, {
        scheduled: true,
        timezone: "Europe/Istanbul"
    });

    // Günlük otomatik takvim (her gün 07:00)
    cron.schedule('0 0 7 * * *', async () => {
        logger.info('Cron tetiklendi: Günlük otomatik takvim');
        
        try {
            await client.autoScheduler.createDailyScheduleAutomatically();
        } catch (error) {
            logger.botError(error, 'Günlük otomatik takvim');
        }
    }, {
        scheduled: true,
        timezone: "Europe/Istanbul"
    });

    logger.info('Cron job\'ları ayarlandı.');
}

// Bot başlatma
async function startBot() {
    try {
        // Veritabanını başlat
        await database.connect();
        await database.init();
        
        // Komut ve event'leri yükle
        loadCommands();
        loadEvents();
        
        // Bot'u başlat
        await client.login(config.discord.token);
        
        logger.info('Bot başarıyla başlatıldı!');
    } catch (error) {
        logger.botError(error, 'Bot başlatma');
        process.exit(1);
    }
}

// Bot hazır olduğunda
client.once('ready', async () => {
    logger.info(`${client.user.tag} olarak giriş yapıldı!`);
    
    // Bot yetkilerini kontrol et (geçici olarak devre dışı - Missing Access sorunu)
    // const PermissionChecker = require('./utils/permissionChecker');
    // const permissionChecker = new PermissionChecker(client);
    // await permissionChecker.sendPermissionAlert();
    
    // Slash komutları kaydet
    await deployCommands();
    
    // Moderatörleri tara
    await scanModerators();
    
    // Tam otomatik günlük takvim sistemi
    const FullyAutomaticScheduler = require('./utils/fullyAutomaticScheduler');
    const autoScheduler = new FullyAutomaticScheduler(client);
    client.autoScheduler = autoScheduler;
    
    // Bugünün takvimini oluştur
    await autoScheduler.createDailyScheduleAutomatically();
    
    // Cron job'ları ayarla
    setupCronJobs();
    
    // Otomatik takvim sistemini başlat
    automaticScheduler = new FullyAutomaticScheduler(client);
    automaticScheduler.start();
    
    logger.info('Bot tamamen hazır ve çalışıyor!');
    logger.info('Otomatik takvim sistemi aktif!');
});

// Hata yakalama
process.on('unhandledRejection', (error) => {
    logger.botError(error, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
    logger.botError(error, 'Uncaught Exception');
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Bot kapatılıyor...');
    
    // Otomatik sistemi durdur
    if (automaticScheduler) {
        automaticScheduler.stop();
    }
    
    await database.close();
    client.destroy();
    process.exit(0);
});

// Bot'u başlat
startBot(); 