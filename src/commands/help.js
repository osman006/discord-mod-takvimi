const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('Bot komutları hakkında yardım alın'),

    async execute(interaction) {
        try {
            const helpEmbed = new EmbedBuilder()
                .setTitle('🤖 MOD TAKVİM BOT - YARDIM')
                .setDescription('**Moderatör takvimi ve vardiya yönetimi için bot komutları:**')
                .setColor('#0099ff')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .addFields(
                    {
                        name: '👥 `/mod`',
                        value: '• **Açıklama:** Şu anda aktif olan moderatörleri gösterir\n• **Kullanım:** `/mod`\n• **Kim kullanabilir:** Herkes',
                        inline: false
                    },
                    {
                        name: '⚙️ `/admin`',
                        value: '• **Açıklama:** Yönetici komutları (takvim, vardiya, kısıtlama yönetimi)\n• **Alt Komutlar:**\n  ├ `takvim yayinla` - Haftalık takvimi yayınla\n  ├ `gunluk sec` - Günlük mod seçimi\n  ├ `gunluk ata` - Manuel mod atama\n  ├ `gunluk gor` - Günlük atamayı görüntüle\n  ├ `kisitlama ayarla` - Mod kısıtlaması ayarla\n  ├ `kisitlama listele` - Kısıtlamaları listele\n  ├ `kisitlama temizle` - Kısıtlamaları temizle\n  └ `yetkiler` - Bot yetkilerini kontrol et\n• **Kim kullanabilir:** Sadece Yöneticiler',
                        inline: false
                    }
                )
                .addFields(
                    {
                        name: '🔄 **Otomatik İşlemler**',
                        value: '• **Haftalık Anket:** Her Pazar 18:00\'da DM gönderilir\n• **Günlük Seçim:** Her gün 07:00\'da otomatik mod seçimi\n• **Takvim Yayını:** Her Pazartesi 09:00\'da haftalık program\n• **Disiplin:** Ankete katılmayanlar otomatik ban',
                        inline: false
                    },
                    {
                        name: '📋 **Moderatör Rolleri**',
                        value: '`Moderator`, `Admin`, `Director`, `Founder`',
                        inline: true
                    },
                    {
                        name: '⏰ **Vardiya Saatleri**',
                        value: '**Gündüz:** 08:00-20:00\n**Gece:** 20:00-08:00',
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'Bot Versiyon 1.0.0 | Geliştirici: MOD TAKVİM', 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            await interaction.reply({ embeds: [helpEmbed], flags: ['Ephemeral'] });

        } catch (error) {
            const logger = interaction.client.logger;
            logger.error('Yardım komutu hatası', error, 'Yardım komut');

            await interaction.reply({
                content: '❌ Yardım bilgileri gösterilirken bir hata oluştu.',
                flags: ['Ephemeral']
            });
        }
    }
}; 