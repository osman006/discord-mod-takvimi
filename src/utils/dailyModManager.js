const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class DailyModManager {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.database = client.database;
    }

    // Otomatik günlük mod seçimi
    async selectDailyMods(date = null) {
        try {
            if (!date) {
                date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            }

            this.logger.info(`Günlük mod seçimi başlıyor: ${date}`);

            // Gündüz için müsait modları al
            const dayMods = await this.database.getAvailableModerators('day');
            // Gece için müsait modları al  
            const nightMods = await this.database.getAvailableModerators('night');

            if (dayMods.length < 2) {
                throw new Error(`Gündüz için yeterli moderatör yok (${dayMods.length}/2)`);
            }

            if (nightMods.length < 2) {
                throw new Error(`Gece için yeterli moderatör yok (${nightMods.length}/2)`);
            }

            // Rastgele seçim yap
            const selectedDayMods = this.selectRandomMods(dayMods, 2);
            const selectedNightMods = this.selectRandomMods(nightMods, 2);

            // Veritabanına kaydet
            await this.database.saveDailyAssignment(
                date,
                selectedDayMods[0].user_id,
                selectedDayMods[1].user_id,
                selectedNightMods[0].user_id,
                selectedNightMods[1].user_id
            );

            // Admin kanalına bildir
            await this.announceDailyAssignment(date, selectedDayMods, selectedNightMods);

            // Seçilen modlara DM gönder
            await this.notifySelectedMods(date, selectedDayMods, selectedNightMods);

            this.logger.info(`Günlük mod seçimi tamamlandı: ${date}`);

            return {
                date,
                dayMods: selectedDayMods,
                nightMods: selectedNightMods
            };

        } catch (error) {
            this.logger.botError(error, 'Günlük mod seçimi');
            throw error;
        }
    }

    // Rastgele mod seçimi
    selectRandomMods(mods, count) {
        const shuffled = [...mods].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    // Günlük atamayı admin kanalında duyur
    async announceDailyAssignment(date, dayMods, nightMods) {
        try {
            const adminChannel = this.client.channels.cache.get(this.config.discord.adminModChannelId);
            if (!adminChannel) return;

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🌅 Günlük Moderatör Ataması')
                .setDescription(`**${this.formatDate(date)}** tarihli moderatör ataması`)
                .addFields(
                    {
                        name: '☀️ Gündüz Vardiyası (08:00-20:00)',
                        value: dayMods.map((mod, index) => 
                            `**${index + 1}.** <@${mod.user_id}> (${mod.username})`
                        ).join('\n'),
                        inline: false
                    },
                    {
                        name: '🌙 Gece Vardiyası (20:00-08:00)',
                        value: nightMods.map((mod, index) => 
                            `**${index + 1}.** <@${mod.user_id}> (${mod.username})`
                        ).join('\n'),
                        inline: false
                    }
                )
                .setFooter({ text: 'Otomatik seçim sistemi tarafından atanmıştır.' })
                .setTimestamp();

            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`reselect_daily_${date}`)
                        .setLabel('Yeniden Seç')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setCustomId(`manual_assign_${date}`)
                        .setLabel('Manuel Ata')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✋')
                );

            await adminChannel.send({
                embeds: [embed],
                components: [actionRow]
            });

        } catch (error) {
            this.logger.error('Günlük atama duyurusu gönderilirken hata:', error.message);
        }
    }

    // Seçilen modlara DM gönder
    async notifySelectedMods(date, dayMods, nightMods) {
        const allSelectedMods = [...dayMods, ...nightMods];

        for (const mod of allSelectedMods) {
            try {
                const user = await this.client.users.fetch(mod.user_id);
                const isDayMod = dayMods.some(d => d.user_id === mod.user_id);
                const shift = isDayMod ? 'Gündüz (08:00-20:00)' : 'Gece (20:00-08:00)';

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('👮‍♂️ Moderatör Görevi')
                    .setDescription(`**${this.formatDate(date)}** tarihinde moderatör görevine atandınız!`)
                    .addFields({
                        name: '📅 Vardiya Bilgileri',
                        value: `**Tarih:** ${this.formatDate(date)}\n**Vardiya:** ${shift}`,
                        inline: false
                    })
                    .setFooter({ text: 'Görevi kabul etmezseniz lütfen admin ekibiyle iletişime geçin.' })
                    .setTimestamp();

                await user.send({ embeds: [embed] });
                this.logger.info(`Görev bildirimi gönderildi: ${mod.username} (${shift})`);

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                this.logger.error(`${mod.username} kullanıcısına DM gönderilemedi:`, error.message);
            }
        }
    }

    // Günün mod atamasını getir
    async getTodayAssignment() {
        const today = new Date().toISOString().split('T')[0];
        const assignment = await this.database.getDailyAssignment(today);

        if (!assignment) {
            return null;
        }

        // Moderatör bilgilerini al
        const dayMod1 = await this.getModeratorInfo(assignment.day_mod_1);
        const dayMod2 = await this.getModeratorInfo(assignment.day_mod_2);
        const nightMod1 = await this.getModeratorInfo(assignment.night_mod_1);
        const nightMod2 = await this.getModeratorInfo(assignment.night_mod_2);

        return {
            date: assignment.date,
            dayMods: [dayMod1, dayMod2].filter(Boolean),
            nightMods: [nightMod1, nightMod2].filter(Boolean)
        };
    }

    // Moderatör bilgilerini getir
    async getModeratorInfo(userId) {
        if (!userId) return null;

        const sql = `SELECT * FROM moderators WHERE user_id = ?`;
        
        return new Promise((resolve, reject) => {
            this.database.db.get(sql, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        resolve({
                            ...row,
                            roles: JSON.parse(row.roles || '[]')
                        });
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    }

    // O an aktif olan modları bul
    async getCurrentActiveMods() {
        const now = new Date();
        const currentHour = now.getHours();
        const today = now.toISOString().split('T')[0];

        const assignment = await this.database.getDailyAssignment(today);
        if (!assignment) return [];

        // 08:00-20:00 gündüz, 20:00-08:00 gece
        const isDayTime = currentHour >= 8 && currentHour < 20;

        let activeMods = [];

        if (isDayTime) {
            // Gündüz vardiyası
            const dayMod1 = await this.getModeratorInfo(assignment.day_mod_1);
            const dayMod2 = await this.getModeratorInfo(assignment.day_mod_2);
            activeMods = [dayMod1, dayMod2].filter(Boolean);
        } else {
            // Gece vardiyası
            const nightMod1 = await this.getModeratorInfo(assignment.night_mod_1);
            const nightMod2 = await this.getModeratorInfo(assignment.night_mod_2);
            activeMods = [nightMod1, nightMod2].filter(Boolean);
        }

        return activeMods.map(mod => ({
            ...mod,
            shift: isDayTime ? 'Gündüz' : 'Gece',
            shiftTime: isDayTime ? '08:00-20:00' : '20:00-08:00'
        }));
    }

    // Yeniden seçim yap
    async reselectDailyMods(date) {
        try {
            // Eski atamayı sil
            const sql = `DELETE FROM daily_assignments WHERE date = ?`;
            await new Promise((resolve, reject) => {
                this.database.db.run(sql, [date], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Yeniden seç
            return await this.selectDailyMods(date);

        } catch (error) {
            this.logger.error('Yeniden seçim hatası:', error.message);
            throw error;
        }
    }

    // Tarih formatla
    formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('tr-TR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Interaction'ları yönet
    async handleInteraction(interaction) {
        try {
            if (interaction.isButton() && interaction.customId.startsWith('reselect_daily_')) {
                await this.handleReselect(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('manual_assign_')) {
                await this.handleManualAssign(interaction);
            }
        } catch (error) {
            this.logger.error('Daily mod interaction hatası:', error.message);
        }
    }

    // Yeniden seçim buton handler
    async handleReselect(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const date = interaction.customId.split('_')[2];
            const result = await this.reselectDailyMods(date);

            await interaction.editReply({
                content: `✅ **${this.formatDate(date)}** için yeniden seçim yapıldı!\n` +
                        `🌅 Gündüz: ${result.dayMods.map(m => m.username).join(', ')}\n` +
                        `🌙 Gece: ${result.nightMods.map(m => m.username).join(', ')}`
            });

        } catch (error) {
            await interaction.editReply({
                content: `❌ Yeniden seçim hatası: ${error.message}`
            });
        }
    }

    // Manuel atama buton handler
    async handleManualAssign(interaction) {
        await interaction.reply({
            content: '📝 Manuel atama için `/admin daily assign` komutunu kullanın.',
            ephemeral: true
        });
    }
}

module.exports = DailyModManager; 