const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Şu anda aktif vardiyada olan moderatörleri listeler'),
    
    async execute(interaction, client) {
        try {
            const logger = client.logger;
            const database = client.database;
            const config = client.config;
            
            await interaction.deferReply();

            // Günlük mod sistemi kullan
            const DailyModManager = require('../utils/dailyModManager');
            const dailyModManager = new DailyModManager(client);
            
            // Bugünün aktif modlarını al
            const activeMods = await dailyModManager.getCurrentActiveMods();
            
            // Şu anki saati al
            const now = new Date();
            const currentTime = now.toLocaleTimeString('tr-TR', { 
                timeZone: 'Europe/Istanbul',
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false
            });

            const currentHour = now.getHours();
            const isDay = currentHour >= 8 && currentHour < 20;
            
            // Embed oluştur
            const embed = new EmbedBuilder()
                .setColor(activeMods.length > 0 ? '#00ff00' : '#ff9900')
                .setTitle('👥 Günlük Aktif Moderatörler')
                .setDescription(`**${now.toLocaleDateString('tr-TR')}** - Saat: **${currentTime}**`)
                .setTimestamp();

            if (activeMods.length > 0) {
                const shiftIcon = isDay ? '☀️' : '🌙';
                const shiftName = isDay ? 'Gündüz Vardiyası' : 'Gece Vardiyası';
                
                embed.addFields({
                    name: `${shiftIcon} ${shiftName} (${activeMods[0].shiftTime})`,
                    value: activeMods.map((mod, index) => 
                        `**${index + 1}.** <@${mod.user_id}> (${mod.username})`
                    ).join('\n'),
                    inline: false
                });

                // Sonraki vardiya bilgisi
                const nextShiftTime = isDay ? '🌙 Gece Vardiyası (20:00-08:00)' : '☀️ Gündüz Vardiyası (08:00-20:00)';
                const hoursUntilNext = isDay ? (20 - currentHour) : (8 + (24 - currentHour)) % 24;
                
                embed.addFields({
                    name: '⏰ Sonraki Vardiya',
                    value: `${nextShiftTime}\n⏱️ **${hoursUntilNext} saat** sonra başlayacak`,
                    inline: false
                });

            } else {
                embed.addFields({
                    name: '❌ Aktif Moderatör Yok',
                    value: 'Bugün için henüz moderatör ataması yapılmamış.',
                    inline: false
                });

                embed.addFields({
                    name: '💡 Bilgi',
                    value: 'Günlük mod ataması için `/admin daily select` komutunu kullanın.',
                    inline: false
                });
            }

            // Bugünün tam atamasını göster
            const todayAssignment = await dailyModManager.getTodayAssignment();
            if (todayAssignment) {
                const dayModsText = todayAssignment.dayMods.map(m => m.username).join(', ');
                const nightModsText = todayAssignment.nightMods.map(m => m.username).join(', ');
                
                embed.addFields({
                    name: '📋 Günün Tam Ataması',
                    value: [
                        `☀️ **Gündüz:** ${dayModsText}`,
                        `🌙 **Gece:** ${nightModsText}`
                    ].join('\n'),
                    inline: false
                });
            }

            embed.setFooter({ 
                text: `Günlük Mod Sistemi | Saat: ${currentTime}` 
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            client.logger.botError(error, 'Mod komut');
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Hata')
                .setDescription('Moderatör listesi alınırken bir hata oluştu.')
                .setTimestamp();

            try {
                await interaction.editReply({ embeds: [errorEmbed] });
            } catch (replyError) {
                client.logger.error('Hata mesajı gönderilemedi:', replyError.message);
            }
        }
    },

    // Şu anda aktif moderatörleri bul
    findActiveModerators(responses, currentTime, timeSlots) {
        const activeMods = [];
        
        // Şu anki zamanı dakika cinsine çevir
        const [currentHour, currentMinute] = currentTime.split(':').map(Number);
        const currentMinutes = currentHour * 60 + currentMinute;

        for (const response of responses) {
            if (!response.availability || response.availability.length === 0) continue;

            for (const slot of response.availability) {
                if (this.isTimeInSlot(currentMinutes, slot)) {
                    activeMods.push({
                        username: response.username,
                        currentSlot: slot
                    });
                    break; // Bir kullanıcı için sadece bir slot göster
                }
            }
        }

        return activeMods.sort((a, b) => a.username.localeCompare(b.username));
    },

    // Zaman dilimi kontrolü
    isTimeInSlot(currentMinutes, slot) {
        const [startTime, endTime] = slot.split('-');
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        
        let startMinutes = startHour * 60 + startMinute;
        let endMinutes = endHour * 60 + endMinute;
        
        // Gece yarısını geçen durumlar için (örn: 21:00-03:00)
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60; // Bir sonraki güne ekle
            
            // Şu anki zaman da gece yarısından sonraysa
            if (currentMinutes < startMinutes) {
                currentMinutes += 24 * 60;
            }
        }
        
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    },

    // Sonraki vardiyayı bul
    getNextShift(responses, currentTime, timeSlots) {
        const [currentHour, currentMinute] = currentTime.split(':').map(Number);
        const currentMinutes = currentHour * 60 + currentMinute;
        
        // Tüm saat dilimlerini kontrol et
        const upcomingShifts = [];
        
        for (const slot of timeSlots) {
            const [startTime] = slot.split('-');
            const [startHour, startMinute] = startTime.split(':').map(Number);
            let startMinutes = startHour * 60 + startMinute;
            
            // Bugün içinde ve gelecekteki saatleri bul
            if (startMinutes > currentMinutes) {
                const modsInSlot = responses.filter(r => 
                    r.availability && r.availability.includes(slot)
                ).map(r => r.username);
                
                if (modsInSlot.length > 0) {
                    upcomingShifts.push({
                        time: startTime,
                        minutes: startMinutes,
                        mods: modsInSlot,
                        slot: slot
                    });
                }
            }
        }
        
        // En yakın vardiyayı döndür
        if (upcomingShifts.length > 0) {
            upcomingShifts.sort((a, b) => a.minutes - b.minutes);
            return upcomingShifts[0];
        }
        
        return null;
    },

    // Sonraki aktif vardiyayı bul (aktif moderatör yoksa)
    getNextActiveShift(responses, currentTime, timeSlots) {
        // Önce bugün içindeki vardiyaları kontrol et
        let nextShift = this.getNextShift(responses, currentTime, timeSlots);
        
        if (nextShift) return nextShift;
        
        // Bugün vardiya yoksa, yarınki ilk vardiyayı bul
        const shiftsWithMods = [];
        
        for (const slot of timeSlots) {
            const modsInSlot = responses.filter(r => 
                r.availability && r.availability.includes(slot)
            ).map(r => r.username);
            
            if (modsInSlot.length > 0) {
                const [startTime] = slot.split('-');
                shiftsWithMods.push({
                    time: `Yarın ${startTime}`,
                    mods: modsInSlot,
                    slot: slot
                });
            }
        }
        
        // En erken saati bul
        if (shiftsWithMods.length > 0) {
            shiftsWithMods.sort((a, b) => {
                const timeA = parseInt(a.slot.split(':')[0]);
                const timeB = parseInt(b.slot.split(':')[0]);
                return timeA - timeB;
            });
            
            return shiftsWithMods[0];
        }
        
        return null;
    }
}; 