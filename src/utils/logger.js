const fs = require('fs');
const path = require('path');

class Logger {
    constructor(logLevel = 'info') {
        this.logLevel = logLevel;
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        // Log klasörünü oluştur
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        this.logFile = path.join(logsDir, `bot-${new Date().toISOString().split('T')[0]}.log`);
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const baseMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (data) {
            return `${baseMessage} ${JSON.stringify(data, null, 2)}`;
        }
        
        return baseMessage;
    }

    writeToFile(formattedMessage) {
        try {
            fs.appendFileSync(this.logFile, formattedMessage + '\n');
        } catch (error) {
            console.error('Log dosyasına yazma hatası:', error);
        }
    }

    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, data);
        
        // Konsola yazdır
        switch (level) {
            case 'error':
                console.error(`❌ ${formattedMessage}`);
                break;
            case 'warn':
                console.warn(`⚠️ ${formattedMessage}`);
                break;
            case 'info':
                console.log(`ℹ️ ${formattedMessage}`);
                break;
            case 'debug':
                console.log(`🔧 ${formattedMessage}`);
                break;
        }

        // Dosyaya yaz
        this.writeToFile(formattedMessage);
    }

    error(message, data = null) {
        this.log('error', message, data);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    // Discord özel log fonksiyonları
    discordEvent(eventName, data = null) {
        this.info(`Discord Event: ${eventName}`, data);
    }

    commandUsed(commandName, userId, username) {
        this.info(`Komut kullanıldı: ${commandName}`, { userId, username });
    }

    surveyResponse(userId, username, period) {
        this.info(`Anket yanıtı alındı: ${username} (${period})`, { userId });
    }

    disciplineApplied(userId, username, banDays, reason) {
        this.warn(`Disiplin uygulandı: ${username} - ${banDays} gün ban`, { userId, reason });
    }

    botError(error, context = null) {
        this.error('Bot hatası', { error: error.message, stack: error.stack, context });
    }
}

module.exports = Logger; 