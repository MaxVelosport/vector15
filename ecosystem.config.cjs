// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "tvoyvector",
      script: "dist/index.cjs",
      instances: 1,
      exec_mode: "fork",

      env_production: {
        NODE_ENV: "production",
      },

      // Автоперезапуск
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",

      // Перезапуск при утечке памяти
      max_memory_restart: "800M",

      // Логи
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
