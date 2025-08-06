module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        const logger = client.logger;
        
        logger.info(`✅ ${client.user.tag} olarak giriş yapıldı!`);
        logger.info(`🌐 ${client.guilds.cache.size} sunucuda aktif`);
        logger.info(`👥 ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} kullanıcıya hizmet veriyor`);
        
        // Bot durumunu ayarla
        client.user.setActivity('Moderatör takvimini yönetiyor', { type: 'WATCHING' });
        
        logger.info('🤖 Bot tamamen hazır ve çalışıyor!');
    }
}; 