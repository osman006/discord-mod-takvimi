const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class SchedulePublisher {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.database = client.database;
    }

    // Takvimi yayınla
    async publishSchedule(period) {
        try {
            this.logger.info(`Takvim yayınlanıyor: ${period}`);

            // Yanıtları al
            const responses = await this.database.getResponsesForPeriod(period);
            
            if (responses.length === 0) {
                this.logger.warn(`${period} dönemi için yanıt bulunamadı.`);
                return;
            }

            // Admin kanalını al
            const adminChannel = this.client.channels.cache.get(this.config.discord.adminModChannelId);
            if (!adminChannel) {
                this.logger.error('Admin kanalı bulunamadı!');
                return;
            }

            // Embed'i oluştur
            const embed = await this.createScheduleEmbed(period, responses);
            
            // Butonları oluştur
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`refresh_schedule_${period}`)
                        .setLabel('Yenile')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setCustomId(`export_schedule_${period}`)
                        .setLabel('Dışa Aktar')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📊')
                );

            await adminChannel.send({
                embeds: [embed],
                components: [actionRow]
            });

            this.logger.info(`Takvim başarıyla yayınlandı: ${period}`);

        } catch (error) {
            this.logger.botError(error, 'Takvim yayınlama');
        }
    }

    // Takvim embed'ini oluştur
    async createScheduleEmbed(period, responses) {
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(`📅 Moderatör Çalışma Takvimi - ${period}`)
            .setDescription('Moderatörlerin müsaitlik durumu ve çalışma saatleri')
            .setTimestamp();

        // İstatistikleri hesapla
        const stats = this.calculateStats(responses);
        
        embed.addFields({
            name: '📊 Genel İstatistikler',
            value: [
                `👥 Toplam Moderatör: **${stats.totalMods}**`,
                `✅ Yanıt Veren: **${stats.responded}**`,
                `❌ Yanıt Vermeyen: **${stats.notResponded}**`,
                `🚫 Mazeretli: **${stats.excused}**`,
                `🟢 Aktif Olacak: **${stats.available}**`
            ].join('\n'),
            inline: false
        });

        // Saat aralığı başına moderatör sayısı
        const timeSlotStats = this.calculateTimeSlotStats(responses);
        if (timeSlotStats.length > 0) {
            embed.addFields({
                name: '⏰ Saat Aralığı Başına Moderatör Sayısı',
                value: timeSlotStats.map(slot => 
                    `**${slot.time}**: ${slot.count} moderatör`
                ).join('\n'),
                inline: false
            });
        }

        // Moderatör detayları
        const modDetails = this.formatModeratorDetails(responses);
        if (modDetails.length > 0) {
            // Discord embed field limiti 25, her field max 1024 karakter
            const chunks = this.chunkModeratorDetails(modDetails);
            
            chunks.forEach((chunk, index) => {
                embed.addFields({
                    name: index === 0 ? '👥 Moderatör Detayları' : `👥 Moderatör Detayları (Devamı ${index + 1})`,
                    value: chunk,
                    inline: false
                });
            });
        }

        // Yanıt vermeyen moderatörler
        const notResponded = await this.getNotRespondedModerators(period, responses);
        if (notResponded.length > 0) {
            embed.addFields({
                name: '⚠️ Yanıt Vermeyen Moderatörler',
                value: notResponded.map(mod => `• **${mod.username}** - Disiplin uygulanacak`).join('\n'),
                inline: false
            });
        }

        embed.setFooter({ 
            text: `Son güncelleme: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}` 
        });

        return embed;
    }

    // İstatistikleri hesapla
    calculateStats(responses) {
        const totalMods = responses.length;
        const responded = responses.length;
        const excused = responses.filter(r => r.excuse && r.excuse.trim() !== '').length;
        const available = responses.filter(r => r.availability && r.availability.length > 0).length;
        
        // Yanıt vermeyen sayısını hesaplamak için tüm moderatörleri almamız gerekir
        // Bu fonksiyonu ayrı bir yerde çağıracağız
        
        return {
            totalMods,
            responded,
            notResponded: 0, // Bu değeri başka yerden alacağız
            excused,
            available
        };
    }

    // Saat aralığı istatistiklerini hesapla
    calculateTimeSlotStats(responses) {
        const timeSlotCounts = {};
        
        // Her saat aralığını 0 ile başlat
        this.config.timeSlots.forEach(slot => {
            timeSlotCounts[slot] = 0;
        });

        // Yanıtları say
        responses.forEach(response => {
            if (response.availability && response.availability.length > 0) {
                response.availability.forEach(slot => {
                    if (timeSlotCounts.hasOwnProperty(slot)) {
                        timeSlotCounts[slot]++;
                    }
                });
            }
        });

        // Sıralı liste olarak döndür
        return Object.entries(timeSlotCounts)
            .map(([time, count]) => ({ time, count }))
            .sort((a, b) => {
                // Saat sırasına göre sırala
                const timeA = parseInt(a.time.split(':')[0]);
                const timeB = parseInt(b.time.split(':')[0]);
                return timeA - timeB;
            });
    }

    // Moderatör detaylarını formatla
    formatModeratorDetails(responses) {
        return responses.map(response => {
            const username = response.username;
            
            if (response.excuse && response.excuse.trim() !== '') {
                return `🚫 **${username}**: Mazeretli - "${response.excuse}"`;
            } else if (response.availability && response.availability.length > 0) {
                const times = response.availability.join(', ');
                return `🟢 **${username}**: ${times}`;
            } else {
                return `❌ **${username}**: Müsait değil`;
            }
        }).sort();
    }

    // Moderatör detaylarını chunklara böl (Discord field limiti için)
    chunkModeratorDetails(details) {
        const chunks = [];
        let currentChunk = '';
        
        for (const detail of details) {
            if ((currentChunk + detail + '\n').length > 1000) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }
            }
            currentChunk += detail + '\n';
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }

    // Yanıt vermeyen moderatörleri bul
    async getNotRespondedModerators(period, responses) {
        try {
            // Tüm aktif moderatörleri al
            const allModerators = await this.database.getActiveModerators();
            
            // Yanıt veren moderatör ID'lerini al
            const respondedIds = responses.map(r => r.user_id);
            
            // Yanıt vermeyenleri filtrele
            const notResponded = allModerators.filter(mod => 
                !respondedIds.includes(mod.user_id)
            );

            return notResponded.map(mod => ({
                userId: mod.user_id,
                username: mod.username
            }));

        } catch (error) {
            this.logger.error('Yanıt vermeyen moderatörler alınırken hata:', error.message);
            return [];
        }
    }

    // Takvimi yenile
    async refreshSchedule(interaction) {
        try {
            await interaction.deferUpdate();

            const period = this.extractPeriodFromId(interaction.customId);
            const responses = await this.database.getResponsesForPeriod(period);
            
            const embed = await this.createScheduleEmbed(period, responses);
            
            await interaction.editReply({
                embeds: [embed]
            });

            this.logger.info(`Takvim yenilendi: ${period}`);

        } catch (error) {
            this.logger.error('Takvim yenileme hatası:', error.message);
            await interaction.followUp({
                content: '❌ Takvim yenilenirken bir hata oluştu.',
                ephemeral: true
            });
        }
    }

    // Takvimi dışa aktar (CSV formatında)
    async exportSchedule(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const period = this.extractPeriodFromId(interaction.customId);
            const responses = await this.database.getResponsesForPeriod(period);
            
            if (responses.length === 0) {
                await interaction.editReply({
                    content: '❌ Dışa aktarılacak veri bulunamadı.'
                });
                return;
            }

            const csvContent = this.generateCSV(responses);
            const fileName = `moderator_schedule_${period}.csv`;
            
            // CSV dosyasını geçici olarak oluştur
            const fs = require('fs');
            const path = require('path');
            const tempPath = path.join(process.cwd(), 'temp');
            
            if (!fs.existsSync(tempPath)) {
                fs.mkdirSync(tempPath, { recursive: true });
            }
            
            const filePath = path.join(tempPath, fileName);
            fs.writeFileSync(filePath, csvContent, 'utf8');

            await interaction.editReply({
                content: `📊 Takvim dışa aktarıldı: **${period}**`,
                files: [{
                    attachment: filePath,
                    name: fileName
                }]
            });

            // Geçici dosyayı sil
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }, 5000);

            this.logger.info(`Takvim dışa aktarıldı: ${period}`);

        } catch (error) {
            this.logger.error('Takvim dışa aktarma hatası:', error.message);
            await interaction.editReply({
                content: '❌ Takvim dışa aktarılırken bir hata oluştu.'
            });
        }
    }

    // CSV içeriği oluştur
    generateCSV(responses) {
        const headers = ['Kullanıcı Adı', 'Müsait Saatler', 'Mazeret', 'Yanıt Tarihi'];
        const rows = [headers.join(',')];

        responses.forEach(response => {
            const username = `"${response.username}"`;
            const availability = `"${response.availability ? response.availability.join('; ') : ''}"`;
            const excuse = `"${response.excuse || ''}"`;
            const respondedAt = `"${new Date(response.responded_at).toLocaleString('tr-TR')}"`;
            
            rows.push([username, availability, excuse, respondedAt].join(','));
        });

        return rows.join('\n');
    }

    // Yardımcı fonksiyonlar
    extractPeriodFromId(customId) {
        const parts = customId.split('_');
        return parts[parts.length - 1];
    }

    // Interaction'ları yönet
    async handleInteraction(interaction) {
        try {
            if (interaction.isButton() && interaction.customId.startsWith('refresh_schedule_')) {
                await this.refreshSchedule(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('export_schedule_')) {
                await this.exportSchedule(interaction);
            }
        } catch (error) {
            this.logger.error('Schedule publisher interaction hatası:', error.message);
        }
    }
}

module.exports = SchedulePublisher; 