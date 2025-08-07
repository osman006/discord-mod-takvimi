module.exports = {
  apps: [
    {
      name: 'discord-mod-bot',
      script: 'src/index.js',
      cwd: '/root/Projects/discord-mod-takvimi',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      log_file: './logs/bot-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
    // Web panel kaldırıldı - PHP ile yapılacak
  ],

  deploy: {
    production: {
      user: 'root',
      host: '188-191-107-115',
      ref: 'origin/new-main',
      repo: 'https://github.com/osman006/discord-mod-takvimi.git',
      path: '/root/Projects/discord-mod-takvimi',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}; 