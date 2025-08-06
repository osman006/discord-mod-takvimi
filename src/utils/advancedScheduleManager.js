const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class AdvancedScheduleManager {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.database = client.database;
        this.logger = client.logger;
        
        // 24 saati 5 moda böl (her mod ~4.8 saat)
        this.timeSlots = [
            { id: 'slot1', name: 'Vardiya 1', time: '00:00-05:00', emoji: '🌚', description: 'Gece Yarısı' },
            { id: 'slot2', name: 'Vardiya 2', time: '05:00-10:00', emoji: '🌅', description: 'Sabah' },
            { id: 'slot3', name: 'Vardiya 3', time: '10:00-15:00', emoji: '☀️', description: 'Öğlen' },
            { id: 'slot4', name: 'Vardiya 4', time: '15:00-20:00', emoji: '🌤️', description: 'Öğleden Sonra' },
            { id: 'slot5', name: 'Vardiya 5', time: '20:00-00:00', emoji: '🌆', description: 'Akşam-Gece' }
        ];
    }

    // Kullanıcıya özel kısıtlama ayarla
    async setUserRestriction(userId, allowedSlots, restrictedSlots = []) {
        try {
            await this.database.updateModeratorRestrictions(userId, {
                allowed_slots: JSON.stringify(allowedSlots),
                restricted_slots: JSON.stringify(restrictedSlots),
                updated_at: new Date().toISOString()
            });

            this.logger.info(`Kullanıcı kısıtlaması ayarlandı: ${userId}`, {
                allowedSlots,
                restrictedSlots
            });

            return true;
        } catch (error) {
            this.logger.error('Kullanıcı kısıtlama hatası', error, 'AdvancedSchedule');
            return false;
        }
    }

    // Kullanıcının müsait olduğu saatleri al
    async getUserAvailableSlots(userId) {
        try {
            const moderator = await this.database.getModerator(userId);
            if (!moderator) return this.timeSlots.map(slot => slot.id);

            const allowedSlots = moderator.allowed_slots ? 
                JSON.parse(moderator.allowed_slots) : 
                this.timeSlots.map(slot => slot.id);

            const restrictedSlots = moderator.restricted_slots ? 
                JSON.parse(moderator.restricted_slots) : [];

            return allowedSlots.filter(slot => !restrictedSlots.includes(slot));
        } catch (error) {
            this.logger.error('Kullanıcı müsait saatleri alma hatası', error);
            return this.timeSlots.map(slot => slot.id);
        }
    }

    // Haftalık anket DM'i gönder (gelişmiş)
    async sendAdvancedSurveyDM(user, period) {
        try {
            // Kullanıcının müsait olduğu saatleri al
            const availableSlots = await this.getUserAvailableSlots(user.id);
            const userSlots = this.timeSlots.filter(slot => availableSlots.includes(slot.id));

            if (userSlots.length === 0) {
                this.logger.warn(`${user.username} için müsait saat yok!`);
                return false;
            }

            const embed = new EmbedBuilder()
                .setTitle('📅 Haftalık Moderatör Takvimi Anketi')
                .setDescription(`**${period}** haftası için müsaitlik anketiniz:`)
                .setColor('#0099ff')
                .addFields(
                    {
                        name: '⏰ Hangi saatlerde müsaitsiniz?',
                        value: 'Aşağıdan müsait olduğunuz **TÜM** saatleri seçin:\n\n' +
                               userSlots.map(slot => `${slot.emoji} **${slot.name}** (${slot.time})`).join('\n'),
                        inline: false
                    },
                    {
                        name: '⚠️ Önemli',
                        value: '• Birden fazla saat seçebilirsiniz\n• İlk seçen öncelikli olur\n• Süre: **24 saat**',
                        inline: false
                    }
                )
                .setFooter({ text: `Son tarih: ${this.getDeadlineText(period)}` })
                .setTimestamp();

            // Saat seçim menüsü
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`schedule_select_${period}`)
                .setPlaceholder('Müsait olduğunuz saatleri seçin...')
                .setMinValues(1)
                .setMaxValues(userSlots.length)
                .addOptions(
                    userSlots.map(slot => ({
                        label: `${slot.name} (${slot.time})`,
                        description: `${slot.emoji} ${slot.name} vardiyası`,
                        value: slot.id
                    }))
                );

            // Butonlar
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`schedule_excuse_${period}`)
                        .setLabel('🚫 Bu Hafta Müsait Değilim')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`schedule_help_${period}`)
                        .setLabel('❓ Yardım')
                        .setStyle(ButtonStyle.Secondary)
                );

            const selectRow = new ActionRowBuilder().addComponents(selectMenu);

            await user.send({
                embeds: [embed],
                components: [selectRow, buttons]
            });

            this.logger.info(`Gelişmiş anket DM'i gönderildi: ${user.username}`, {
                availableSlots: userSlots.length
            });

            return true;

        } catch (error) {
            this.logger.error(`${user.username} kullanıcısına gelişmiş DM gönderilemedi`, error);
            return false;
        }
    }

    // Saat çakışma kontrolü
    async checkTimeSlotConflict(period, slotId, userId) {
        try {
            const existingAssignments = await this.database.getSlotAssignments(period, slotId);
            
            if (existingAssignments.length > 0) {
                const conflictUser = existingAssignments[0];
                return {
                    hasConflict: true,
                    conflictUser: conflictUser,
                    message: `🚫 **Üzgünüm, geç kaldın!**\n\n**${this.getSlotName(slotId)}** saati zaten **${conflictUser.username}** tarafından alındı.\n\nLütfen başka bir saat dilimi seçin.`
                };
            }

            return { hasConflict: false };

        } catch (error) {
            this.logger.error('Saat çakışma kontrolü hatası', error);
            return { hasConflict: false };
        }
    }

    // Saat seçimini kaydet
    async saveTimeSlotSelection(userId, period, selectedSlots, responseTime) {
        try {
            const results = [];

            for (const slotId of selectedSlots) {
                // Çakışma kontrolü
                const conflictCheck = await this.checkTimeSlotConflict(period, slotId, userId);
                
                if (conflictCheck.hasConflict) {
                    results.push({
                        slotId,
                        success: false,
                        message: conflictCheck.message
                    });
                    continue;
                }

                // Saat atamasını kaydet
                await this.database.saveSlotAssignment({
                    user_id: userId,
                    period: period,
                    slot_id: slotId,
                    slot_name: this.getSlotName(slotId),
                    assigned_at: responseTime
                });

                results.push({
                    slotId,
                    success: true,
                    message: `✅ **${this.getSlotName(slotId)}** saati başarıyla atandı!`
                });
            }

            return results;

        } catch (error) {
            this.logger.error('Saat seçimi kaydetme hatası', error);
            return [];
        }
    }

    // Yardımcı fonksiyonlar
    getSlotName(slotId) {
        const slot = this.timeSlots.find(s => s.id === slotId);
        return slot ? `${slot.emoji} ${slot.name} (${slot.time}) - ${slot.description}` : slotId;
    }

    getDeadlineText(period) {
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + 24);
        return deadline.toLocaleString('tr-TR');
    }

    // Günlük atama özeti oluştur
    async createDailyAssignmentSummary(date) {
        try {
            const assignments = await this.database.getDailySlotAssignments(date);
            
            if (assignments.length === 0) {
                return {
                    embed: new EmbedBuilder()
                        .setTitle('📅 Günlük Moderatör Ataması')
                        .setDescription(`**${date}** için henüz atama yapılmamış.`)
                        .setColor('#ffaa00')
                        .setTimestamp()
                };
            }

            const embed = new EmbedBuilder()
                .setTitle('📅 Günlük Moderatör Ataması')
                .setDescription(`**${date}** tarihli vardiya atamaları:`)
                .setColor('#00ff00')
                .setTimestamp();

            // Saatlere göre grupla
            const slotGroups = {};
            assignments.forEach(assignment => {
                if (!slotGroups[assignment.slot_id]) {
                    slotGroups[assignment.slot_id] = [];
                }
                slotGroups[assignment.slot_id].push(assignment);
            });

            // Her saat dilimi için field ekle
            for (const [slotId, slotAssignments] of Object.entries(slotGroups)) {
                const slotName = this.getSlotName(slotId);
                const users = slotAssignments.map(a => `<@${a.user_id}>`).join('\n');
                
                embed.addFields({
                    name: slotName,
                    value: users || 'Atama yok',
                    inline: true
                });
            }

            return { embed };

        } catch (error) {
            this.logger.error('Günlük atama özeti hatası', error);
            return null;
        }
    }
}

module.exports = AdvancedScheduleManager; 