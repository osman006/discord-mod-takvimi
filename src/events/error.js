module.exports = {
    name: 'error',
    async execute(error, client) {
        client.logger.botError(error, 'Discord Client Error');
        
        // Kritik hatalar için admin kanalına bildir
        try {
            const adminChannel = client.channels.cache.get(client.config.discord.adminModChannelId);
            if (adminChannel) {
                const { EmbedBuilder } = require('discord.js');
                
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚨 Bot Hatası')
                    .setDescription('Bot\'ta kritik bir hata oluştu.')
                    .addFields(
                        {
                            name: 'Hata Mesajı',
                            value: error.message.substring(0, 1000),
                            inline: false
                        },
                        {
                            name: 'Zaman',
                            value: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
                            inline: true
                        }
                    )
                    .setTimestamp();
                
                await adminChannel.send({ embeds: [embed] });
            }
        } catch (notificationError) {
            client.logger.error('Admin kanalına hata bildirimi gönderilemedi:', notificationError.message);
        }
    }
}; 