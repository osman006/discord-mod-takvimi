module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Bot mesajlarını yoksay
        if (message.author.bot) return;
        
        // DM'leri logla
        if (message.channel.type === 'DM') {
            client.logger.debug(`DM alındı: ${message.author.username} - ${message.content}`);
        }
        
        // Prefix komutları (eski !mod komutu için uyumluluk)
        if (message.content.startsWith('!mod') && !message.content.startsWith('!mod ')) {
            try {
                // Slash komut kullanımını öner
                await message.reply({
                    content: '💡 Artık `/mod` slash komutunu kullanabilirsiniz! Daha modern ve kullanıcı dostu bir deneyim için slash komutları tercih edin.',
                    allowedMentions: { repliedUser: false }
                });
                
                client.logger.info(`Eski !mod komutu kullanıldı: ${message.author.username}`);
                
            } catch (error) {
                client.logger.error('Prefix komut yanıtı gönderilirken hata:', error.message);
            }
        }
    }
}; 