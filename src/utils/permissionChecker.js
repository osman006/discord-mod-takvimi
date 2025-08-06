const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

class PermissionChecker {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.logger = client.logger;
    }

    // Bot'un gerekli yetkilerini kontrol et
    async checkBotPermissions() {
        try {
            const guild = this.client.guilds.cache.get(this.config.discord.guildId);
            if (!guild) {
                throw new Error('Guild bulunamadı!');
            }

            const botMember = guild.members.cache.get(this.client.user.id);
            if (!botMember) {
                throw new Error('Bot üye bilgisi bulunamadı!');
            }

            const requiredPermissions = [
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.UseApplicationCommands,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.BanMembers,
                PermissionFlagsBits.ManageMessages
            ];

            const missingPermissions = [];
            const hasPermissions = [];

            for (const permission of requiredPermissions) {
                if (botMember.permissions.has(permission)) {
                    hasPermissions.push(this.getPermissionName(permission));
                } else {
                    missingPermissions.push(this.getPermissionName(permission));
                }
            }

            // Admin kanalında özel yetki kontrolü
            const adminChannel = guild.channels.cache.get(this.config.discord.adminModChannelId);
            let adminChannelPerms = null;
            
            if (adminChannel) {
                const channelPerms = adminChannel.permissionsFor(botMember);
                adminChannelPerms = {
                    canSend: channelPerms.has(PermissionFlagsBits.SendMessages),
                    canEmbed: channelPerms.has(PermissionFlagsBits.EmbedLinks),
                    canAttach: channelPerms.has(PermissionFlagsBits.AttachFiles),
                    canView: channelPerms.has(PermissionFlagsBits.ViewChannel)
                };
            }

            const result = {
                success: missingPermissions.length === 0,
                hasPermissions,
                missingPermissions,
                adminChannelPerms,
                guild: guild.name,
                botNickname: botMember.displayName
            };

            this.logger.info(`Yetki kontrolü tamamlandı. Eksik: ${missingPermissions.length}, Mevcut: ${hasPermissions.length}`);
            
            return result;

        } catch (error) {
            this.logger.botError(error, 'Bot yetki kontrolü');
            return {
                success: false,
                error: error.message,
                hasPermissions: [],
                missingPermissions: []
            };
        }
    }

    // Yetki adını al
    getPermissionName(permission) {
        const permissionNames = {
            [PermissionFlagsBits.SendMessages]: 'Mesaj Gönderme',
            [PermissionFlagsBits.UseApplicationCommands]: 'Slash Komut Kullanma',
            [PermissionFlagsBits.EmbedLinks]: 'Embed Bağlantıları',
            [PermissionFlagsBits.AttachFiles]: 'Dosya Ekleme',
            [PermissionFlagsBits.ReadMessageHistory]: 'Mesaj Geçmişi Okuma',
            [PermissionFlagsBits.ViewChannel]: 'Kanal Görüntüleme',
            [PermissionFlagsBits.BanMembers]: 'Üye Yasaklama',
            [PermissionFlagsBits.ManageMessages]: 'Mesaj Yönetimi'
        };

        return permissionNames[permission] || 'Bilinmeyen Yetki';
    }

    // Yetki raporu embed'i oluştur
    createPermissionReport(permissionCheck) {
        const embed = new EmbedBuilder()
            .setTitle('🔐 Bot Yetki Durumu')
            .setTimestamp();

        if (permissionCheck.success) {
            embed.setColor('#00ff00')
                .setDescription('✅ Bot tüm gerekli yetkilere sahip!')
                .addFields({
                    name: '✅ Mevcut Yetkiler',
                    value: permissionCheck.hasPermissions.join('\n'),
                    inline: false
                });
        } else {
            embed.setColor('#ff0000')
                .setDescription('❌ Bot bazı yetkilerden yoksun!')
                .addFields(
                    {
                        name: '❌ Eksik Yetkiler',
                        value: permissionCheck.missingPermissions.length > 0 
                            ? permissionCheck.missingPermissions.join('\n')
                            : 'Yok',
                        inline: false
                    },
                    {
                        name: '✅ Mevcut Yetkiler',
                        value: permissionCheck.hasPermissions.length > 0 
                            ? permissionCheck.hasPermissions.join('\n')
                            : 'Yok',
                        inline: false
                    }
                );
        }

        // Admin kanal yetkilerini ekle
        if (permissionCheck.adminChannelPerms) {
            const channelStatus = [];
            if (permissionCheck.adminChannelPerms.canView) channelStatus.push('✅ Kanal Görme');
            else channelStatus.push('❌ Kanal Görme');
            
            if (permissionCheck.adminChannelPerms.canSend) channelStatus.push('✅ Mesaj Gönderme');
            else channelStatus.push('❌ Mesaj Gönderme');
            
            if (permissionCheck.adminChannelPerms.canEmbed) channelStatus.push('✅ Embed Gönderme');
            else channelStatus.push('❌ Embed Gönderme');

            embed.addFields({
                name: '📢 Admin Kanal Yetkiler',
                value: channelStatus.join('\n'),
                inline: false
            });
        }

        // Genel bilgiler
        embed.addFields({
            name: '📊 Bot Bilgileri',
            value: [
                `**Sunucu:** ${permissionCheck.guild || 'Bilinmiyor'}`,
                `**Bot Adı:** ${permissionCheck.botNickname || this.client.user.username}`,
                `**Kontrol Zamanı:** ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`
            ].join('\n'),
            inline: false
        });

        if (!permissionCheck.success && permissionCheck.missingPermissions.length > 0) {
            embed.addFields({
                name: '🛠️ Çözüm',
                value: 'Bot\'a eksik yetkiler verilmelidir. Sunucu ayarlarından bot rolüne gerekli izinleri ekleyin.',
                inline: false
            });
        }

        return embed;
    }

    // Otomatik yetki uyarısı gönder
    async sendPermissionAlert() {
        try {
            const permissionCheck = await this.checkBotPermissions();
            
            if (!permissionCheck.success) {
                const adminChannel = this.client.channels.cache.get(this.config.discord.adminModChannelId);
                
                if (adminChannel && permissionCheck.adminChannelPerms?.canSend) {
                    const embed = this.createPermissionReport(permissionCheck);
                    
                    await adminChannel.send({
                        content: '⚠️ **DİKKAT: Bot Yetki Sorunu**',
                        embeds: [embed]
                    });
                    
                    this.logger.warn('Yetki uyarısı admin kanalına gönderildi');
                } else {
                    this.logger.error('Admin kanalına yetki uyarısı gönderilemedi - kanal erişim sorunu');
                }
            }

            return permissionCheck;

        } catch (error) {
            this.logger.botError(error, 'Yetki uyarısı gönderme');
            return null;
        }
    }

    // Belirli bir yetki için kontrol
    hasPermission(permission) {
        try {
            const guild = this.client.guilds.cache.get(this.config.discord.guildId);
            if (!guild) return false;

            const botMember = guild.members.cache.get(this.client.user.id);
            if (!botMember) return false;

            return botMember.permissions.has(permission);
        } catch (error) {
            this.logger.error('Yetki kontrolü hatası:', error.message);
            return false;
        }
    }

    // Admin kanalı için özel yetki kontrolü
    hasAdminChannelPermission(permission) {
        try {
            const guild = this.client.guilds.cache.get(this.config.discord.guildId);
            if (!guild) return false;

            const adminChannel = guild.channels.cache.get(this.config.discord.adminModChannelId);
            if (!adminChannel) return false;

            const botMember = guild.members.cache.get(this.client.user.id);
            if (!botMember) return false;

            const channelPerms = adminChannel.permissionsFor(botMember);
            return channelPerms.has(permission);
        } catch (error) {
            this.logger.error('Admin kanal yetki kontrolü hatası:', error.message);
            return false;
        }
    }
}

module.exports = PermissionChecker; 