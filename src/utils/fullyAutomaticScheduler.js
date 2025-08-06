const cron = require('node-cron');
const AutoScheduleManager = require('./autoScheduleManager');

class FullyAutomaticScheduler {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.database = client.database;
        this.autoScheduleManager = new AutoScheduleManager(client);
        this.isRunning = false;
    }

    // Otomatik takvim sistemini başlat
    start() {
        if (!this.config.schedule.autoScheduleEnabled) {
            this.logger.info('Otomatik takvim sistemi devre dışı');
            return;
        }

        if (this.isRunning) {
            this.logger.warn('Otomatik takvim sistemi zaten çalışıyor');
            return;
        }

        this.isRunning = true;
        this.logger.info('Tam otomatik takvim sistemi başlatılıyor...');

        // Her gün saat 8:00'de kontrol et
        const dailyScheduleHour = this.config.schedule.dailyScheduleHour || 8;
        const cronExpression = `0 0 ${dailyScheduleHour} * * *`; // Her gün saat X:00

        cron.schedule(cronExpression, async () => {
            await this.checkAndCreateDailySchedule();
        }, {
            timezone: "Europe/Istanbul"
        });

        // Her saat başı ceza süresi biten kullanıcıları kontrol et
        cron.schedule('0 0 * * * *', async () => {
            await this.checkExpiredPunishments();
        }, {
            timezone: "Europe/Istanbul"
        });

        // Her 10 dakikada bir sistem durumunu kontrol et
        cron.schedule('*/10 * * * *', async () => {
            await this.systemHealthCheck();
        }, {
            timezone: "Europe/Istanbul"
        });

        this.logger.info(`Otomatik takvim sistemi başlatıldı! Günlük kontrol saati: ${dailyScheduleHour}:00`);
    }

    // Günlük takvim kontrolü ve oluşturma
    async checkAndCreateDailySchedule() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            this.logger.info(`Günlük takvim kontrolü: ${today} ve ${tomorrow}`);

            // Bugün için takvim var mı kontrol et
            await this.ensureScheduleExists(today, 'bugün');
            
            // Yarın için takvim var mı kontrol et
            await this.ensureScheduleExists(tomorrow, 'yarın');

        } catch (error) {
            this.logger.botError(error, 'Günlük takvim kontrolü');
        }
    }

    // Belirtilen tarih için takvim olduğundan emin ol
    async ensureScheduleExists(date, description) {
        try {
            const hasSchedule = await this.database.hasScheduleForDate(date);
            
            if (!hasSchedule) {
                this.logger.info(`${description} (${date}) için takvim bulunamadı, oluşturuluyor...`);
                
                const result = await this.autoScheduleManager.createDailySchedule(date);
                
                if (result.success) {
                    this.logger.info(`${description} için takvim başarıyla oluşturuldu: ${result.summary}`);
                    
                    // Log kanalına bildir
                    await this.logScheduleCreation(date, description, true);
                } else {
                    this.logger.error(`${description} için takvim oluşturulamadı: ${result.error}`);
                    
                    // Log kanalına hata bildir
                    await this.logScheduleCreation(date, description, false, result.error);
                }
            } else {
                this.logger.info(`${description} (${date}) için takvim zaten mevcut`);
            }

        } catch (error) {
            this.logger.error(`${description} takvim kontrolü hatası:`, error.message);
        }
    }

    // Süresi biten cezaları kontrol et
    async checkExpiredPunishments() {
        try {
            const expiredPunishments = await this.database.getExpiredPunishments();
            
            for (const punishment of expiredPunishments) {
                await this.removePunishment(punishment);
            }

            if (expiredPunishments.length > 0) {
                this.logger.info(`${expiredPunishments.length} süresi biten ceza kaldırıldı`);
            }

        } catch (error) {
            this.logger.error('Süresi biten ceza kontrolü hatası:', error.message);
        }
    }

    // Cezayı kaldır ve kullanıcıya bildir
    async removePunishment(punishment) {
        try {
            // Cezayı pasif yap
            await this.database.removeBan(punishment.user_id);
            
            // Kullanıcıya bildir
            try {
                const user = await this.client.users.fetch(punishment.user_id);
                
                let punishmentText;
                switch (punishment.punishment_type) {
                    case 'ban_2day':
                        punishmentText = '2 günlük moderatörlük yasağınız';
                        break;
                    case 'ban_1hour':
                        punishmentText = '1 saatlik yazma yasağınız';
                        break;
                    case 'ban_1day':
                        punishmentText = '1 günlük moderatörlük yasağınız';
                        break;
                    default:
                        punishmentText = 'cezanız';
                }

                await user.send({
                    embeds: [{
                        color: 0x00ff00,
                        title: '✅ Ceza Süresi Doldu',
                        description: `${punishmentText} sona erdi! Artık normal şekilde moderatörlük görevlerinizi yapabilirsiniz.`,
                        fields: [
                            {
                                name: '📅 Ceza Tarihi',
                                value: new Date(punishment.created_at).toLocaleDateString('tr-TR'),
                                inline: true
                            },
                            {
                                name: '📝 Sebep',
                                value: punishment.reason === 'no_response' ? 'Ankete yanıt vermeme' : punishment.reason,
                                inline: true
                            },
                            {
                                name: '⚠️ Hatırlatma',
                                value: 'Gelecekte anketlere zamanında yanıt vermeyi unutmayın!',
                                inline: false
                            }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                });

                this.logger.info(`${punishment.username} kullanıcısının cezası kaldırıldı ve bildirim gönderildi`);

            } catch (dmError) {
                this.logger.error(`${punishment.username} kullanıcısına ceza kaldırma bildirimi gönderilemedi:`, dmError.message);
            }

            // Log kanalına bildir
            await this.logPunishmentRemoval(punishment);

        } catch (error) {
            this.logger.error(`${punishment.username} ceza kaldırma hatası:`, error.message);
        }
    }

    // Sistem sağlık kontrolü
    async systemHealthCheck() {
        try {
            // Veritabanı bağlantısını kontrol et
            const isDbHealthy = await this.checkDatabaseHealth();
            
            // Discord bağlantısını kontrol et
            const isDiscordHealthy = this.client.isReady();
            
            if (!isDbHealthy || !isDiscordHealthy) {
                this.logger.error(`Sistem sağlık kontrolü: DB=${isDbHealthy}, Discord=${isDiscordHealthy}`);
                
                // Kritik hata durumunda admin kanalına bildir
                await this.alertSystemHealth(isDbHealthy, isDiscordHealthy);
            }

        } catch (error) {
            this.logger.error('Sistem sağlık kontrolü hatası:', error.message);
        }
    }

    // Veritabanı sağlığını kontrol et
    async checkDatabaseHealth() {
        try {
            await this.database.getActiveModerators();
            return true;
        } catch (error) {
            return false;
        }
    }

    // Sistem sağlık uyarısı gönder
    async alertSystemHealth(isDbHealthy, isDiscordHealthy) {
        try {
            const adminChannelId = this.config.discord.adminModChannelId;
            if (!adminChannelId) return;

            const channel = await this.client.channels.fetch(adminChannelId);
            
            const embed = {
                color: 0xff0000,
                title: '🚨 Sistem Sağlık Uyarısı',
                description: 'Otomatik takvim sisteminde sorun tespit edildi!',
                fields: [
                    {
                        name: '💾 Veritabanı',
                        value: isDbHealthy ? '✅ Sağlıklı' : '❌ Sorunlu',
                        inline: true
                    },
                    {
                        name: '🤖 Discord Bağlantısı',
                        value: isDiscordHealthy ? '✅ Sağlıklı' : '❌ Sorunlu',
                        inline: true
                    },
                    {
                        name: '⚠️ Öneri',
                        value: 'Sistem yöneticisine başvurun ve botu yeniden başlatmayı deneyin.',
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString()
            };

            await channel.send({ embeds: [embed] });

        } catch (error) {
            this.logger.error('Sistem sağlık uyarısı gönderme hatası:', error.message);
        }
    }

    // Takvim oluşturma logla
    async logScheduleCreation(date, description, success, error = null) {
        try {
            const logChannelId = this.config.discord.logChannelId;
            if (!logChannelId) return;

            const channel = await this.client.channels.fetch(logChannelId);
            
            const embed = {
                color: success ? 0x00ff00 : 0xff0000,
                title: success ? '✅ Otomatik Takvim Oluşturuldu' : '❌ Otomatik Takvim Hatası',
                fields: [
                    {
                        name: '📅 Tarih',
                        value: `${description} (${date})`,
                        inline: true
                    },
                    {
                        name: '🕒 Zaman',
                        value: new Date().toLocaleString('tr-TR'),
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
            };

            if (success) {
                embed.description = 'Sistem otomatik olarak günlük takvim oluşturdu ve moderatörlere anket gönderdi.';
                embed.fields.push({
                    name: '📊 Durum',
                    value: 'Moderatörlere 5 saat süre verildi',
                    inline: false
                });
            } else {
                embed.description = 'Otomatik takvim oluşturulurken hata oluştu!';
                embed.fields.push({
                    name: '❌ Hata',
                    value: error || 'Bilinmeyen hata',
                    inline: false
                });
            }

            await channel.send({ embeds: [embed] });

        } catch (logError) {
            this.logger.error('Takvim oluşturma loglama hatası:', logError.message);
        }
    }

    // Ceza kaldırma logla
    async logPunishmentRemoval(punishment) {
        try {
            const logChannelId = this.config.discord.logChannelId;
            if (!logChannelId) return;

            const channel = await this.client.channels.fetch(logChannelId);
            
            let punishmentText;
            switch (punishment.punishment_type) {
                case 'ban_2day':
                    punishmentText = '2 Gün Moderatörlük Yasağı';
                    break;
                case 'ban_1hour':
                    punishmentText = '1 Saat Yazma Yasağı';
                    break;
                case 'ban_1day':
                    punishmentText = '1 Gün Moderatörlük Yasağı';
                    break;
                default:
                    punishmentText = punishment.punishment_type;
            }

            const embed = {
                color: 0x00ff00,
                title: '✅ Ceza Süresi Doldu',
                description: 'Kullanıcının ceza süresi otomatik olarak sona erdi.',
                fields: [
                    {
                        name: '👤 Kullanıcı',
                        value: `${punishment.username} <@${punishment.user_id}>`,
                        inline: true
                    },
                    {
                        name: '⏰ Ceza Türü',
                        value: punishmentText,
                        inline: true
                    },
                    {
                        name: '📝 Sebep',
                        value: punishment.reason === 'no_response' ? 'Ankete yanıt vermeme' : punishment.reason,
                        inline: true
                    },
                    {
                        name: '📅 Ceza Tarihi',
                        value: new Date(punishment.created_at).toLocaleDateString('tr-TR'),
                        inline: true
                    },
                    {
                        name: '🔢 İhlal Sayısı',
                        value: punishment.violation_count.toString(),
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
            };

            await channel.send({ embeds: [embed] });

        } catch (error) {
            this.logger.error('Ceza kaldırma loglama hatası:', error.message);
        }
    }

    // Sistemi durdur
    stop() {
        this.isRunning = false;
        this.logger.info('Tam otomatik takvim sistemi durduruldu');
    }

    // Durum bilgisi
    getStatus() {
        return {
            isRunning: this.isRunning,
            autoScheduleEnabled: this.config.schedule.autoScheduleEnabled,
            dailyScheduleHour: this.config.schedule.dailyScheduleHour,
            surveyTimeoutHours: this.config.schedule.surveyTimeoutHours
        };
    }
}

module.exports = FullyAutomaticScheduler; 