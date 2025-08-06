const { EmbedBuilder } = require('discord.js');

class AutoScheduleManager {
    constructor(client) {
        this.client = client;
        this.database = client.database;
        this.config = client.config;
        this.logger = client.logger;
    }

    // Günlük takvim oluştur
    async createDailySchedule(date) {
        try {
            // Önce bu tarih için takvim var mı kontrol et
            const hasSchedule = await this.database.hasScheduleForDate(date);
            if (hasSchedule) {
                return { success: false, error: 'Bu tarih için zaten takvim mevcut' };
            }

            // Takvim durumunu kaydet
            const surveyDeadline = new Date();
            surveyDeadline.setHours(surveyDeadline.getHours() + 5); // 5 saat süre
            
            await this.database.saveScheduleStatus(date, 'survey_sent', surveyDeadline.toISOString());

            // Aktif moderatörleri getir
            const moderators = await this.database.getActiveModerators();
            if (moderators.length === 0) {
                return { success: false, error: 'Aktif moderatör bulunamadı' };
            }

            // Moderatörlere anket gönder
            const SurveyManager = require('./surveyManager');
            const surveyManager = new SurveyManager(this.client);
            
            let sentCount = 0;
            let failedCount = 0;

            for (const mod of moderators) {
                try {
                    const user = await this.client.users.fetch(mod.user_id);
                    await surveyManager.sendDailyScheduleSurvey(user, date);
                    sentCount++;
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    failedCount++;
                    this.logger.error(`${mod.username} kullanıcısına anket gönderilemedi:`, error.message);
                }
            }

            // 5 saat sonra kontrol et
            setTimeout(() => {
                this.checkSurveyResponses(date);
            }, 5 * 60 * 60 * 1000); // 5 saat

            return {
                success: true,
                summary: `📊 Anket gönderimi: Başarılı ${sentCount}, Başarısız ${failedCount}\n⏰ 5 saat içinde yanıt bekleniyor`
            };

        } catch (error) {
            this.logger.botError(error, 'Otomatik takvim oluşturma');
            return { success: false, error: error.message };
        }
    }

    // Anket yanıtlarını kontrol et
    async checkSurveyResponses(date) {
        try {
            this.logger.info(`${date} için anket yanıtları kontrol ediliyor...`);

            // Yanıt verenleri getir
            const responses = await this.database.getResponsesForDate(date);
            const respondedUserIds = responses.map(r => r.user_id);

            // Tüm aktif moderatörleri getir
            const allModerators = await this.database.getActiveModerators();
            
            // Yanıt vermeyenleri bul
            const nonRespondents = allModerators.filter(mod => !respondedUserIds.includes(mod.user_id));

            // Yanıt vermeyenleri cezalandır
            for (const mod of nonRespondents) {
                await this.punishNonRespondent(mod, date);
            }

            // Takvimi oluştur
            await this.generateScheduleFromResponses(date, responses);

            // Durumu güncelle
            await this.database.saveScheduleStatus(date, 'completed');

            this.logger.info(`${date} için otomatik takvim oluşturma tamamlandı`);

        } catch (error) {
            this.logger.botError(error, 'Anket yanıt kontrolü');
            await this.database.saveScheduleStatus(date, 'failed');
        }
    }

    // Yanıt vermeyeni cezalandır
    async punishNonRespondent(moderator, date) {
        try {
            // İhlal geçmişini kontrol et
            const existingViolations = await this.database.getViolationHistory(moderator.user_id);
            
            let punishmentType, punishmentEnd;
            const now = new Date();

            if (existingViolations.length === 0) {
                // İlk ihlal: 2 gün ban
                punishmentType = 'ban_2day';
                punishmentEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            } else if (existingViolations.length === 1) {
                // İkinci ihlal: 1 saat yazma banı
                punishmentType = 'ban_1hour';
                punishmentEnd = new Date(now.getTime() + 60 * 60 * 1000);
            } else {
                // Üçüncü ve sonrası: 1 gün ban
                punishmentType = 'ban_1day';
                punishmentEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            }

            // Cezayı kaydet
            const result = await this.database.recordAbsentUser(
                moderator.user_id,
                moderator.username,
                date,
                'no_response',
                punishmentType,
                punishmentEnd.toISOString()
            );

            // Kullanıcıya DM gönder
            await this.sendPunishmentNotification(moderator, punishmentType, punishmentEnd, result.violationCount);

            // Yerine birini ata
            await this.assignReplacementModerator(date);

            // Log kanalına bildir
            await this.logPunishment(moderator, date, punishmentType, punishmentEnd, result.violationCount);

        } catch (error) {
            this.logger.error(`${moderator.username} cezalandırma hatası:`, error.message);
        }
    }

