const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

class SurveyManager {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
        this.database = client.database;
    }

    // Günlük takvim anketi gönder
    async sendDailyScheduleSurvey(user, date) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📅 Günlük Moderatör Takvimi')
                .setDescription(`**${date}** tarihli moderatör takvimi için müsaitlik durumunuzu belirtiniz.`)
                .addFields(
                    {
                        name: '⏰ Yanıt Süresi',
                        value: '**5 saat** içinde yanıt vermeniz gerekmektedir.',
                        inline: false
                    },
                    {
                        name: '⚠️ Önemli Uyarı',
                        value: 'Zamanında yanıt vermezseniz otomatik ceza uygulanacaktır!',
                        inline: false
                    },
                    {
                        name: '📝 Yapmanız Gerekenler',
                        value: '• Müsait olduğunuz vardiyaları seçin\n• Hiç müsait değilseniz mazeret belirtin\n• Hemen yanıt verin!',
                        inline: false
                    }
                )
                .setFooter({ text: `Tarih: ${date} | Son yanıt: ${new Date(Date.now() + 5 * 60 * 60 * 1000).toLocaleString('tr-TR')}` })
                .setTimestamp();

            // Vardiya seçimi için select menu
            const shiftSelectMenu = new StringSelectMenuBuilder()
                .setCustomId(`daily_shift_select_${date}`)
                .setPlaceholder('Müsait olduğunuz vardiyaları seçin...')
                .setMinValues(0)
                .setMaxValues(5)
                .addOptions([
                    {
                        label: '🌚 Vardiya 1 - Gece Yarısı',
                        description: '00:00-05:00 saatleri arası',
                        value: 'slot1',
                        emoji: '🌚'
                    },
                    {
                        label: '🌅 Vardiya 2 - Sabah',
                        description: '05:00-10:00 saatleri arası',
                        value: 'slot2',
                        emoji: '🌅'
                    },
                    {
                        label: '☀️ Vardiya 3 - Öğlen',
                        description: '10:00-15:00 saatleri arası',
                        value: 'slot3',
                        emoji: '☀️'
                    },
                    {
                        label: '🌤️ Vardiya 4 - Öğleden Sonra',
                        description: '15:00-20:00 saatleri arası',
                        value: 'slot4',
                        emoji: '🌤️'
                    },
                    {
                        label: '🌆 Vardiya 5 - Akşam-Gece',
                        description: '20:00-00:00 saatleri arası',
                        value: 'slot5',
                        emoji: '🌆'
                    }
                ]);

            // Butonlar
            const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`daily_submit_${date}`)
                        .setLabel('✅ Seçimimi Onayla')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`daily_excuse_${date}`)
                        .setLabel('📝 Mazeret Belirt')
                        .setStyle(ButtonStyle.Secondary)
                );

            const selectRow = new ActionRowBuilder().addComponents(shiftSelectMenu);

            await user.send({
                embeds: [embed],
                components: [selectRow, buttonRow]
            });

            this.logger.info(`${user.username} kullanıcısına günlük takvim anketi gönderildi`);

        } catch (error) {
            this.logger.error(`${user.username} kullanıcısına günlük anket gönderme hatası:`, error.message);
            throw error;
        }
    }

    // Tüm moderatörlere anket gönder
    async sendSurveyToAllMods(period) {
        try {
            const moderators = await this.database.getActiveModerators();
            let sent = 0;
            let failed = 0;

            for (const mod of moderators) {
                try {
                    const user = await this.client.users.fetch(mod.user_id);
                    await this.sendSurveyDM(user, period);
                    sent++;
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    failed++;
                    this.logger.error(`${mod.username} kullanıcısına anket gönderilemedi:`, error.message);
                }
            }

            return { sent, failed };

        } catch (error) {
            this.logger.error('Toplu anket gönderme hatası:', error.message);
            throw error;
        }
    }

    // Ana DM anket mesajını gönder
    async sendSurveyDM(user, period) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🗓️ Moderatör Çalışma Takvimi Anketi')
                .setDescription(`**${period} dönemi** için çalışma saatlerinizi belirtmeniz gerekiyor.`)
                .addFields(
                    {
                        name: '📋 Yapmanız Gerekenler',
                        value: '• Müsait olduğunuz saat aralıklarını seçin\n• Eğer hiç müsait değilseniz, sebebini belirtin\n• **Yanıt verme süresi: 24 saat**'
                    },
                    {
                        name: '⚠️ Önemli',
                        value: 'Bu anketi zamanında doldurmadığınız takdirde disiplin cezası uygulanacaktır.'
                    }
                )
                .setFooter({ text: `Dönem: ${period} | Son yanıt tarihi: ${this.getDeadlineText()}` })
                .setTimestamp();

            // Saat seçimi için select menu
            const timeSelectMenu = new StringSelectMenuBuilder()
                .setCustomId(`time_select_${period}`)
                .setPlaceholder('Müsait olduğunuz saat aralıklarını seçin...')
                .setMinValues(0)
                .setMaxValues(this.config.timeSlots.length)
                .addOptions(
                    this.config.timeSlots.map((slot, index) => ({
                        label: slot,
                        description: `${slot} saatleri arası`,
                        value: slot,
                        emoji: '🕐'
                    }))
                );

            // Butonlar
            const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_availability_${period}`)
                        .setLabel('Seçimimi Onayla')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`not_available_${period}`)
                        .setLabel('Müsait Değilim')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );

            const selectRow = new ActionRowBuilder()
                .addComponents(timeSelectMenu);

            await user.send({
                embeds: [embed],
                components: [selectRow, buttonRow]
            });

            this.logger.info(`DM anketi gönderildi: ${user.username} (${period})`);
            
        } catch (error) {
            this.logger.error(`DM gönderme hatası - ${user.username}:`, error.message);
            
            // DM gönderilemezse admin kanalına bildir
            await this.notifyDMFailed(user, period, error.message);
            throw error;
        }
    }

    // DM gönderilemediğinde admin kanalını bilgilendir
    async notifyDMFailed(user, period, error) {
        try {
            const adminChannel = this.client.channels.cache.get(this.config.discord.adminModChannelId);
            if (!adminChannel) return;

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ DM Gönderim Hatası')
                .setDescription(`**${user.username}** kullanıcısına ${period} dönemi anketi gönderilemedi.`)
                .addFields(
                    {
                        name: 'Kullanıcı',
                        value: `<@${user.id}> (${user.username})`,
                        inline: true
                    },
                    {
                        name: 'Hata',
                        value: error.substring(0, 1000),
                        inline: false
                    },
                    {
                        name: 'Yapılacaklar',
                        value: '• Kullanıcıya manuel olarak ulaşın\n• DM ayarlarını kontrol etmesini isteyin\n• Yanıtını buraya yazmasını söyleyin'
                    }
                )
                .setTimestamp();

            await adminChannel.send({ embeds: [embed] });
        } catch (adminError) {
            this.logger.error('Admin kanalına bildirim gönderilirken hata:', adminError.message);
        }
    }

    // Saat seçimi işlemi
    async handleTimeSelection(interaction) {
        try {
            const period = this.extractPeriodFromId(interaction.customId);
            const selectedTimes = interaction.values;

            // Geçici olarak seçimleri sakla (interaction için)
            this.tempSelections = this.tempSelections || {};
            this.tempSelections[interaction.user.id] = {
                period,
                selectedTimes,
                timestamp: Date.now()
            };

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Saat Seçimi Yapıldı')
                .setDescription('Seçtiğiniz saat aralıkları:')
                .addFields({
                    name: 'Müsait Saatleriniz',
                    value: selectedTimes.length > 0 ? selectedTimes.map(time => `• ${time}`).join('\n') : 'Hiçbir saat seçmediniz',
                    inline: false
                })
                .setFooter({ text: 'Onaylamak için "Seçimimi Onayla" butonuna basın.' });

            await interaction.update({ embeds: [embed] });

        } catch (error) {
            this.logger.error('Saat seçimi hatası:', error.message);
            await interaction.reply({ 
                content: '❌ Saat seçimi sırasında bir hata oluştu. Lütfen tekrar deneyin.', 
                ephemeral: true 
            });
        }
    }

    // Müsaitlik onaylama
    async handleAvailabilityConfirm(interaction) {
        try {
            const period = this.extractPeriodFromId(interaction.customId);
            const userId = interaction.user.id;
            const username = interaction.user.username;

            // Geçici seçimleri al
            const tempSelection = this.tempSelections?.[userId];
            if (!tempSelection || tempSelection.period !== period) {
                await interaction.reply({ 
                    content: '❌ Önce saat aralıklarınızı seçmeniz gerekiyor.', 
                    ephemeral: true 
                });
                return;
            }

            // Veritabanına kaydet
            await this.database.saveModResponse(
                userId,
                username,
                period,
                tempSelection.selectedTimes,
                '' // excuse boş
            );

            // Geçici veriyi temizle
            delete this.tempSelections[userId];

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Yanıtınız Kaydedildi')
                .setDescription(`**${period}** dönemi için yanıtınız başarıyla kaydedildi.`)
                .addFields({
                    name: 'Seçtiğiniz Saatler',
                    value: tempSelection.selectedTimes.length > 0 
                        ? tempSelection.selectedTimes.map(time => `• ${time}`).join('\n')
                        : 'Hiçbir saat seçilmedi',
                    inline: false
                })
                .setFooter({ text: 'Teşekkür ederiz! Takvim yayınlandığında bilgilendirileceksiniz.' })
                .setTimestamp();

            await interaction.update({ embeds: [embed], components: [] });

            this.logger.surveyResponse(userId, username, period);

        } catch (error) {
            this.logger.error('Müsaitlik onaylama hatası:', error.message);
            await interaction.reply({ 
                content: '❌ Yanıtınız kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.', 
                ephemeral: true 
            });
        }
    }

    // Müsait değilim seçeneği
    async handleNotAvailable(interaction) {
        try {
            const period = this.extractPeriodFromId(interaction.customId);

            // Modal oluştur
            const modal = new ModalBuilder()
                .setCustomId(`excuse_modal_${period}`)
                .setTitle('Müsait Olmama Sebebi');

            const excuseInput = new TextInputBuilder()
                .setCustomId('excuse_text')
                .setLabel('Neden müsait değilsiniz?')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Örnek: Sınav haftası, tatil, hastalık vb.')
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(500);

            const actionRow = new ActionRowBuilder().addComponents(excuseInput);
            modal.addComponents(actionRow);

            await interaction.showModal(modal);

        } catch (error) {
            this.logger.error('Modal gösterme hatası:', error.message);
            await interaction.reply({ 
                content: '❌ Form açılırken bir hata oluştu. Lütfen tekrar deneyin.', 
                ephemeral: true 
            });
        }
    }

    // Mazeret modalı işleme
    async handleExcuseModal(interaction) {
        try {
            const period = this.extractPeriodFromId(interaction.customId);
            const excuse = interaction.fields.getTextInputValue('excuse_text');
            const userId = interaction.user.id;
            const username = interaction.user.username;

            // Veritabanına kaydet (müsait saatler boş array)
            await this.database.saveModResponse(
                userId,
                username,
                period,
                [], // boş availability array
                excuse
            );

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('✅ Mazeretiniz Kaydedildi')
                .setDescription(`**${period}** dönemi için mazeretiniz kaydedildi.`)
                .addFields({
                    name: 'Mazeret Sebebiniz',
                    value: excuse,
                    inline: false
                })
                .setFooter({ text: 'Mazeretiniz değerlendirilecek ve size geri dönüş yapılacaktır.' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: false });

            this.logger.surveyResponse(userId, username, period);

        } catch (error) {
            this.logger.error('Mazeret modal işleme hatası:', error.message);
            await interaction.reply({ 
                content: '❌ Mazeretiniz kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.', 
                ephemeral: true 
            });
        }
    }

    // Yardımcı fonksiyonlar
    extractPeriodFromId(customId) {
        // "time_select_2025-W32" -> "2025-W32"
        const parts = customId.split('_');
        return parts[parts.length - 1];
    }

    getDeadlineText() {
        const deadline = new Date(Date.now() + this.config.schedule.responseTimeoutHours * 60 * 60 * 1000);
        return deadline.toLocaleString('tr-TR', { 
            timeZone: 'Europe/Istanbul',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Tüm interaction'ları yönet
    async handleInteraction(interaction) {
        try {
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('time_select_')) {
                await this.handleTimeSelection(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('confirm_availability_')) {
                await this.handleAvailabilityConfirm(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('not_available_')) {
                await this.handleNotAvailable(interaction);
            } else if (interaction.isModalSubmit() && interaction.customId.startsWith('excuse_modal_')) {
                await this.handleExcuseModal(interaction);
            }
        } catch (error) {
            this.logger.error('Interaction handling hatası:', error.message);
        }
    }
}

module.exports = SurveyManager; 