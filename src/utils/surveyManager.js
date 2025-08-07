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
                .setMaxValues(1)
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
            // Günlük anket interaction'ları
            else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('daily_shift_select_')) {
                await this.handleDailyShiftSelection(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('daily_submit_')) {
                await this.handleDailySubmit(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('daily_excuse_')) {
                await this.handleDailyExcuse(interaction);
            } else if (interaction.isModalSubmit() && interaction.customId.startsWith('daily_excuse_modal_')) {
                await this.handleDailyExcuseModal(interaction);
            }
        } catch (error) {
            this.logger.error('Interaction handling hatası:', error.message);
        }
    }

    // Günlük vardiya seçimi handler'ı
    async handleDailyShiftSelection(interaction) {
        try {
            const date = this.extractDateFromDailyId(interaction.customId);
            const selectedShifts = interaction.values;
            const userId = interaction.user.id;

            // Kullanıcının bu tarih için zaten seçim yapıp yapmadığını kontrol et
            const existingSelection = await this.database.getDailyShiftSelection(userId, date);
            if (existingSelection) {
                await interaction.reply({
                    content: '❌ Bu tarih için zaten vardiya seçimi yapmışsınız! Bir kullanıcı sadece bir vardiya seçebilir.',
                    ephemeral: true
                });
                return;
            }

            // Sadece bir vardiya seçilebilir kısıtlaması
            if (selectedShifts.length > 1) {
                await interaction.reply({
                    content: '❌ Sadece **bir vardiya** seçebilirsiniz! Lütfen tek bir vardiya seçin.',
                    ephemeral: true
                });
                return;
            }

            if (selectedShifts.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ffff00')
                    .setTitle('⚠️ Vardiya Seçimi')
                    .setDescription('Hiçbir vardiya seçmediniz. Eğer hiçbir vardiyada müsait değilseniz "Mazeret Belirt" butonunu kullanın.')
                    .setFooter({ text: 'Lütfen bir seçim yapın!' });

                await interaction.update({ embeds: [embed] });
                return;
            }

            const selectedSlot = selectedShifts[0];

            // Seçilen vardiyada zaten atama var mı kontrol et
            const existingAssignment = await this.database.getAssignmentForSlot(date, selectedSlot);
            if (existingAssignment) {
                const slotNames = {
                    'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
                    'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
                    'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
                    'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
                    'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
                };

                await interaction.reply({
                    content: `❌ **${slotNames[selectedSlot]}** vardiyası zaten dolu! Lütfen başka bir vardiya seçin.\n\n🔄 Mevcut atama: **${existingAssignment.username}**`,
                    ephemeral: true
                });
                return;
            }

            // Geçici seçimi kaydet
            this.tempDailySelections = this.tempDailySelections || {};
            this.tempDailySelections[userId] = {
                date,
                selectedSlot,
                timestamp: Date.now()
            };

            const slotNames = {
                'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
                'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
                'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
                'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
                'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
            };

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Vardiya Seçimi Yapıldı')
                .setDescription(`**${date}** tarihli takvim için vardiya seçiminiz:`)
                .addFields({
                    name: 'Seçtiğiniz Vardiya',
                    value: `${slotNames[selectedSlot]}`,
                    inline: false
                })
                .setFooter({ text: 'Onaylamak için "✅ Seçimimi Onayla" butonuna basın!' });

            await interaction.update({ embeds: [embed] });

        } catch (error) {
            this.logger.error('Günlük vardiya seçimi hatası:', error.message);
            await interaction.reply({
                content: '❌ Vardiya seçimi sırasında bir hata oluştu. Lütfen tekrar deneyin.',
                ephemeral: true
            });
        }
    }

    // Günlük vardiya seçimini onayla
    async handleDailySubmit(interaction) {
        try {
            const date = this.extractDateFromDailyId(interaction.customId);
            const userId = interaction.user.id;
            const username = interaction.user.username;

            // Geçici seçimi al
            const tempSelection = this.tempDailySelections?.[userId];
            if (!tempSelection || tempSelection.date !== date) {
                await interaction.reply({
                    content: '❌ Önce bir vardiya seçmeniz gerekiyor!',
                    ephemeral: true
                });
                return;
            }

            // Tekrar kontrol et - vardiya hala boş mu?
            const existingAssignment = await this.database.getAssignmentForSlot(date, tempSelection.selectedSlot);
            if (existingAssignment) {
                await interaction.reply({
                    content: '❌ Seçtiğiniz vardiya bu arada başka bir moderatör tarafından alındı! Lütfen farklı bir vardiya seçin.',
                    ephemeral: true
                });
                
                // Geçici seçimi temizle
                delete this.tempDailySelections[userId];
                return;
            }

            // Veritabanına kaydet
            await this.database.assignToSlot(date, userId, tempSelection.selectedSlot, 'daily_survey');

            // Kullanıcının seçimini kaydet
            await this.database.saveDailyShiftSelection(userId, username, date, tempSelection.selectedSlot);

            // Geçici veriyi temizle
            delete this.tempDailySelections[userId];

            const slotNames = {
                'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
                'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
                'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
                'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
                'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
            };

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎉 Vardiya Ataması Tamamlandı!')
                .setDescription(`**${date}** tarihli takvim için vardiya atanız başarıyla kaydedildi.`)
                .addFields({
                    name: 'Atandığınız Vardiya',
                    value: `${slotNames[tempSelection.selectedSlot]}`,
                    inline: false
                })
                .setFooter({ text: 'Teşekkür ederiz! Vardiya saatinizde aktif olmanız beklenmektedir.' })
                .setTimestamp();

            await interaction.update({ embeds: [embed], components: [] });

            this.logger.info(`${username} kullanıcısı ${date} tarihli ${tempSelection.selectedSlot} vardiyasına atandı`);

            // Admin kanalına bildir
            await this.notifyAdminAboutAssignment(date, userId, username, tempSelection.selectedSlot);

        } catch (error) {
            this.logger.error('Günlük vardiya onaylama hatası:', error.message);
            await interaction.reply({
                content: '❌ Vardiya ataması sırasında bir hata oluştu. Lütfen tekrar deneyin.',
                ephemeral: true
            });
        }
    }

    // Günlük mazeret belirtme
    async handleDailyExcuse(interaction) {
        try {
            const date = this.extractDateFromDailyId(interaction.customId);

            // Modal oluştur
            const modal = new ModalBuilder()
                .setCustomId(`daily_excuse_modal_${date}`)
                .setTitle(`${date} Tarihli Mazeret`);

            const excuseInput = new TextInputBuilder()
                .setCustomId('excuse_text')
                .setLabel(`${date} tarihinde neden müsait değilsiniz?`)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Örnek: Sınav var, tatildeyim, hasta olacağım vb.')
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(500);

            const actionRow = new ActionRowBuilder().addComponents(excuseInput);
            modal.addComponents(actionRow);

            await interaction.showModal(modal);

        } catch (error) {
            this.logger.error('Günlük mazeret modal hatası:', error.message);
            await interaction.reply({
                content: '❌ Mazeret formu açılırken bir hata oluştu. Lütfen tekrar deneyin.',
                ephemeral: true
            });
        }
    }

    // Günlük mazeret modal işleme
    async handleDailyExcuseModal(interaction) {
        try {
            const date = this.extractDateFromDailyId(interaction.customId);
            const excuse = interaction.fields.getTextInputValue('excuse_text');
            const userId = interaction.user.id;
            const username = interaction.user.username;

            // Mazereti veritabanına kaydet
            await this.database.saveDailyExcuse(userId, username, date, excuse);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('✅ Mazeretiniz Kaydedildi')
                .setDescription(`**${date}** tarihli takvim için mazeretiniz kaydedildi.`)
                .addFields({
                    name: 'Mazeret Sebebiniz',
                    value: excuse,
                    inline: false
                })
                .setFooter({ text: 'Mazeretiniz değerlendirilecek ve gerekirse size geri dönüş yapılacaktır.' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: false });

            this.logger.info(`${username} kullanıcısı ${date} tarihi için mazeret belirtti: ${excuse.substring(0, 50)}...`);

            // Admin kanalına bildir
            await this.notifyAdminAboutExcuse(date, userId, username, excuse);

        } catch (error) {
            this.logger.error('Günlük mazeret kaydetme hatası:', error.message);
            await interaction.reply({
                content: '❌ Mazeretiniz kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.',
                ephemeral: true
            });
        }
    }

    // Admin kanalına vardiya atamasını bildir
    async notifyAdminAboutAssignment(date, userId, username, slotId) {
        try {
            const adminChannel = this.client.channels.cache.get(this.config.discord.adminModChannelId);
            if (!adminChannel) return;

            const slotNames = {
                'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
                'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
                'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
                'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
                'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
            };

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Yeni Vardiya Ataması')
                .setDescription(`**${date}** tarihli takvimde yeni atama yapıldı.`)
                .addFields(
                    {
                        name: 'Moderatör',
                        value: `<@${userId}> (${username})`,
                        inline: true
                    },
                    {
                        name: 'Vardiya',
                        value: slotNames[slotId],
                        inline: false
                    }
                )
                .setTimestamp();

            await adminChannel.send({ embeds: [embed] });
        } catch (error) {
            this.logger.error('Admin bildirim hatası (atama):', error.message);
        }
    }

    // Admin kanalına mazeret bildir
    async notifyAdminAboutExcuse(date, userId, username, excuse) {
        try {
            const adminChannel = this.client.channels.cache.get(this.config.discord.adminModChannelId);
            if (!adminChannel) return;

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('📝 Yeni Mazeret Bildirimi')
                .setDescription(`**${date}** tarihli takvim için mazeret bildirildi.`)
                .addFields(
                    {
                        name: 'Moderatör',
                        value: `<@${userId}> (${username})`,
                        inline: true
                    },
                    {
                        name: 'Mazeret',
                        value: excuse.substring(0, 1000),
                        inline: false
                    }
                )
                .setTimestamp();

            await adminChannel.send({ embeds: [embed] });
        } catch (error) {
            this.logger.error('Admin bildirim hatası (mazeret):', error.message);
        }
    }

    // Tarih çıkarma yardımcı fonksiyonu (günlük anketler için)
    extractDateFromDailyId(customId) {
        // "daily_shift_select_2025-08-07" -> "2025-08-07"
        const parts = customId.split('_');
        return parts[parts.length - 1];
    }
}

module.exports = SurveyManager; 