    // Ceza bildirimi gönder
    async sendPunishmentNotification(moderator, punishmentType, punishmentEnd, violationCount) {
        try {
            const user = await this.client.users.fetch(moderator.user_id);
            
            let punishmentText, description;
            
            switch (punishmentType) {
                case 'ban_2day':
                    punishmentText = '2 Gün Moderatörlük Yasağı';
                    description = 'Ankete yanıt vermediğiniz için 2 gün boyunca moderatörlük yapamazsınız.';
                    break;
                case 'ban_1hour':
                    punishmentText = '1 Saat Yazma Yasağı';
                    description = 'İkinci ihlal nedeniyle 1 saat boyunca sunucuda mesaj yazamazsınız.';
                    break;
                case 'ban_1day':
                    punishmentText = '1 Gün Moderatörlük Yasağı';
                    description = 'Tekrarlanan ihlal nedeniyle 1 gün moderatörlük yasağı aldınız.';
                    break;
            }

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚫 Ceza Bildirimi')
                .setDescription(description)
                .addFields(
                    {
                        name: '📅 Tarih',
                        value: new Date().toLocaleDateString('tr-TR'),
                        inline: true
                    },
                    {
                        name: '⏰ Ceza Süresi',
                        value: punishmentText,
                        inline: true
                    },
                    {
                        name: '🔢 İhlal Sayısı',
                        value: violationCount.toString(),
                        inline: true
                    },
                    {
                        name: '📝 Sebep',
                        value: 'Günlük takvim anketine yanıt vermeme',
                        inline: false
                    },
                    {
                        name: '⏳ Ceza Bitiş Tarihi',
                        value: punishmentEnd.toLocaleString('tr-TR'),
                        inline: false
                    }
                )
                .setTimestamp();

            await user.send({ embeds: [embed] });

        } catch (error) {
            this.logger.error(`${moderator.username} kullanıcısına ceza bildirimi gönderilemedi:`, error.message);
        }
    }

    // Yerine moderatör ata
    async assignReplacementModerator(date) {
        try {
            // Cezalı olmayan ve müsait moderatörleri bul
            const availableMods = await this.getAvailableModerators(date);
            
            if (availableMods.length === 0) {
                this.logger.warn(`${date} için yerine atanacak moderatör bulunamadı`);
                return;
            }

            // Rastgele bir moderatör seç
            const selectedMod = availableMods[Math.floor(Math.random() * availableMods.length)];
            
            // Boş bir slot bul ve ata
            const slots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'];
            for (const slot of slots) {
                const existingAssignment = await this.database.getAssignmentForSlot(date, slot);
                if (!existingAssignment) {
                    await this.database.assignToSlot(date, selectedMod.user_id, slot, 'automatic_replacement');
                    
                    // Seçilen moderatöre bildir
                    await this.notifyReplacementModerator(selectedMod, date, slot);
                    break;
                }
            }

        } catch (error) {
            this.logger.error('Yerine moderatör atama hatası:', error.message);
        }
    }

    // Yerine atanan moderatöre bildir
    async notifyReplacementModerator(moderator, date, slot) {
        try {
            const user = await this.client.users.fetch(moderator.user_id);
            
            const slotNames = {
                'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
                'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
                'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
                'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
                'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
            };

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📋 Vardiya Ataması')
                .setDescription('Bir moderatör ankete yanıt vermediği için size ek vardiya atandı!')
                .addFields(
                    {
                        name: '📅 Tarih',
                        value: date,
                        inline: true
                    },
                    {
                        name: '🕒 Vardiya',
                        value: slotNames[slot],
                        inline: false
                    },
                    {
                        name: '📝 Not',
                        value: 'Bu atama otomatik olarak yapılmıştır. Sorularınız için admin ekibine başvurabilirsiniz.',
                        inline: false
                    }
                )
                .setTimestamp();

            await user.send({ embeds: [embed] });

        } catch (error) {
            this.logger.error(`${moderator.username} kullanıcısına bildirim gönderilemedi:`, error.message);
        }
    }

    // Müsait moderatörleri getir
    async getAvailableModerators(date = null) {
        try {
            const allMods = await this.database.getActiveModerators();
            const punishedUsers = await this.database.getPunishedUsers();
            const punishedUserIds = punishedUsers.map(p => p.user_id);
            
            return allMods.filter(mod => !punishedUserIds.includes(mod.user_id));
            
        } catch (error) {
            this.logger.error('Müsait moderatör getirme hatası:', error.message);
            return [];
        }
    }

