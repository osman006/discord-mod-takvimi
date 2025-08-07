const SurveyManager = require('../utils/surveyManager');
const SchedulePublisher = require('../utils/schedulePublisher');
const DailyModManager = require('../utils/dailyModManager');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        const logger = client.logger;
        
        // 2 saniye cooldown kontrolü
        const now = Date.now();
        const cooldownAmount = 2000; // 2 saniye
        
        if (!client.cooldowns) {
            client.cooldowns = new Map();
        }

        const userId = interaction.user.id;
        const lastUsed = client.cooldowns.get(userId);
        
        if (lastUsed && (now - lastUsed) < cooldownAmount) {
            const remainingTime = Math.ceil((cooldownAmount - (now - lastUsed)) / 1000);
            await interaction.reply({
                content: `⏱️ Lütfen ${remainingTime} saniye bekleyin.`,
                ephemeral: true
            });
            return;
        }

        client.cooldowns.set(userId, now);

        try {
            // Slash komutları
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);

                if (!command) {
                    logger.warn(`Bilinmeyen komut: ${interaction.commandName}`);
                    await interaction.reply({
                        content: '❌ Bu komut bulunamadı.',
                        ephemeral: true
                    });
                    return;
                }

                logger.commandUsed(interaction.commandName, interaction.user.id, interaction.user.username);
                await command.execute(interaction, client);
                
            } 
            // Anket interaction'ları (buton, select menu, modal)
            else if (
                interaction.isStringSelectMenu() || 
                interaction.isButton() || 
                interaction.isModalSubmit()
            ) {
                // Anket ile ilgili interaction'ları kontrol et
                const surveyIds = ['time_select_', 'confirm_availability_', 'not_available_', 'excuse_modal_'];
                const isSurveyInteraction = surveyIds.some(id => interaction.customId.includes(id));
                
                // Günlük anket ile ilgili interaction'ları kontrol et
                const dailySurveyIds = ['daily_shift_select_', 'daily_submit_', 'daily_excuse_', 'daily_excuse_modal_'];
                const isDailySurveyInteraction = dailySurveyIds.some(id => interaction.customId.includes(id));
                
                // Takvim ile ilgili interaction'ları kontrol et
                const scheduleIds = ['refresh_schedule_', 'export_schedule_'];
                const isScheduleInteraction = scheduleIds.some(id => interaction.customId.includes(id));
                
                // Günlük mod ile ilgili interaction'ları kontrol et
                const dailyModIds = ['reselect_daily_', 'manual_assign_'];
                const isDailyModInteraction = dailyModIds.some(id => interaction.customId.includes(id));
                
                if (isSurveyInteraction || isDailySurveyInteraction) {
                    const surveyManager = new SurveyManager(client);
                    await surveyManager.handleInteraction(interaction);
                } else if (isScheduleInteraction) {
                    const schedulePublisher = new SchedulePublisher(client);
                    await schedulePublisher.handleInteraction(interaction);
                } else if (isDailyModInteraction) {
                    const dailyModManager = new DailyModManager(client);
                    await dailyModManager.handleInteraction(interaction);
                } else {
                    logger.warn(`Bilinmeyen interaction: ${interaction.customId}`);
                    await interaction.reply({
                        content: '❌ Bu etkileşim desteklenmiyor.',
                        ephemeral: true
                    });
                }
            }
            
        } catch (error) {
            logger.botError(error, `Interaction: ${interaction.type}`);
            
            const errorMessage = '❌ Komut çalıştırılırken bir hata oluştu.';
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: errorMessage,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: errorMessage,
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                logger.error('Hata mesajı gönderilirken hata:', replyError.message);
            }
        }
    }
}; 