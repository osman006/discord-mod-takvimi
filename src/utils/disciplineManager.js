const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class DisciplineManager {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.database = client.database;
    }

    // Ana disiplin kontrolü
    async checkAndApplyDiscipline() {
        try {
            this.logger.info('Disiplin kontrolü başlıyor...');

            const currentPeriod = this.config.utils.getCurrentPeriod();
            
            // Yanıt vermeyen moderatörleri bul
            const violators = await this.findViolators(currentPeriod);
            
            if (violators.length === 0) {
                this.logger.info('Disiplin uygulanacak moderatör bulunamadı.');
                return;
            }

            this.logger.info(`${violators.length} moderatör için disiplin kontrolü yapılıyor.`);

            // Her ihlal eden için işlem yap
            const results = [];
            
            for (const violator of violators) {
                try {
                    const result = await this.processViolator(violator, currentPeriod);
                    results.push(result);
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    this.logger.error(`${violator.username} için disiplin işlemi hatası:`, error.message);
                    results.push({
                        username: violator.username,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Sonuçları admin kanalına bildir
            await this.reportDisciplineResults(results, currentPeriod);

            this.logger.info('Disiplin kontrolü tamamlandı.');

        } catch (error) {
            this.logger.botError(error, 'Disiplin kontrolü');
        }
    }

    // İhlal eden moderatörleri bul
    async findViolators(period) {
        try {
            // Tüm aktif moderatörleri al
            const allModerators = await this.database.getActiveModerators();
            
            // Bu dönem için yanıt verenleri al
            const responses = await this.database.getResponsesForPeriod(period);
            const respondedIds = responses.map(r => r.user_id);
            
            // Yanıt vermeyenleri filtrele
            const violators = allModerators.filter(mod => 
                !respondedIds.includes(mod.user_id)
            );

            // Deadline kontrolü - sadece süre geçmişse disiplin uygula
            const deadline = await this.getPeriodDeadline(period);
            if (!deadline || new Date() < new Date(deadline)) {
                this.logger.info('Henüz deadline geçmediği için disiplin uygulanmayacak.');
                return [];
            }

            return violators.map(mod => ({
                userId: mod.user_id,
                username: mod.username,
                displayName: mod.display_name
            }));

        } catch (error) {
            this.logger.error('İhlal eden moderatörler bulunurken hata:', error.message);
            return [];
        }
    }

    // Dönem deadline'ını al
    async getPeriodDeadline(period) {
        try {
            const sql = `
                SELECT deadline FROM survey_periods 
                WHERE period = ? 
                ORDER BY created_at DESC 
                LIMIT 1
            `;
            
            return new Promise((resolve, reject) => {
                this.database.db.get(sql, [period], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row ? row.deadline : null);
                    }
                });
            });
        } catch (error) {
            this.logger.error('Deadline alınırken hata:', error.message);
            return null;
        }
    }

    // İhlal eden moderatör için işlem yap
    async processViolator(violator, period) {
        try {
            // Önceki ihlal sayısını al
            const violationCount = await this.database.getViolationCount(violator.userId);
            
            // Ban süresini hesapla
            let banDays;
            if (violationCount === 0) {
                banDays = this.config.discipline.firstViolationDays; // İlk ihlal: 1 gün
            } else {
                banDays = this.config.discipline.secondViolationDays; // İkinci+ ihlal: 5 gün
            }

            // Disiplin kaydını veritabanına ekle
            await this.database.addDisciplineRecord(
                violator.userId,
                violator.username,
                'no_response',
                period,
                banDays
            );

            // Ban uygula
            const banResult = await this.applyBan(violator.userId, banDays, `Moderatör anketi yanıt vermeme - ${period}`);
            
            if (banResult.success) {
                this.logger.disciplineApplied(violator.userId, violator.username, banDays, 'Anket yanıt vermeme');
                
                return {
                    username: violator.username,
                    userId: violator.userId,
                    banDays,
                    violationCount: violationCount + 1,
                    success: true,
                    reason: 'Anket yanıt vermeme'
                };
            } else {
                return {
                    username: violator.username,
                    userId: violator.userId,
                    success: false,
                    error: banResult.error
                };
            }

        } catch (error) {
            this.logger.error(`${violator.username} işlenirken hata:`, error.message);
            throw error;
        }
    }

    // Ban uygula
    async applyBan(userId, days, reason) {
        try {
            const guild = this.client.guilds.cache.get(this.config.discord.guildId);
            if (!guild) {
                return { success: false, error: 'Guild bulunamadı' };
            }

            // Bot'un ban yetkisi var mı kontrol et
            const botMember = guild.members.cache.get(this.client.user.id);
            if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
                return { success: false, error: 'Bot ban yetkisine sahip değil' };
            }

            // Kullanıcıyı bul
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) {
                return { success: false, error: 'Kullanıcı sunucuda bulunamadı' };
            }

            // Ban uygula
            await member.ban({
                reason: reason,
                deleteMessageSeconds: 0 // Mesajları silme
            });

            // Ban süresini takip etmek için (manuel kaldırma için)
            setTimeout(async () => {
                try {
                    await guild.bans.remove(userId, 'Otomatik ban süresi doldu');
                    this.logger.info(`${member.user.username} için ban süresi doldu ve kaldırıldı.`);
                } catch (unbanError) {
                    this.logger.error(`Ban kaldırma hatası (${member.user.username}):`, unbanError.message);
                }
            }, days * 24 * 60 * 60 * 1000); // Gün cinsinden milisaniye

            return { success: true };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Disiplin sonuçlarını admin kanalına bildir
    async reportDisciplineResults(results, period) {
        try {
            const adminChannel = this.client.channels.cache.get(this.config.discord.adminModChannelId);
            if (!adminChannel) {
                this.logger.error('Admin kanalı bulunamadı!');
                return;
            }

            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            const embed = new EmbedBuilder()
                .setColor(successful.length > 0 ? '#ff0000' : '#ff9900')
                .setTitle('⚖️ Disiplin İşlemleri Raporu')
                .setDescription(`**${period}** dönemi için disiplin işlemleri tamamlandı.`)
                .setTimestamp();

            // Başarılı işlemler
            if (successful.length > 0) {
                const successText = successful.map(result => {
                    const violationText = result.violationCount === 1 ? '(1. İhlal)' : `(${result.violationCount}. İhlal)`;
                    return `• **${result.username}** - ${result.banDays} gün ban ${violationText}`;
                }).join('\n');

                embed.addFields({
                    name: `✅ Başarılı İşlemler (${successful.length})`,
                    value: successText,
                    inline: false
                });
            }

            // Başarısız işlemler
            if (failed.length > 0) {
                const failedText = failed.map(result => 
                    `• **${result.username}** - ${result.error}`
                ).join('\n');

                embed.addFields({
                    name: `❌ Başarısız İşlemler (${failed.length})`,
                    value: failedText,
                    inline: false
                });
            }

            // Genel bilgi
            embed.addFields({
                name: '📊 Özet',
                value: [
                    `🔨 Toplam İşlem: **${results.length}**`,
                    `✅ Başarılı: **${successful.length}**`,
                    `❌ Başarısız: **${failed.length}**`,
                    `⏰ İşlem Zamanı: **${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}**`
                ].join('\n'),
                inline: false
            });

            embed.setFooter({ text: `Dönem: ${period} | Otomatik Disiplin Sistemi` });

            await adminChannel.send({ embeds: [embed] });

        } catch (error) {
            this.logger.error('Disiplin raporu gönderilirken hata:', error.message);
        }
    }

    // Manuel disiplin uygulama (komut için)
    async applyManualDiscipline(targetUserId, reason, days = null) {
        try {
            const guild = this.client.guilds.cache.get(this.config.discord.guildId);
            if (!guild) {
                return { success: false, error: 'Guild bulunamadı' };
            }

            const member = await guild.members.fetch(targetUserId).catch(() => null);
            if (!member) {
                return { success: false, error: 'Kullanıcı bulunamadı' };
            }

            // Önceki ihlal sayısını al
            const violationCount = await this.database.getViolationCount(targetUserId);
            
            // Ban süresini hesapla (manuel belirtilmemişse otomatik hesapla)
            const banDays = days || (violationCount === 0 ? 
                this.config.discipline.firstViolationDays : 
                this.config.discipline.secondViolationDays
            );

            const currentPeriod = this.config.utils.getCurrentPeriod();

            // Disiplin kaydını veritabanına ekle
            await this.database.addDisciplineRecord(
                targetUserId,
                member.user.username,
                'manual',
                currentPeriod,
                banDays
            );

            // Ban uygula
            const banResult = await this.applyBan(targetUserId, banDays, reason);
            
            if (banResult.success) {
                this.logger.disciplineApplied(targetUserId, member.user.username, banDays, reason);
                
                return {
                    success: true,
                    username: member.user.username,
                    banDays,
                    violationCount: violationCount + 1
                };
            } else {
                return banResult;
            }

        } catch (error) {
            this.logger.error('Manuel disiplin uygulama hatası:', error.message);
            return { success: false, error: error.message };
        }
    }

    // İhlal geçmişini getir
    async getViolationHistory(userId, limit = 10) {
        try {
            const sql = `
                SELECT * FROM discipline_records 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            `;
            
            return new Promise((resolve, reject) => {
                this.database.db.all(sql, [userId, limit], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });

        } catch (error) {
            this.logger.error('İhlal geçmişi alınırken hata:', error.message);
            return [];
        }
    }
}

module.exports = DisciplineManager; 