    // Yanıtlardan takvim oluştur
    async generateScheduleFromResponses(date, responses) {
        try {
            // Kalıcı vardiyası olanları önce ata
            await this.assignPermanentShifts(date);

            // Akıllı rotasyon sistemi ile kalan slotları doldur
            await this.assignWithSmartRotation(date, responses);

            // Takvimi yayınla
            await this.publishGeneratedSchedule(date);

        } catch (error) {
            this.logger.error('Takvim oluşturma hatası:', error.message);
        }
    }

    // Akıllı rotasyon sistemi - moderatörleri eşit dağıt
    async assignWithSmartRotation(date, responses) {
        try {
            const slots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'];
            const availableMods = await this.getAvailableModerators(date);
            
            if (availableMods.length === 0) {
                this.logger.warn('Atanabilecek moderatör bulunamadı');
                return;
            }

            // Son 7 günün atamalarını analiz et (yorgunluk kontrolü)
            const workloadAnalysis = await this.analyzeModeratorWorkload(availableMods, date);
            
            // Her slot için en az yorgun moderatörü seç
            for (const slot of slots) {
                const existingAssignment = await this.database.getAssignmentForSlot(date, slot);
                if (!existingAssignment) {
                    // Bu slot için uygun ve en az yorgun moderatörü bul
                    const selectedMod = await this.selectBestModeratorForSlot(slot, responses, workloadAnalysis);
                    if (selectedMod) {
                        await this.database.assignToSlot(date, selectedMod.user_id, slot, 'smart_rotation');
                        
                        // Çalışma yükünü güncelle
                        workloadAnalysis[selectedMod.user_id] = (workloadAnalysis[selectedMod.user_id] || 0) + this.getSlotHours(slot);
                        
                        this.logger.info(`${selectedMod.username} ${slot} vardiyasına atandı (Akıllı Rotasyon)`);
                    }
                }
            }

        } catch (error) {
            this.logger.error('Akıllı rotasyon hatası:', error.message);
        }
    }

    // Moderatör çalışma yükünü analiz et (son 7 gün)
    async analyzeModeratorWorkload(moderators, currentDate) {
        try {
            const workload = {};
            const last7Days = [];
            
            // Son 7 günü hesapla
            for (let i = 1; i <= 7; i++) {
                const pastDate = new Date(currentDate);
                pastDate.setDate(pastDate.getDate() - i);
                last7Days.push(pastDate.toISOString().split('T')[0]);
            }

            // Her moderatör için çalışma saatlerini hesapla
            for (const mod of moderators) {
                let totalHours = 0;
                
                for (const date of last7Days) {
                    const assignments = await this.database.getUserAssignmentsForDate(mod.user_id, date);
                    for (const assignment of assignments) {
                        totalHours += this.getSlotHours(assignment.slot_id);
                    }
                }
                
                workload[mod.user_id] = totalHours;
            }

            return workload;

        } catch (error) {
            this.logger.error('Çalışma yükü analizi hatası:', error.message);
            return {};
        }
    }

    // Slot için en iyi moderatörü seç (yorgunluk + uygunluk)
    async selectBestModeratorForSlot(slot, responses, workloadAnalysis) {
        try {
            // Bu slot için yanıt vermiş moderatörleri bul
            const suitableResponses = responses.filter(response => {
                const availability = JSON.parse(response.availability || '[]');
                return availability.includes(slot);
            });

            if (suitableResponses.length === 0) {
                // Yanıt vermiş kimse yoksa, en az yorgun moderatörü ata
                const availableMods = await this.getAvailableModerators();
                if (availableMods.length === 0) return null;

                // En az çalışan moderatörü seç
                const leastWorkedMod = availableMods.reduce((least, current) => {
                    const leastWorkload = workloadAnalysis[least.user_id] || 0;
                    const currentWorkload = workloadAnalysis[current.user_id] || 0;
                    return currentWorkload < leastWorkload ? current : least;
                });

                return {
                    user_id: leastWorkedMod.user_id,
                    username: leastWorkedMod.username
                };
            }

            // Yanıt verenler arasından en az çalışanı seç
            const bestResponse = suitableResponses.reduce((best, current) => {
                const bestWorkload = workloadAnalysis[best.user_id] || 0;
                const currentWorkload = workloadAnalysis[current.user_id] || 0;
                return currentWorkload < bestWorkload ? current : best;
            });

            return {
                user_id: bestResponse.user_id,
                username: bestResponse.username
            };

        } catch (error) {
            this.logger.error('En iyi moderatör seçimi hatası:', error.message);
            return null;
        }
    }

