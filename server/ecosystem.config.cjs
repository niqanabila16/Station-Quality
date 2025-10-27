// ecosystem.config.cjs

module.exports = {
  apps: [
    {
      // Proses untuk server utama Anda
      name: 'web-server',
      script: 'server.js', 
      watch: true, 
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      // Proses untuk skrip penjadwal
      name: 'scheduler',
      script: './scripts/scheduler.js',
      watch: false,
      autorestart: true, 
    },
  ],
};