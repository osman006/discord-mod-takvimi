const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const SchedulePublisher = require('../utils/schedulePublisher');
const DisciplineManager = require('../utils/disciplineManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Tüm admin komutları')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('takvim-olustur')
                .setDescription('Günlük takvim oluştur')
                .addStringOption(option =>
                    option.setName('tarih')
                        .setDescription('Tarih (YYYY-MM-DD, boş bırakılırsa bugün)')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kullanici-izin')
                .setDescription('Kullanıcıya özel izin/kısıtlama oluştur')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('İzin verilecek/kısıtlanacak kullanıcı')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('baslangic')
                        .setDescription('Başlangıç saati (HH:MM)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('bitis')
                        .setDescription('Bitiş saati (HH:MM)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('tur')
                        .setDescription('İzin türü')
                        .setRequired(true)
                        .addChoices(
                            { name: '✅ İzin Ver (Bu saatlerde çalışabilir)', value: 'allow' },
                            { name: '❌ Kısıtla (Bu saatlerde çalışamaz)', value: 'restrict' }
                        ))
                .addStringOption(option =>
                    option.setName('aciklama')
                        .setDescription('İzin/kısıtlama açıklaması')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kalici-saat')
                .setDescription('Kullanıcıya kalıcı saat belirle (bot her zaman bu saate atar)')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Kalıcı saat atanacak kullanıcı')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('vardiya')
                        .setDescription('Kalıcı vardiya seçimi')
                        .setRequired(true)
                        .addChoices(
                            { name: '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)', value: 'slot1' },
                            { name: '🌅 Vardiya 2 - Sabah (05:00-10:00)', value: 'slot2' },
                            { name: '☀️ Vardiya 3 - Öğlen (10:00-15:00)', value: 'slot3' },
                            { name: '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)', value: 'slot4' },
                            { name: '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)', value: 'slot5' }
                        ))
                .addStringOption(option =>
                    option.setName('aciklama')
                        .setDescription('Kalıcı atama açıklaması')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('saat-degistir')
                .setDescription('Kullanıcının saatini değiştir (değişen kişiye mesaj gönderir)')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Saati değiştirilecek kullanıcı')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('yeni-vardiya')
                        .setDescription('Yeni vardiya seçimi')
                        .setRequired(true)
                        .addChoices(
                            { name: '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)', value: 'slot1' },
                            { name: '🌅 Vardiya 2 - Sabah (05:00-10:00)', value: 'slot2' },
                            { name: '☀️ Vardiya 3 - Öğlen (10:00-15:00)', value: 'slot3' },
                            { name: '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)', value: 'slot4' },
                            { name: '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)', value: 'slot5' }
                        ))
                .addStringOption(option =>
                    option.setName('tarih')
                        .setDescription('Değişiklik tarihi (YYYY-MM-DD, boş bırakılırsa bugün)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('Değişiklik sebebi')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('mod-ekle')
                .setDescription('Sisteme yeni moderatör ekle')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Eklenecek moderatör')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('rol')
                        .setDescription('Moderatör rolü')
                        .setRequired(true)
                        .addChoices(
                            { name: '👮 Moderatör', value: 'MOD' },
                            { name: '👮‍♂️ Senior Moderatör', value: 'SR MOD' },
                            { name: '🛡️ Head Moderatör', value: 'HEAD MOD' }
                        ))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('modlari-guncelle')
                .setDescription('Tüm moderatörleri tara ve güncelle')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('takvim-gonder')
                .setDescription('Moderatörlere takvim anketi gönder')
                .addStringOption(option =>
                    option.setName('period')
                        .setDescription('Dönem (örn: 2025-W32)')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('takvim-sil')
                .setDescription('Belirtilen tarihin takvimini sil')
                .addStringOption(option =>
                    option.setName('tarih')
                        .setDescription('Silinecek tarih (YYYY-MM-DD)')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('cezali-listesi')
                .setDescription('Cezalı kullanıcıları listele')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban-kaldir')
                .setDescription('Kullanıcının banını kaldır')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Banı kaldırılacak kullanıcı')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Bot istatistiklerini görüntüle')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('permissions')
                .setDescription('Bot yetkilerini kontrol et')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('workload')
                .setDescription('Moderatör çalışma yükü analizi (son 7 gün)')
        ),

    async execute(interaction, client) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const logger = client.logger;
            const database = client.database;
            const config = client.config;

            // Admin yetkisi kontrolü
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({
                    content: '❌ Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekiyor.',
                    ephemeral: true
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            switch (subcommand) {
                case 'takvim-olustur':
                    await this.handleCreateSchedule(interaction, client);
                    break;
                case 'kullanici-izin':
                    await this.handleUserPermission(interaction, client);
                    break;
                case 'kalici-saat':
                    await this.handlePermanentShift(interaction, client);
                    break;
                case 'saat-degistir':
                    await this.handleChangeShift(interaction, client);
                    break;
                case 'mod-ekle':
                    await this.handleAddMod(interaction, client);
                    break;
                case 'modlari-guncelle':
                    await this.handleUpdateMods(interaction, client);
                    break;
                case 'takvim-gonder':
                    await this.handleSendSurvey(interaction, client);
                    break;
                case 'takvim-sil':
                    await this.handleDeleteSchedule(interaction, client);
                    break;
                case 'cezali-listesi':
                    await this.handlePunishedList(interaction, client);
                    break;
                case 'ban-kaldir':
                    await this.handleUnban(interaction, client);
                    break;
                case 'stats':
                    await this.handleStats(interaction, client);
                    break;
                case 'permissions':
                    await this.handlePermissions(interaction, client);
                    break;
                case 'workload':
                    await this.handleWorkload(interaction, client);
                    break;
                default:
                    await interaction.editReply({
                        content: '❌ Bilinmeyen alt komut.'
                    });
            }

        } catch (error) {
            client.logger.botError(error, 'Admin komut');
            
            try {
                await interaction.editReply({
                    content: '❌ Komut çalıştırılırken bir hata oluştu.'
                });
            } catch (replyError) {
                client.logger.error('Hata mesajı gönderilemedi:', replyError.message);
            }
        }
    },

    // Takvim oluştur
    async handleCreateSchedule(interaction, client) {
        const date = interaction.options.getString('tarih') || new Date().toISOString().split('T')[0];
        
        try {
            const AutoScheduleManager = require('../utils/autoScheduleManager');
            const autoScheduler = new AutoScheduleManager(client);
            
            await interaction.editReply({
                content: `🔄 **${date}** için takvim oluşturuluyor...`
            });

            const result = await autoScheduler.createDailySchedule(date);
            
            if (result.success) {
                await interaction.editReply({
                    content: `✅ **${date}** için takvim başarıyla oluşturuldu!\n\n${result.summary}`
                });
            } else {
                await interaction.editReply({
                    content: `❌ Takvim oluşturulamadı: ${result.error}`
                });
            }
        } catch (error) {
            await interaction.editReply({
                content: `❌ Takvim oluşturma hatası: ${error.message}`
            });
        }
    },

    // Kullanıcı izin/kısıtlama
    async handleUserPermission(interaction, client) {
        const user = interaction.options.getUser('kullanici');
        const startTime = interaction.options.getString('baslangic');
        const endTime = interaction.options.getString('bitis');
        const type = interaction.options.getString('tur');
        const description = interaction.options.getString('aciklama') || '';

        try {
            // Saat formatını kontrol et
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
                await interaction.editReply({
                    content: '❌ Geçersiz saat formatı! HH:MM formatında giriniz (örn: 14:30)'
                });
                return;
            }

            await client.database.setUserTimePermission(user.id, startTime, endTime, type, description);

            const typeText = type === 'allow' ? '✅ İzin verildi' : '❌ Kısıtlandı';
            const actionText = type === 'allow' ? 'çalışabilir' : 'çalışamaz';

            await interaction.editReply({
                content: `${typeText} **${user.username}** kullanıcısı **${startTime}-${endTime}** saatleri arasında ${actionText}.\n${description ? `📝 Açıklama: ${description}` : ''}`
            });

        } catch (error) {
            await interaction.editReply({
                content: `❌ İzin ayarlama hatası: ${error.message}`
            });
        }
    },

    // Kalıcı saat belirleme
    async handlePermanentShift(interaction, client) {
        const user = interaction.options.getUser('kullanici');
        const shift = interaction.options.getString('vardiya');
        const description = interaction.options.getString('aciklama') || '';

        try {
            await client.database.setPermanentShift(user.id, shift, description);

            const shiftNames = {
                'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
                'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
                'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
                'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
                'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
            };

            await interaction.editReply({
                content: `✅ **${user.username}** kullanıcısına kalıcı vardiya atandı:\n\n${shiftNames[shift]}\n${description ? `📝 Açıklama: ${description}` : ''}\n\n⚠️ Bu kullanıcı artık otomatik olarak bu vardiyaya atanacak!`
            });

        } catch (error) {
            await interaction.editReply({
                content: `❌ Kalıcı saat atama hatası: ${error.message}`
            });
        }
    },

    // Saat değiştirme
    async handleChangeShift(interaction, client) {
        const user = interaction.options.getUser('kullanici');
        const newShift = interaction.options.getString('yeni-vardiya');
        const date = interaction.options.getString('tarih') || new Date().toISOString().split('T')[0];
        const reason = interaction.options.getString('sebep') || 'Admin tarafından değiştirildi';

        try {
            const result = await client.database.changeUserShift(user.id, newShift, date, reason);
            
            if (result.success) {
                // Kullanıcıya DM gönder
                try {
                    const dmUser = await client.users.fetch(user.id);
                    const shiftNames = {
                        'slot1': '🌚 Vardiya 1 - Gece Yarısı (00:00-05:00)',
                        'slot2': '🌅 Vardiya 2 - Sabah (05:00-10:00)',
                        'slot3': '☀️ Vardiya 3 - Öğlen (10:00-15:00)',
                        'slot4': '🌤️ Vardiya 4 - Öğleden Sonra (15:00-20:00)',
                        'slot5': '🌆 Vardiya 5 - Akşam-Gece (20:00-00:00)'
                    };

                    await dmUser.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff9900')
                            .setTitle('🔄 Vardiya Değişikliği')
                            .setDescription(`**${date}** tarihli vardiyandız değiştirildi!`)
                            .addFields(
                                {
                                    name: '📅 Tarih',
                                    value: date,
                                    inline: true
                                },
                                {
                                    name: '🕒 Yeni Vardiya',
                                    value: shiftNames[newShift],
                                    inline: false
                                },
                                {
                                    name: '📝 Sebep',
                                    value: reason,
                                    inline: false
                                }
                            )
                            .setTimestamp()
                        ]
                    });
                } catch (dmError) {
                    client.logger.error(`${user.username} kullanıcısına DM gönderilemedi:`, dmError.message);
                }

                await interaction.editReply({
                    content: `✅ **${user.username}** kullanıcısının **${date}** tarihli vardiyası değiştirildi!\n📨 Kullanıcıya bildirim gönderildi.`
                });
            } else {
                await interaction.editReply({
                    content: `❌ Vardiya değiştirme hatası: ${result.error}`
                });
            }

        } catch (error) {
            await interaction.editReply({
                content: `❌ Saat değiştirme hatası: ${error.message}`
            });
        }
    },

    // Mod ekle
    async handleAddMod(interaction, client) {
        const user = interaction.options.getUser('kullanici');
        const role = interaction.options.getString('rol');

        try {
            await client.database.addModerator(user.id, user.username, user.displayName || user.username, [role]);

            await interaction.editReply({
                content: `✅ **${user.username}** sisteme **${role}** rolü ile eklendi!`
            });

        } catch (error) {
            await interaction.editReply({
                content: `❌ Moderatör ekleme hatası: ${error.message}`
            });
        }
    },

    // Modları güncelle
    async handleUpdateMods(interaction, client) {
        await interaction.editReply({
            content: '🔄 Moderatörler taranıyor ve güncelleniyor...'
        });

        try {
            const guild = client.guilds.cache.get(client.config.discord.guildId);
            await guild.members.fetch();

            const moderators = [];
            
            for (const [userId, member] of guild.members.cache) {
                const userRoles = member.roles.cache.map(role => role.name);
                const modRoles = userRoles.filter(role => client.config.discord.modRoles.includes(role));
                
                if (modRoles.length > 0) {
                    moderators.push({
                        userId: member.user.id,
                        username: member.user.username,
                        displayName: member.displayName,
                        roles: modRoles
                    });
                    
                    await client.database.updateModerator(
                        member.user.id,
                        member.user.username,
                        member.displayName,
                        modRoles
                    );
                }
            }

            await interaction.editReply({
                content: `✅ **${moderators.length}** moderatör güncellendi!`
            });

        } catch (error) {
            await interaction.editReply({
                content: `❌ Moderatör güncelleme hatası: ${error.message}`
            });
        }
    },

    // Takvim gönder (Anket)
    async handleSendSurvey(interaction, client) {
        const period = interaction.options.getString('period') || client.config.utils.getCurrentPeriod();
        
        await interaction.editReply({
            content: `🔄 **${period}** dönemi için anket gönderiliyor...`
        });

        try {
            const SurveyManager = require('../utils/surveyManager');
            const surveyManager = new SurveyManager(client);
            
            const result = await surveyManager.sendSurveyToAllMods(period);
            
            await interaction.editReply({
                content: `✅ **${period}** dönemi anket gönderimi tamamlandı!\n📊 Başarılı: **${result.sent}**, Başarısız: **${result.failed}**`
            });

        } catch (error) {
            await interaction.editReply({
                content: `❌ Anket gönderme hatası: ${error.message}`
            });
        }
    },

    // Takvim sil
    async handleDeleteSchedule(interaction, client) {
        const date = interaction.options.getString('tarih');

        try {
            await client.database.deleteScheduleForDate(date);
            
            await interaction.editReply({
                content: `✅ **${date}** tarihinin takvimi silindi!`
            });

        } catch (error) {
            await interaction.editReply({
                content: `❌ Takvim silme hatası: ${error.message}`
            });
        }
    },

    // Cezalı listesi
    async handlePunishedList(interaction, client) {
        try {
            const punishedUsers = await client.database.getPunishedUsers();
            
            if (punishedUsers.length === 0) {
                await interaction.editReply({
                    content: '✅ Şu anda cezalı kullanıcı bulunmuyor.'
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚫 Cezalı Kullanıcılar')
                .setDescription(`Toplam **${punishedUsers.length}** cezalı kullanıcı`)
                .setTimestamp();

            const punishmentList = punishedUsers.map(user => {
                const endDate = new Date(user.ban_end).toLocaleString('tr-TR');
                return `**${user.username}** <@${user.user_id}>\n📝 Sebep: ${user.violation_type}\n⏰ Bitiş: ${endDate}`;
            });

            embed.addFields({
                name: 'Cezalı Kullanıcılar',
                value: punishmentList.join('\n\n'),
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await interaction.editReply({
                content: `❌ Cezalı listesi hatası: ${error.message}`
            });
        }
    },

    // Ban kaldır
    async handleUnban(interaction, client) {
        const user = interaction.options.getUser('kullanici');

        try {
            const result = await client.database.removeBan(user.id);
            
            if (result.success) {
                // Kullanıcıya DM gönder
                try {
                    const dmUser = await client.users.fetch(user.id);
                    await dmUser.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✅ Ban Kaldırıldı')
                            .setDescription('Cezanız admin tarafından kaldırıldı! Artık normal şekilde moderatörlük görevlerinizi yapabilirsiniz.')
                            .setTimestamp()
                        ]
                    });
                } catch (dmError) {
                    client.logger.error(`${user.username} kullanıcısına DM gönderilemedi:`, dmError.message);
                }

                await interaction.editReply({
                    content: `✅ **${user.username}** kullanıcısının banı kaldırıldı!\n📨 Kullanıcıya bildirim gönderildi.`
                });
            } else {
                await interaction.editReply({
                    content: `❌ Ban kaldırma hatası: ${result.error}`
                });
            }

        } catch (error) {
            await interaction.editReply({
                content: `❌ Ban kaldırma hatası: ${error.message}`
            });
        }
    },

    // Bot istatistikleri
    async handleStats(interaction, client) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 Bot İstatistikleri')
            .setThumbnail(client.user.displayAvatarURL())
            .setTimestamp();

        try {
            const activeMods = await client.database.getActiveModerators();
            const punishedUsers = await client.database.getPunishedUsers();
            const uptime = process.uptime();
            const uptimeText = `${Math.floor(uptime / 86400)}g ${Math.floor((uptime % 86400) / 3600)}s ${Math.floor((uptime % 3600) / 60)}dk`;
            
            embed.addFields(
                {
                    name: '🤖 Bot Bilgileri',
                    value: [
                        `**Çalışma Süresi:** ${uptimeText}`,
                        `**Discord.js:** ${require('discord.js').version}`,
                        `**Node.js:** ${process.version}`,
                        `**Bellek:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '👥 Moderatör İstatistikleri',
                    value: [
                        `**Aktif Moderatör:** ${activeMods.length}`,
                        `**Cezalı Kullanıcı:** ${punishedUsers.length}`,
                        `**Sistem Durumu:** ✅ Aktif`
                    ].join('\n'),
                    inline: false
                }
            );

        } catch (error) {
            embed.addFields({
                name: '❌ Hata',
                value: 'İstatistikler alınırken bir hata oluştu.',
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    // Yetki kontrolü
    async handlePermissions(interaction, client) {
        try {
            const PermissionChecker = require('../utils/permissionChecker');
            const permissionChecker = new PermissionChecker(client);
            
            await interaction.editReply({
                content: '🔄 Bot yetkileri kontrol ediliyor...'
            });

            const permissionCheck = await permissionChecker.checkBotPermissions();
            const embed = permissionChecker.createPermissionReport(permissionCheck);

            await interaction.editReply({
                content: permissionCheck.success ? 
                    '✅ Yetki kontrolü tamamlandı!' : 
                    '⚠️ Yetki sorunları tespit edildi!',
                embeds: [embed]
            });

        } catch (error) {
            await interaction.editReply({
                content: `❌ Yetki kontrolü hatası: ${error.message}`
            });
        }
    },

    // Çalışma yükü analizi
    async handleWorkload(interaction, client) {
        try {
            await interaction.editReply({
                content: '📊 Moderatör çalışma yükü analiz ediliyor...'
            });

            const moderators = await client.database.getActiveModerators();
            const today = new Date().toISOString().split('T')[0];
            
            // Son 7 günü hesapla
            const last7Days = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                last7Days.push(date.toISOString().split('T')[0]);
            }

            const workloadData = [];
            
            for (const mod of moderators) {
                let totalHours = 0;
                let totalDays = 0;
                
                for (const date of last7Days) {
                    const assignments = await client.database.getUserAssignmentsForDate(mod.user_id, date);
                    if (assignments.length > 0) {
                        totalDays++;
                        for (const assignment of assignments) {
                            const hours = this.getSlotHours(assignment.slot_id);
                            totalHours += hours;
                        }
                    }
                }

                workloadData.push({
                    username: mod.username,
                    userId: mod.user_id,
                    totalHours,
                    totalDays,
                    avgHoursPerDay: totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0
                });
            }

            // Çalışma yüküne göre sırala
            workloadData.sort((a, b) => b.totalHours - a.totalHours);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Moderatör Çalışma Yükü Analizi')
                .setDescription(`Son 7 günlük çalışma saatleri analizi`)
                .setTimestamp();

            // En çok çalışanlar
            const topWorkers = workloadData.slice(0, 3);
            if (topWorkers.length > 0) {
                embed.addFields({
                    name: '🏆 En Çok Çalışanlar',
                    value: topWorkers.map((mod, index) => 
                        `**${index + 1}.** ${mod.username}\n` +
                        `📊 ${mod.totalHours} saat (${mod.totalDays} gün)\n` +
                        `📈 Günlük ort: ${mod.avgHoursPerDay} saat`
                    ).join('\n\n'),
                    inline: false
                });
            }

            // En az çalışanlar
            const leastWorkers = workloadData.slice(-3).reverse();
            if (leastWorkers.length > 0) {
                embed.addFields({
                    name: '💤 En Az Çalışanlar',
                    value: leastWorkers.map((mod, index) => 
                        `**${index + 1}.** ${mod.username}\n` +
                        `📊 ${mod.totalHours} saat (${mod.totalDays} gün)\n` +
                        `📈 Günlük ort: ${mod.avgHoursPerDay} saat`
                    ).join('\n\n'),
                    inline: false
                });
            }

            // Genel istatistikler
            const totalWorkHours = workloadData.reduce((sum, mod) => sum + mod.totalHours, 0);
            const avgWorkHours = workloadData.length > 0 ? (totalWorkHours / workloadData.length).toFixed(1) : 0;
            
            embed.addFields({
                name: '📈 Genel İstatistikler',
                value: [
                    `**Toplam Çalışma:** ${totalWorkHours} saat`,
                    `**Ortalama/Moderatör:** ${avgWorkHours} saat`,
                    `**Aktif Moderatör:** ${workloadData.filter(m => m.totalHours > 0).length}`,
                    `**İdeal Dağılım:** ${(totalWorkHours / moderators.length).toFixed(1)} saat/mod`
                ].join('\n'),
                inline: false
            });

            await interaction.editReply({
                content: '✅ Çalışma yükü analizi tamamlandı!',
                embeds: [embed]
            });

        } catch (error) {
            await interaction.editReply({
                content: `❌ Çalışma yükü analizi hatası: ${error.message}`
            });
        }
    },

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
}; 