    // Slot saat süresini hesapla
    getSlotHours(slotId) {
        const slotHours = {
            'slot1': 5, // 00:00-05:00
            'slot2': 5, // 05:00-10:00
            'slot3': 5, // 10:00-15:00
            'slot4': 5, // 15:00-20:00
            'slot5': 4  // 20:00-24:00
        };
        return slotHours[slotId] || 5;
    }

    // Kalıcı vardiyaları ata
    async assignPermanentShifts(date) {
        try {
            const permanentShifts = await this.database.getAllPermanentShifts();
            
            for (const shift of permanentShifts) {
                await this.database.assignToSlot(date, shift.user_id, shift.slot_id, 'permanent');
            }

        } catch (error) {
            this.logger.error('Kalıcı vardiya atama hatası:', error.message);
        }
    }

    // Slot için uygun moderatör bul
    async findSuitableModeratorForSlot(slot, responses, date) {
        try {
            // Bu slot için yanıt vermiş ve müsait olan moderatörleri bul
            const suitableResponses = responses.filter(response => {
                const availability = JSON.parse(response.availability || '[]');
                return availability.includes(slot);
            });

            if (suitableResponses.length === 0) {
                return null;
            }

            // Rastgele birini seç (gelecekte daha akıllı seçim yapılabilir)
            const selectedResponse = suitableResponses[Math.floor(Math.random() * suitableResponses.length)];
            
            return {
                user_id: selectedResponse.user_id,
                username: selectedResponse.username
            };

        } catch (error) {
            this.logger.error('Uygun moderatör bulma hatası:', error.message);
            return null;
        }
    }

    // Oluşturulan takvimi yayınla
    async publishGeneratedSchedule(date) {
        try {
            const assignments = await this.database.getAssignmentsForDate(date);
            
            if (assignments.length === 0) {
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📅 Günlük Moderatör Takvimi')
                .setDescription(`**${date}** tarihli otomatik oluşturulan takvim`)
                .setTimestamp();

            const slotNames = {
                'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
                'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
                'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
                'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
                'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
            };

            for (const assignment of assignments) {
                const moderator = await this.database.getModerator(assignment.user_id);
                embed.addFields({
                    name: slotNames[assignment.slot_id],
                    value: `<@${assignment.user_id}> (${moderator?.username || 'Bilinmiyor'})`,
                    inline: false
                });
            }

            // Takvim kanalına gönder
            const scheduleChannelId = this.config.discord.scheduleChannelId;
            if (scheduleChannelId) {
                const channel = await this.client.channels.fetch(scheduleChannelId);
                await channel.send({ embeds: [embed] });
            }

        } catch (error) {
            this.logger.error('Takvim yayınlama hatası:', error.message);
        }
    }

    // Ceza logla
    async logPunishment(moderator, date, punishmentType, punishmentEnd, violationCount) {
        try {
            const logChannelId = this.config.discord.logChannelId;
            if (!logChannelId) return;

            const channel = await this.client.channels.fetch(logChannelId);
            
            let punishmentText;
            switch (punishmentType) {
                case 'ban_2day':
                    punishmentText = '2 Gün Moderatörlük Yasağı';
                    break;
                case 'ban_1hour':
                    punishmentText = '1 Saat Yazma Yasağı';
                    break;
                case 'ban_1day':
                    punishmentText = '1 Gün Moderatörlük Yasağı';
                    break;
            }

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚫 Otomatik Ceza')
                .addFields(
                    {
                        name: '👤 Kullanıcı',
                        value: `${moderator.username} <@${moderator.user_id}>`,
                        inline: true
                    },
                    {
                        name: '📅 Tarih',
                        value: date,
                        inline: true
                    },
                    {
                        name: '📝 Sebep',
                        value: 'Ankete yanıt vermeme',
                        inline: true
                    },
                    {
                        name: '⏰ Ceza',
                        value: punishmentText,
                        inline: true
                    },
                    {
                        name: '🔢 İhlal Sayısı',
                        value: violationCount.toString(),
                        inline: true
                    },
                    {
                        name: '⏳ Bitiş',
                        value: punishmentEnd.toLocaleString('tr-TR'),
                        inline: true
                    }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });

        } catch (error) {
            this.logger.error('Ceza loglama hatası:', error.message);
        }
    }
}

module.exports = AutoScheduleManager; 